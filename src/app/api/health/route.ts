import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness only — deliberately does not touch GitHub, so a rate limit or a
 * GitHub outage cannot make Kubernetes restart otherwise-healthy pods.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: true, service: 'beads-linear' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
