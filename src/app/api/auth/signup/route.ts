import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, createAccount, publicUser } from '@/lib/auth';
import { cookieOptions, issue, sessionCookieName } from '@/lib/session';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters'),
  name: z.string().max(120).optional(),
  orgName: z.string().max(120).optional(),
});

/** Signing up creates the person and their organisation in one step. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const { user, org } = await createAccount(parsed.data);
    const response = NextResponse.json(
      { user: publicUser(user, org), next: '/onboarding' },
      { headers: noStore },
    );
    response.cookies.set(sessionCookieName, await issue(user.id), cookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}
