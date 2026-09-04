import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { publicUser, verifyPassword } from '@/lib/auth';
import { store } from '@/lib/store';
import { cookieOptions, issue, sessionCookieName } from '@/lib/session';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter your email and password', code: 'invalid' }, { status: 400 });
    }

    const user = await store.findUserByEmail(parsed.data.email);
    // The same message either way, so this cannot be used to enumerate accounts.
    const rejected = NextResponse.json(
      { error: 'That email and password do not match', code: 'auth' },
      { status: 401 },
    );
    if (!user) return rejected;
    if (!(await verifyPassword(parsed.data.password, user))) return rejected;

    const org = await store.findOrgById(user.orgId);
    if (!org) return NextResponse.json({ error: 'Your organisation is missing', code: 'auth' }, { status: 500 });

    const response = NextResponse.json(
      { user: publicUser(user, org), next: org.repo ? '/' : '/onboarding' },
      { headers: noStore },
    );
    response.cookies.set(sessionCookieName, await issue(user.id), cookieOptions());
    return response;
  } catch (error) {
    return fail(error);
  }
}
