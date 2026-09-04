'use client';

import type { JSX } from 'react';
import { isOpen, isReady } from '@/lib/beads';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function BlockedPage(): JSX.Element {
  return (
    <IssueView
      title="Blocked"
      icon={<Icon.Blocked size={15} style={{ color: 'var(--text-tertiary)' }} />}
      select={(issue, byId) => isOpen(issue) && !isReady(issue, byId)}
      emptyHint="Nothing is waiting on an open dependency."
    />
  );
}
