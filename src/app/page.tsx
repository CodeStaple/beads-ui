'use client';

import type { JSX } from 'react';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function AllIssuesPage(): JSX.Element {
  return (
    <IssueView
      title="All issues"
      icon={<Icon.Issues size={15} style={{ color: 'var(--text-tertiary)' }} />}
      emptyHint="The JSONL database on GitHub has no open issues. Press C to create the first one."
    />
  );
}
