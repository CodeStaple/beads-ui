import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticationOptions, confirmAuthentication } from '@/lib/passkeys';
import { publicUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { cookieOptions, issue, sessionCookieName } from '@/lib/session';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHALLENGE_COOKIE = 'beads_passkey_challenge';

function origin(request: NextRequest): string | null {
  return request.headers.get('origin') ?? request.nextUrl.origin ?? null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { options, challengeId } = await authenticationOptions(origin(request));
    const response = NextResponse.json(options, { headers: noStore });
    response.cookies.set(CHALLENGE_COOKIE, challengeId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 300,
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}

const schema = z.object({ response: z.record(z.string(), z.unknown()) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const challengeId = request.cookies.get(CHALLENGE_COOKIE)?.value;
    if (!challengeId) {
      return NextResponse.json(
        { error: 'That sign-in attempt expired — try again', code: 'auth' },
        { status: 400 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid passkey payload', code: 'invalid' }, { status: 400 });
    }

    const user = await confirmAuthentication(
      parsed.data.response as never,
      challengeId,
      origin(request),
    );
    const org = await store.findOrgById(user.orgId);
    if (!org) {
      return NextResponse.json({ error: 'Your organisation is missing', code: 'auth' }, { status: 500 });
    }

    const response = NextResponse.json(
      { user: publicUser(user, org), next: org.repo ? '/' : '/onboarding' },
      { headers: noStore },
    );
    response.cookies.set(sessionCookieName, await issue(user.id), cookieOptions());
    response.cookies.set(CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Passkey sign-in failed';
    return NextResponse.json({ error: message, code: 'auth' }, { status: 401 });
  }
}
