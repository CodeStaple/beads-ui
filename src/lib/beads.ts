import { z } from 'zod';

export const ISSUE_STATUSES = [
  'open',
  'in_progress',
  'blocked',
  'deferred',
  'closed',
  'pinned',
  'hooked',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_TYPES = [
  'task',
  'bug',
  'feature',
  'chore',
  'epic',
  'decision',
  'spike',
  'story',
  'milestone',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export const DEPENDENCY_TYPES = [
  'blocks',
  'related',
  'parent-child',
  'discovered-from',
] as const;

export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export type StatusCategory = 'active' | 'wip' | 'done' | 'frozen';

export const STATUS_META: Record<
  IssueStatus,
  { label: string; category: StatusCategory; order: number }
> = {
  in_progress: { label: 'In Progress', category: 'wip', order: 0 },
  blocked: { label: 'Blocked', category: 'wip', order: 1 },
  hooked: { label: 'Hooked', category: 'wip', order: 2 },
  open: { label: 'Todo', category: 'active', order: 3 },
  pinned: { label: 'Pinned', category: 'frozen', order: 4 },
  deferred: { label: 'Deferred', category: 'frozen', order: 5 },
  closed: { label: 'Done', category: 'done', order: 6 },
};

export const PRIORITY_META: Record<
  number,
  { label: string; short: string; order: number }
> = {
  0: { label: 'Urgent', short: 'P0', order: 0 },
  1: { label: 'High', short: 'P1', order: 1 },
  2: { label: 'Medium', short: 'P2', order: 2 },
  3: { label: 'Low', short: 'P3', order: 3 },
  4: { label: 'No priority', short: 'P4', order: 4 },
};

const dependencySchema = z.object({
  issue_id: z.string(),
  depends_on_id: z.string(),
  type: z.string().default('blocks'),
  created_at: z.string().optional(),
  created_by: z.string().optional(),
  metadata: z.string().optional(),
});

const commentSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  issue_id: z.string().optional(),
  author: z.string().optional(),
  text: z.string().optional(),
  content: z.string().optional(),
  created_at: z.string().optional(),
});

/**
 * Mirrors the record shape emitted by `bd export` and accepted by `bd import`.
 * Unknown keys are preserved verbatim so a round-trip through this app never
 * drops fields a newer bd release adds.
 */
export const issueSchema = z
  .object({
    _type: z.literal('issue').default('issue'),
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    design: z.string().optional(),
    acceptance_criteria: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().default('open'),
    priority: z.number().int().min(0).max(4).default(2),
    issue_type: z.string().default('task'),
    assignee: z.string().optional(),
    owner: z.string().optional(),
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    started_at: z.string().optional(),
    closed_at: z.string().optional(),
    close_reason: z.string().optional(),
    due_at: z.string().optional(),
    defer_until: z.string().optional(),
    external_ref: z.string().optional(),
    source_system: z.string().optional(),
    labels: z.array(z.string()).optional(),
    dependencies: z.array(dependencySchema).optional(),
    comments: z.array(commentSchema).optional(),
    dependency_count: z.number().optional(),
    dependent_count: z.number().optional(),
    comment_count: z.number().optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough();

export type Issue = z.infer<typeof issueSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Comment = z.infer<typeof commentSchema>;

export function isKnownStatus(value: string): value is IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function isKnownType(value: string): value is IssueType {
  return (ISSUE_TYPES as readonly string[]).includes(value);
}

export function statusMeta(status: string) {
  return isKnownStatus(status)
    ? STATUS_META[status]
    : { label: status, category: 'active' as StatusCategory, order: 99 };
}

export function priorityMeta(priority: number) {
  return PRIORITY_META[priority] ?? PRIORITY_META[4]!;
}

/** `bd export` writes one JSON object per line. Blank lines are tolerated. */
export function parseJsonl(text: string): { issues: Issue[]; skipped: number } {
  const issues: Issue[] = [];
  let skipped = 0;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      skipped += 1;
      continue;
    }

    const record = raw as Record<string, unknown>;
    if (record['_type'] !== undefined && record['_type'] !== 'issue') {
      skipped += 1;
      continue;
    }
    if (record['status'] === 'tombstone') {
      skipped += 1;
      continue;
    }

    const parsed = issueSchema.safeParse(record);
    if (parsed.success) issues.push(parsed.data);
    else skipped += 1;
  }

  return { issues, skipped };
}

/**
 * Key order matters only for diff readability in GitHub; `bd import` is
 * order-insensitive. Undefined values are dropped so the file stays close to
 * what `bd export` itself would emit.
 */
const KEY_ORDER = [
  '_type',
  'id',
  'title',
  'description',
  'design',
  'acceptance_criteria',
  'notes',
  'status',
  'priority',
  'issue_type',
  'assignee',
  'owner',
  'created_by',
  'created_at',
  'updated_at',
  'started_at',
  'closed_at',
  'close_reason',
  'due_at',
  'defer_until',
  'external_ref',
  'source_system',
  'labels',
  'dependencies',
  'comments',
];

export function serializeJsonl(issues: readonly Issue[]): string {
  const sorted = [...issues].sort((a, b) => a.id.localeCompare(b.id));

  const lines = sorted.map((issue) => {
    const source = issue as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};

    for (const key of KEY_ORDER) {
      if (source[key] !== undefined) ordered[key] = source[key];
    }
    for (const key of Object.keys(source)) {
      if (!(key in ordered) && source[key] !== undefined) ordered[key] = source[key];
    }

    return JSON.stringify(ordered);
  });

  return lines.length ? `${lines.join('\n')}\n` : '';
}

/**
 * bd ids look like `so-8ag`: a workspace prefix and a short base36 suffix.
 * New ids generated here must not collide with anything already in the file.
 */
export function nextIssueId(existing: readonly Issue[], prefix: string): string {
  const taken = new Set(existing.map((issue) => issue.id));
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 3; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const candidate = `${prefix}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${prefix}-${Date.now().toString(36)}`;
}

export function inferPrefix(issues: readonly Issue[], fallback: string): string {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    const dash = issue.id.lastIndexOf('-');
    if (dash <= 0) continue;
    const prefix = issue.id.slice(0, dash);
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }

  let best = fallback;
  let bestCount = 0;
  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      best = prefix;
      bestCount = count;
    }
  }

  return best;
}

export function isOpen(issue: Issue): boolean {
  return statusMeta(issue.status).category !== 'done';
}

/**
 * A bead is ready when nothing it blocks-on is still open. Mirrors `bd ready`.
 */
export function isReady(issue: Issue, byId: ReadonlyMap<string, Issue>): boolean {
  if (!isOpen(issue)) return false;
  if (issue.status === 'blocked') return false;

  for (const dep of issue.dependencies ?? []) {
    if (dep.issue_id !== issue.id) continue;
    if (dep.type !== 'blocks' && dep.type !== 'parent-child') continue;
    const blocker = byId.get(dep.depends_on_id);
    if (blocker && isOpen(blocker)) return false;
  }

  return true;
}
