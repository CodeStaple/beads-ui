import { NextResponse } from 'next/server';
import { describe } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcherFor } from '@/lib/watcher';
import { requireTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const { org, config } = await requireTenant();
    const snapshot = await watcherFor(org.id, config).refresh();

    return NextResponse.json(
      {
        issues: snapshot.issues,
        sha: snapshot.sha,
        headSha: snapshot.headSha,
        skipped: snapshot.skipped,
        source: describe(config),
        at: snapshot.at,
      },
      { headers: noStore },
    );
  } catch (error) {
    return fail(error);
  }
}
