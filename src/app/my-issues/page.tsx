'use client';

import type { JSX } from 'react';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';
import { useStore } from '@/components/store';

export default function MyIssuesPage(): JSX.Element {
  const { issues } = useStore();

  // Without an auth layer, "mine" means the most frequent assignee in the file.
  const me = (() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      const name = issue.assignee ?? issue.owner;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  })();

  return (
    <IssueView
      title={me ? `My issues · ${me}` : 'My issues'}
      icon={<Icon.MyIssues size={15} style={{ color: 'var(--text-tertiary)' }} />}
      select={(issue) => Boolean(me) && (issue.assignee ?? issue.owner) === me}
      emptyHint="No issues are assigned to you."
    />
  );
}
