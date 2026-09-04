import { NextResponse } from 'next/server';
import { describe } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcher } from '@/lib/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const snapshot = await watcher.refresh();
    return NextResponse.json(
      {
        issues: snapshot.issues,
        sha: snapshot.sha,
        headSha: snapshot.headSha,
        skipped: snapshot.skipped,
        source: describe(),
        at: snapshot.at,
      },
      { headers: noStore },
    );
  } catch (error) {
    return fail(error);
  }
}
