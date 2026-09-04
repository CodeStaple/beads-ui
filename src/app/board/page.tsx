'use client';

import type { JSX } from 'react';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function BoardPage(): JSX.Element {
  return (
    <IssueView
      title="Board"
      icon={<Icon.Board size={15} style={{ color: 'var(--text-tertiary)' }} />}
      defaultLayout="board"
    />
  );
}
