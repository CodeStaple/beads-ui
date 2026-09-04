import { NextResponse } from 'next/server';
import { ensureBranch, getRepoMeta, loadConfig, readFile, writeFile } from '@/lib/github';
import { describe } from '@/lib/db';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Reports whether the data branch and JSONL file exist yet. */
export async function GET(): Promise<NextResponse> {
  try {
    const config = loadConfig();
    const meta = await getRepoMeta(config);
    const snapshot = await readFile(config);

    return NextResponse.json(
      {
        source: describe(config),
        repo: meta,
        branchExists: snapshot.headSha !== null,
        fileExists: snapshot.sha !== null,
        bytes: snapshot.content.length,
      },
      { headers: noStore },
    );
  } catch (error) {
    return fail(error);
  }
}

/** Creates the data branch and an empty JSONL file when they are missing. */
export async function POST(): Promise<NextResponse> {
  try {
    const config = loadConfig();
    const branch = await ensureBranch(config);
    const snapshot = await readFile(config);

    if (snapshot.sha === null) {
      await writeFile(config, '', 'bd: initialise beads database', null);
      return NextResponse.json({ branch, file: 'created' }, { headers: noStore });
    }

    return NextResponse.json({ branch, file: 'exists' }, { headers: noStore });
  } catch (error) {
    return fail(error);
  }
}
