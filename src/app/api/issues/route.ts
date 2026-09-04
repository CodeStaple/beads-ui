import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createIssue } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcher } from '@/lib/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(100_000).optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  issue_type: z.string().optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  design: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  notes: z.string().optional(),
  actor: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const { value, database } = await createIssue(parsed.data);
    watcher.publish(database);

    return NextResponse.json({ issue: value, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
