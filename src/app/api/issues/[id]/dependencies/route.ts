import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { linkDependency, unlinkDependency } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcherFor } from '@/lib/watcher';
import { requireTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const linkSchema = z.object({
  depends_on_id: z.string().min(1),
  type: z.enum(['blocks', 'related', 'parent-child', 'discovered-from']).default('blocks'),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { user, org, config } = await requireTenant();
    const { id } = await context.params;
    const parsed = linkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const { value, database } = await linkDependency(
      id,
      parsed.data.depends_on_id,
      parsed.data.type,
      user.name,
      config,
    );
    watcherFor(org.id, config).publish(database);

    return NextResponse.json({ issue: value, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { org, config } = await requireTenant();
    const { id } = await context.params;
    const target = new URL(request.url).searchParams.get('depends_on_id');
    if (!target) {
      return NextResponse.json(
        { error: 'depends_on_id is required', code: 'invalid' },
        { status: 400 },
      );
    }

    const { value, database } = await unlinkDependency(id, target, config);
    watcherFor(org.id, config).publish(database);

    return NextResponse.json({ issue: value, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
