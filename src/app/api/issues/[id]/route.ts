import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { deleteIssue, updateIssue } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcher } from '@/lib/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(100_000).optional(),
  design: z.string().max(100_000).optional(),
  acceptance_criteria: z.string().max(100_000).optional(),
  notes: z.string().max(100_000).optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  issue_type: z.string().optional(),
  assignee: z.string().optional(),
  owner: z.string().optional(),
  labels: z.array(z.string()).optional(),
  close_reason: z.string().optional(),
  due_at: z.string().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const { value, database } = await updateIssue(id, parsed.data);
    watcher.publish(database);

    return NextResponse.json({ issue: value, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const { database } = await deleteIssue(id);
    watcher.publish(database);

    return NextResponse.json({ ok: true, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
