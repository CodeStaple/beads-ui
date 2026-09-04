import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, publicUser, requirePrincipal } from '@/lib/auth';
import { identify } from '@/lib/githubAccount';
import { store } from '@/lib/store';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(20, 'That does not look like a GitHub token') });

/**
 * Connect the organisation's GitHub identity. A token is verified against
 * `/user` before it is stored, so a typo fails here rather than at first write.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, org } = await requirePrincipal();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid token', code: 'invalid' },
        { status: 400 },
      );
    }

    const token = parsed.data.token.trim();
    const identity = await identify(token);

    await store.update((data) => {
      const target = data.orgs.find((candidate) => candidate.id === org.id);
      if (!target) return;
      target.github = {
        token,
        login: identity.login,
        method: 'pat',
        connectedAt: new Date().toISOString(),
        scopes: identity.scopes,
      };
    });

    const fresh = await store.findOrgById(org.id);
    return NextResponse.json(
      { user: fresh ? publicUser(user, fresh) : null },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const { user, org } = await requirePrincipal();

    await store.update((data) => {
      const target = data.orgs.find((candidate) => candidate.id === org.id);
      if (!target) return;
      target.github = null;
      target.repo = null;
    });

    const fresh = await store.findOrgById(org.id);
    return NextResponse.json({ user: fresh ? publicUser(user, fresh) : null }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}
