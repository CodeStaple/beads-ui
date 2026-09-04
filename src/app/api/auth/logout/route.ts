import { NextResponse } from 'next/server';
import { cookieOptions, sessionCookieName } from '@/lib/session';
import { noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true }, { headers: noStore });
  response.cookies.set(sessionCookieName, '', { ...cookieOptions(0), maxAge: 0 });
  return response;
}
