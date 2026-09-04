'use client';

import { use, type JSX } from 'react';
import { IssueDetail } from '@/components/IssueDetail';

export default function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): JSX.Element {
  const { id } = use(params);
  return <IssueDetail id={decodeURIComponent(id)} />;
}
