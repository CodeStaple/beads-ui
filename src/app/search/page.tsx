'use client';

import type { JSX } from 'react';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function SearchPage(): JSX.Element {
  return (
    <IssueView
      title="Search"
      icon={<Icon.Search size={15} style={{ color: 'var(--text-tertiary)' }} />}
      showClosedByDefault
      emptyHint="Type in the filter box to search titles, ids, descriptions and labels."
    />
  );
}
