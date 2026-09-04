import {
  type Issue,
  inferPrefix,
  nextIssueId,
  parseJsonl,
  serializeJsonl,
} from './beads';
import {
  ConflictError,
  type GitHubConfig,
  type FileSnapshot,
  readFile,
  writeFile,
} from './github';

export interface Database {
  issues: Issue[];
  /** Blob sha of the JSONL file; changes on every write. */
  sha: string | null;
  headSha: string | null;
  skipped: number;
  prefix: string;
}

export interface DatabaseMeta {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export function describe(config: GitHubConfig): DatabaseMeta {
  return {
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    path: config.path,
  };
}

function toDatabase(snapshot: FileSnapshot, fallbackPrefix: string): Database {
  const { issues, skipped } = parseJsonl(snapshot.content);
  return {
    issues,
    sha: snapshot.sha,
    headSha: snapshot.headSha,
    skipped,
    prefix: inferPrefix(issues, fallbackPrefix),
  };
}

export async function load(config: GitHubConfig): Promise<Database> {
  const snapshot = await readFile(config);
  return toDatabase(snapshot, config.prefix);
}

export interface MutationResult<T> {
  value: T;
  database: Database;
}

/**
 * Read-modify-write against the GitHub blob. The blob sha is the CAS token: if
 * anything else committed to the file in between, GitHub rejects the write and
 * we replay the mutation against fresh state rather than clobbering it.
 */
export async function mutate<T>(
  apply: (issues: Issue[]) => { issues: Issue[]; value: T; message: string },
  config: GitHubConfig,
  attempts = 4,
): Promise<MutationResult<T>> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const database = await load(config);
    const { issues, value, message } = apply([...database.issues]);
    const content = serializeJsonl(issues);

    try {
      const written = await writeFile(config, content, message, database.sha);
      return {
        value,
        database: {
          ...database,
          issues,
          sha: written.sha,
          headSha: written.commitSha,
        },
      };
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError ?? new ConflictError();
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface CreateInput {
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  issue_type?: string;
  assignee?: string;
  labels?: string[];
  design?: string;
  acceptance_criteria?: string;
  notes?: string;
  actor?: string;
}

export async function createIssue(
  input: CreateInput,
  config: GitHubConfig,
): Promise<MutationResult<Issue>> {
  return mutate((issues) => {
    const prefix = inferPrefix(issues, config.prefix);
    const timestamp = nowIso();

    const issue: Issue = {
      _type: 'issue',
      id: nextIssueId(issues, prefix),
      title: input.title,
      status: input.status ?? 'open',
      priority: input.priority ?? 2,
      issue_type: input.issue_type ?? 'task',
      created_at: timestamp,
      updated_at: timestamp,
      ...(input.description ? { description: input.description } : {}),
      ...(input.design ? { design: input.design } : {}),
      ...(input.acceptance_criteria
        ? { acceptance_criteria: input.acceptance_criteria }
        : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.assignee ? { assignee: input.assignee } : {}),
      ...(input.labels?.length ? { labels: input.labels } : {}),
      ...(input.actor ? { created_by: input.actor } : {}),
    };

    return {
      issues: [...issues, issue],
      value: issue,
      message: `bd: create ${issue.id} — ${issue.title}`,
    };
  }, config);
}

export type UpdateInput = Partial<
  Pick<
    Issue,
    | 'title'
    | 'description'
    | 'design'
    | 'acceptance_criteria'
    | 'notes'
    | 'status'
    | 'priority'
    | 'issue_type'
    | 'assignee'
    | 'owner'
    | 'labels'
    | 'close_reason'
    | 'due_at'
  >
>;

export async function updateIssue(
  id: string,
  patch: UpdateInput,
  config: GitHubConfig,
): Promise<MutationResult<Issue>> {
  return mutate((issues) => {
    const index = issues.findIndex((issue) => issue.id === id);
    if (index === -1) throw new NotFoundError(id);

    const previous = issues[index]!;
    const timestamp = nowIso();
    const next: Issue = { ...previous, ...stripUndefined(patch), updated_at: timestamp };

    if (patch.status && patch.status !== previous.status) {
      if (patch.status === 'in_progress' && !previous.started_at) {
        next.started_at = timestamp;
      }
      if (patch.status === 'closed') {
        next.closed_at = timestamp;
      } else if (previous.status === 'closed') {
        delete next.closed_at;
        delete next.close_reason;
      }
    }

    const copy = [...issues];
    copy[index] = next;

    return {
      issues: copy,
      value: next,
      message: `bd: update ${id} — ${summarizePatch(patch)}`,
    };
  }, config);
}

export async function deleteIssue(
  id: string,
  config: GitHubConfig,
): Promise<MutationResult<{ id: string }>> {
  return mutate((issues) => {
    if (!issues.some((issue) => issue.id === id)) throw new NotFoundError(id);

    const remaining = issues
      .filter((issue) => issue.id !== id)
      .map((issue) => {
        if (!issue.dependencies?.length) return issue;
        const dependencies = issue.dependencies.filter(
          (dep) => dep.depends_on_id !== id && dep.issue_id !== id,
        );
        return dependencies.length === issue.dependencies.length
          ? issue
          : { ...issue, dependencies };
      });

    return {
      issues: remaining,
      value: { id },
      message: `bd: delete ${id}`,
    };
  }, config);
}

export async function addComment(
  id: string,
  text: string,
  author: string,
  config: GitHubConfig,
): Promise<MutationResult<Issue>> {
  return mutate((issues) => {
    const index = issues.findIndex((issue) => issue.id === id);
    if (index === -1) throw new NotFoundError(id);

    const previous = issues[index]!;
    const timestamp = nowIso();
    const comments = [
      ...(previous.comments ?? []),
      { issue_id: id, author, text, created_at: timestamp },
    ];

    const next: Issue = {
      ...previous,
      comments,
      comment_count: comments.length,
      updated_at: timestamp,
    };

    const copy = [...issues];
    copy[index] = next;

    return { issues: copy, value: next, message: `bd: comment on ${id}` };
  }, config);
}

export async function linkDependency(
  fromId: string,
  toId: string,
  type: string,
  actor: string,
  config: GitHubConfig,
): Promise<MutationResult<Issue>> {
  return mutate((issues) => {
    const index = issues.findIndex((issue) => issue.id === fromId);
    if (index === -1) throw new NotFoundError(fromId);
    if (!issues.some((issue) => issue.id === toId)) throw new NotFoundError(toId);
    if (fromId === toId) throw new ValidationError('An issue cannot depend on itself');

    const previous = issues[index]!;
    const existing = previous.dependencies ?? [];
    if (existing.some((dep) => dep.depends_on_id === toId && dep.type === type)) {
      return { issues, value: previous, message: `bd: dep ${fromId} -> ${toId} (no-op)` };
    }

    const next: Issue = {
      ...previous,
      dependencies: [
        ...existing,
        {
          issue_id: fromId,
          depends_on_id: toId,
          type,
          created_at: nowIso(),
          created_by: actor,
        },
      ],
      updated_at: nowIso(),
    };

    const copy = [...issues];
    copy[index] = next;

    return { issues: copy, value: next, message: `bd: link ${fromId} ${type} ${toId}` };
  }, config);
}

export async function unlinkDependency(
  fromId: string,
  toId: string,
  config: GitHubConfig,
): Promise<MutationResult<Issue>> {
  return mutate((issues) => {
    const index = issues.findIndex((issue) => issue.id === fromId);
    if (index === -1) throw new NotFoundError(fromId);

    const previous = issues[index]!;
    const dependencies = (previous.dependencies ?? []).filter(
      (dep) => dep.depends_on_id !== toId,
    );
    const next: Issue = { ...previous, dependencies, updated_at: nowIso() };

    const copy = [...issues];
    copy[index] = next;

    return { issues: copy, value: next, message: `bd: unlink ${fromId} -> ${toId}` };
  }, config);
}

export class NotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Issue ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = entry;
  }
  return result as Partial<T>;
}

function summarizePatch(patch: UpdateInput): string {
  const parts: string[] = [];
  if (patch.status) parts.push(`status=${patch.status}`);
  if (patch.priority !== undefined) parts.push(`priority=${patch.priority}`);
  if (patch.assignee !== undefined) parts.push(`assignee=${patch.assignee || 'none'}`);
  if (patch.issue_type) parts.push(`type=${patch.issue_type}`);
  if (patch.title) parts.push('title');
  if (patch.description !== undefined) parts.push('description');
  if (patch.labels) parts.push('labels');
  return parts.length ? parts.join(' ') : 'edit';
}
