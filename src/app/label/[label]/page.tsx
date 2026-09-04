'use client';

import { use, type JSX } from 'react';
import { IssueView } from '@/components/IssueView';
import { Icon } from '@/components/icons';

export default function LabelPage({
  params,
}: {
  params: Promise<{ label: string }>;
}): JSX.Element {
  const { label } = use(params);
  const decoded = decodeURIComponent(label);

  return (
    <IssueView
      title={decoded}
      icon={<Icon.Label size={15} style={{ color: 'var(--text-tertiary)' }} />}
      select={(issue) => (issue.labels ?? []).includes(decoded)}
      emptyHint={`Nothing is labelled ${decoded}.`}
    />
  );
}
