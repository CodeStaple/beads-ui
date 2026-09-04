import { GitHubError } from './github';

const API = 'https://api.github.com';

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'beads-linear',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}

async function callOk(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await call(token, path, init);
  if (!response.ok) {
    throw new GitHubError(
      `GitHub ${init.method ?? 'GET'} ${path} failed: ${response.status}`,
      response.status,
      await response.text(),
    );
  }
  return response.json();
}

export interface GitHubIdentity {
  login: string;
  name: string | null;
  scopes: string | null;
}

/** Confirms the token works and reports who it belongs to. */
export async function identify(token: string): Promise<GitHubIdentity> {
  const response = await call(token, '/user');
  if (!response.ok) {
    throw new GitHubError(
      'That token was rejected by GitHub',
      response.status,
      await response.text(),
    );
  }

  const user = (await response.json()) as { login: string; name: string | null };
  return {
    login: user.login,
    name: user.name,
    scopes: response.headers.get('x-oauth-scopes'),
  };
}

export interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
}

export async function listRepositories(token: string, limit = 100): Promise<RepoSummary[]> {
  const repos = (await callOk(
    token,
    `/user/repos?per_page=${limit}&sort=updated&affiliation=owner,collaborator,organization_member`,
  )) as Array<{
    full_name: string;
    name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    updated_at: string;
    owner: { login: string };
    permissions?: { push?: boolean };
  }>;

  return repos
    .filter((repo) => repo.permissions?.push !== false)
    .map((repo) => ({
      fullName: repo.full_name,
      owner: repo.owner.login,
      name: repo.name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
    }));
}

export interface CreatedRepo {
  owner: string;
  name: string;
  defaultBranch: string;
  htmlUrl: string;
}

/**
 * Creates the repository the tracker will live in. `auto_init` matters: an
 * empty repository has no commit to branch from, and every later write is a
 * compare-and-swap against an existing tree.
 */
export async function createRepository(
  token: string,
  name: string,
  options: { private?: boolean; org?: string | null; description?: string } = {},
): Promise<CreatedRepo> {
  const path = options.org ? `/orgs/${encodeURIComponent(options.org)}/repos` : '/user/repos';

  const response = await call(token, path, {
    method: 'POST',
    body: JSON.stringify({
      name,
      private: options.private ?? true,
      auto_init: true,
      description: options.description ?? 'Issue tracker database for beads',
    }),
  });

  if (response.status === 422) {
    throw new GitHubError(
      `A repository named "${name}" already exists — pick another name or connect the existing one`,
      422,
      await response.text(),
    );
  }
  if (!response.ok) {
    throw new GitHubError('Could not create the repository', response.status, await response.text());
  }

  const repo = (await response.json()) as {
    name: string;
    default_branch: string;
    html_url: string;
    owner: { login: string };
  };

  return {
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch || 'main',
    htmlUrl: repo.html_url,
  };
}

export async function listOrganisations(token: string): Promise<string[]> {
  try {
    const orgs = (await callOk(token, '/user/orgs?per_page=100')) as Array<{ login: string }>;
    return orgs.map((org) => org.login);
  } catch {
    // A token without `read:org` still works fine for personal repositories.
    return [];
  }
}
