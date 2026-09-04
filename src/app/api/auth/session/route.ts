import { NextResponse } from 'next/server';
import { currentUser, publicUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Who am I, and how far through onboarding is my organisation. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { user: null, hasAccounts: (await store.userCount()) > 0 },
        { headers: noStore },
      );
    }

    const org = await store.findOrgById(user.orgId);
    if (!org) return NextResponse.json({ user: null }, { headers: noStore });

    return NextResponse.json({ user: publicUser(user, org) }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
