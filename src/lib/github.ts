const API = 'https://api.github.com';

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
  committerName: string;
  committerEmail: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** Raised when the file moved under us between read and write. */
export class ConflictError extends Error {
  constructor(message = 'The database changed since it was read') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class MissingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingConfigError';
  }
}

export function loadConfig(): GitHubConfig {
  const token = process.env['GITHUB_TOKEN']?.trim();
  const owner = process.env['GITHUB_OWNER']?.trim();
  const repo = process.env['GITHUB_REPO']?.trim();

  const missing: string[] = [];
  if (!token) missing.push('GITHUB_TOKEN');
  if (!owner) missing.push('GITHUB_OWNER');
  if (!repo) missing.push('GITHUB_REPO');

  if (missing.length) {
    throw new MissingConfigError(
      `Missing ${missing.join(', ')}. Copy .env.example to .env.local and fill it in.`,
    );
  }

  return {
    owner: owner!,
    repo: repo!,
    token: token!,
    branch: process.env['GITHUB_BRANCH']?.trim() || 'beads-db',
    path: process.env['GITHUB_PATH']?.trim() || '.beads/issues.jsonl',
    committerName: process.env['GIT_COMMITTER_NAME']?.trim() || 'beads-linear',
    committerEmail:
      process.env['GIT_COMMITTER_EMAIL']?.trim() || 'beads-linear@users.noreply.github.com',
  };
}

async function request(
  config: GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'beads-linear',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  return response;
}

async function requestOk(
  config: GitHubConfig,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await request(config, path, init);
  if (!response.ok) {
    const body = await response.text();
    throw new GitHubError(
      `GitHub ${init.method ?? 'GET'} ${path} failed: ${response.status}`,
      response.status,
      body,
    );
  }
  return response.json();
}

export interface FileSnapshot {
  /** Blob sha — the compare-and-swap token for writes. */
  sha: string | null;
  content: string;
  /** Commit sha of the branch head when this snapshot was taken. */
  headSha: string | null;
}

function decodeBase64(value: string): string {
  return Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8');
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

export async function getBranchHead(config: GitHubConfig): Promise<string | null> {
  const response = await request(
    config,
    `/repos/${config.owner}/${config.repo}/commits/${encodeURIComponent(config.branch)}`,
    { headers: { Accept: 'application/vnd.github.sha' } },
  );

  if (response.status === 404 || response.status === 409) return null;
  if (!response.ok) {
    throw new GitHubError(`Could not read branch head`, response.status, await response.text());
  }

  return (await response.text()).trim();
}

/**
 * The Contents API refuses to inline blobs over 1 MB, so fall back to the Git
 * Data API, which serves any blob the repository holds.
 */
async function readLargeBlob(config: GitHubConfig, sha: string): Promise<string> {
  const blob = (await requestOk(
    config,
    `/repos/${config.owner}/${config.repo}/git/blobs/${sha}`,
  )) as { content?: string; encoding?: string };

  if (blob.encoding !== 'base64' || typeof blob.content !== 'string') {
    throw new GitHubError('Unexpected blob encoding', 200, JSON.stringify(blob).slice(0, 200));
  }

  return decodeBase64(blob.content);
}

export async function readFile(config: GitHubConfig): Promise<FileSnapshot> {
  const headSha = await getBranchHead(config);

  const response = await request(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${encodePath(config.path)}?ref=${encodeURIComponent(config.branch)}`,
  );

  if (response.status === 404) {
    return { sha: null, content: '', headSha };
  }

  if (!response.ok) {
    throw new GitHubError('Could not read database file', response.status, await response.text());
  }

  const file = (await response.json()) as {
    sha: string;
    content?: string;
    encoding?: string;
    size?: number;
  };

  if (file.encoding === 'base64' && typeof file.content === 'string') {
    return { sha: file.sha, content: decodeBase64(file.content), headSha };
  }

  return { sha: file.sha, content: await readLargeBlob(config, file.sha), headSha };
}

export async function writeFile(
  config: GitHubConfig,
  content: string,
  message: string,
  expectedSha: string | null,
): Promise<{ sha: string; commitSha: string }> {
  const body: Record<string, unknown> = {
    message,
    content: encodeBase64(content),
    branch: config.branch,
    committer: { name: config.committerName, email: config.committerEmail },
  };
  if (expectedSha) body['sha'] = expectedSha;

  const response = await request(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${encodePath(config.path)}`,
    { method: 'PUT', body: JSON.stringify(body) },
  );

  if (response.status === 409 || response.status === 422) {
    throw new ConflictError();
  }

  if (!response.ok) {
    throw new GitHubError('Could not write database file', response.status, await response.text());
  }

  const result = (await response.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string };
  };

  return {
    sha: result.content?.sha ?? '',
    commitSha: result.commit?.sha ?? '',
  };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export interface RepoMeta {
  defaultBranch: string;
  htmlUrl: string;
  fullName: string;
}

export async function getRepoMeta(config: GitHubConfig): Promise<RepoMeta> {
  const repo = (await requestOk(config, `/repos/${config.owner}/${config.repo}`)) as {
    default_branch: string;
    html_url: string;
    full_name: string;
  };

  return {
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    fullName: repo.full_name,
  };
}

/** Creates the data branch off the repository default branch if it is absent. */
export async function ensureBranch(config: GitHubConfig): Promise<'exists' | 'created'> {
  const head = await getBranchHead(config);
  if (head) return 'exists';

  const meta = await getRepoMeta(config);
  const baseSha = await getBranchHead({ ...config, branch: meta.defaultBranch });

  if (!baseSha) {
    throw new GitHubError(
      `Repository ${meta.fullName} has no commit on ${meta.defaultBranch} to branch from`,
      404,
      '',
    );
  }

  await requestOk(config, `/repos/${config.owner}/${config.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${config.branch}`, sha: baseSha }),
  });

  return 'created';
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export async function listRecentCommits(
  config: GitHubConfig,
  limit = 15,
): Promise<CommitInfo[]> {
  const response = await request(
    config,
    `/repos/${config.owner}/${config.repo}/commits?sha=${encodeURIComponent(config.branch)}&path=${encodePath(config.path)}&per_page=${limit}`,
  );

  if (!response.ok) return [];

  const commits = (await response.json()) as Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author: { name?: string; date?: string } };
  }>;

  return commits.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message.split('\n')[0] ?? '',
    author: commit.commit.author.name ?? 'unknown',
    date: commit.commit.author.date ?? '',
    url: commit.html_url,
  }));
}
