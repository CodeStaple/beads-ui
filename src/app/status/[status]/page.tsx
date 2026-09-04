'use client';

import { use, type JSX } from 'react';
import { statusMeta } from '@/lib/beads';
import { IssueView } from '@/components/IssueView';
import { StatusIcon } from '@/components/icons';

export default function StatusPage({
  params,
}: {
  params: Promise<{ status: string }>;
}): JSX.Element {
  const { status } = use(params);

  return (
    <IssueView
      title={statusMeta(status).label}
      icon={<StatusIcon status={status} size={15} />}
      select={(issue) => issue.status === status}
      emptyHint={`No issues are ${statusMeta(status).label.toLowerCase()}.`}
    />
  );
}
