'use client';

import type { JSX } from 'react';
import { isReady } from '@/lib/beads';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function ReadyPage(): JSX.Element {
  return (
    <IssueView
      title="Ready"
      icon={<Icon.Inbox size={15} style={{ color: 'var(--text-tertiary)' }} />}
      select={(issue, byId) => isReady(issue, byId)}
      emptyHint="Nothing is unblocked right now — the same set `bd ready` would print."
    />
  );
}
