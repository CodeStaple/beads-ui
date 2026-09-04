import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { addComment } from '@/lib/db';
import { fail, noStore } from '@/lib/api';
import { watcher } from '@/lib/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(20_000),
  author: z.string().max(200).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const author = parsed.data.author ?? process.env['BEADS_ACTOR'] ?? 'beads-linear';
    const { value, database } = await addComment(id, parsed.data.text, author);
    watcher.publish(database);

    return NextResponse.json({ issue: value, sha: database.sha }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
