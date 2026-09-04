import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, publicUser, requirePrincipal } from '@/lib/auth';
import { confirmRegistration, registrationOptions } from '@/lib/passkeys';
import { store } from '@/lib/store';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function origin(request: NextRequest): string | null {
  return request.headers.get('origin') ?? request.nextUrl.origin ?? null;
}

/** Step one: a challenge the authenticator signs. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requirePrincipal();
    return NextResponse.json(await registrationOptions(user, origin(request)), { headers: noStore });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}

const schema = z.object({
  response: z.record(z.string(), z.unknown()),
  label: z.string().max(60).optional(),
});

/** Step two: store the credential once the signature checks out. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requirePrincipal();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid passkey payload', code: 'invalid' }, { status: 400 });
    }

    await confirmRegistration(
      user,
      parsed.data.response as never,
      parsed.data.label ?? 'Passkey',
      origin(request),
    );

    const fresh = await store.findUserById(user.id);
    const org = await store.findOrgById(user.orgId);
    return NextResponse.json(
      { user: fresh && org ? publicUser(fresh, org) : null },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}
