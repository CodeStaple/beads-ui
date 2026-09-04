import { NextResponse } from 'next/server';
import { AuthError, requirePrincipal } from '@/lib/auth';
import { listOrganisations, listRepositories } from '@/lib/githubAccount';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Repositories the connected token can actually push to, plus its orgs. */
export async function GET(): Promise<NextResponse> {
  try {
    const { org } = await requirePrincipal();
    if (!org.github) {
      return NextResponse.json({ error: 'Connect GitHub first', code: 'not_configured' }, { status: 409 });
    }

    const [repositories, organisations] = await Promise.all([
      listRepositories(org.github.token),
      listOrganisations(org.github.token),
    ]);

    return NextResponse.json(
      { repositories, organisations, login: org.github.login },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}
