import type { Issue } from './beads';
import { parseJsonl, serializeJsonl } from './beads';

/**
 * A new workspace opens on a worked example rather than an empty list: three
 * issues that show status, priority and a dependency edge in one glance.
 */
export function exampleIssues(prefix: string, actor: string): Issue[] {
  const now = new Date().toISOString();
  const id = (suffix: string): string => `${prefix}-${suffix}`;

  const base = {
    _type: 'issue' as const,
    created_at: now,
    updated_at: now,
    assignee: actor,
  };

  return [
    {
      ...base,
      id: id('001'),
      title: 'Welcome to your beads tracker',
      status: 'open',
      priority: 1,
      issue_type: 'task',
      description:
        'Every issue here is one line of JSONL in your own GitHub repository.\n\n' +
        'Editing an issue in this UI commits to that file, so the tracker has a full ' +
        'git history and works offline with the `bd` CLI.\n\n' +
        'Press **C** to create an issue, **⌘K** for the command palette.',
      labels: ['welcome'],
    },
    {
      ...base,
      id: id('002'),
      title: 'Invite the rest of your team',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      description:
        'Anyone you add as a collaborator on the GitHub repository can work the same ' +
        'tracker from the `bd` CLI. Sign-in here is per person, with a password and a passkey.',
      labels: ['welcome'],
    },
    {
      ...base,
      id: id('003'),
      title: 'Close this issue to see the board update live',
      status: 'in_progress',
      priority: 2,
      issue_type: 'task',
      description:
        'This issue depends on the welcome issue, so it shows how dependency edges render. ' +
        'Change its status and the change is committed to GitHub and streamed back to every ' +
        'open tab.',
      labels: ['welcome'],
      dependencies: [{ issue_id: id('003'), depends_on_id: id('001'), type: 'blocks' }],
    },
  ];
}

export function exampleJsonl(prefix: string, actor: string): string {
  const content = serializeJsonl(exampleIssues(prefix, actor));

  // The seed is written straight to a new workspace's database, so a line the
  // parser would reject must fail here rather than silently vanish from the
  // board. A missing dependency `issue_id` did exactly that once.
  const { issues, skipped } = parseJsonl(content);
  if (skipped > 0 || issues.length !== exampleIssues(prefix, actor).length) {
    throw new Error(`Seed data is not valid beads JSONL (${skipped} line(s) rejected)`);
  }

  return content;
}
