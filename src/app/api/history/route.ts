import { NextResponse } from 'next/server';
import { listRecentCommits } from '@/lib/github';
import { fail, noStore } from '@/lib/api';
import { requireTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The commit log of the JSONL file — the database's own audit trail. */
export async function GET(): Promise<NextResponse> {
  try {
    const { config } = await requireTenant();
    const commits = await listRecentCommits(config, 20);
    return NextResponse.json({ commits }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
