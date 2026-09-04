import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, publicUser, requirePrincipal } from '@/lib/auth';
import { createRepository } from '@/lib/githubAccount';
import { ensureBranch, getRepoMeta, readFile, writeFile, type GitHubConfig } from '@/lib/github';
import { exampleJsonl } from '@/lib/seed';
import { store, type Org, type OrgRepo } from '@/lib/store';
import { fail, noStore } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_PATH = '.beads/issues.jsonl';

const schema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
    owner: z.string().max(100).optional(),
    private: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('connect'),
    owner: z.string().min(1),
    repo: z.string().min(1),
    branch: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    seed: z.boolean().optional(),
  }),
]);

/** A short, stable id prefix for issues this workspace creates. */
function prefixFor(org: Org): string {
  const candidate = org.slug.split('-')[0]?.replace(/[^a-z0-9]/g, '') ?? '';
  return (candidate || 'bd').slice(0, 8);
}

function configFor(token: string, repo: OrgRepo): GitHubConfig {
  return {
    owner: repo.owner,
    repo: repo.repo,
    branch: repo.branch,
    path: repo.path,
    token,
    committerName: 'beads-linear',
    committerEmail: 'beads-linear@users.noreply.github.com',
    prefix: repo.prefix,
    actor: 'beads-linear',
  };
}

/**
 * Point the organisation at its tracker. Creating a repository is the default
 * because it is the only path that can guarantee a working tracker in one
 * step: fresh repository, data branch, and a seeded file with three worked
 * examples so the board is never an empty page.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, org } = await requirePrincipal();
    if (!org.github) {
      return NextResponse.json(
        { error: 'Connect GitHub before choosing a repository', code: 'not_configured' },
        { status: 409 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload', code: 'invalid' },
        { status: 400 },
      );
    }

    const token = org.github.token;
    const prefix = prefixFor(org);
    let repo: OrgRepo;
    let seeded = false;

    if (parsed.data.mode === 'create') {
      const created = await createRepository(token, parsed.data.name, {
        private: parsed.data.private ?? true,
        org: parsed.data.owner && parsed.data.owner !== org.github.login ? parsed.data.owner : null,
        description: `beads tracker for ${org.name}`,
      });

      repo = {
        owner: created.owner,
        repo: created.name,
        branch: created.defaultBranch,
        path: DEFAULT_PATH,
        prefix,
        htmlUrl: created.htmlUrl,
        createdByApp: true,
        connectedAt: new Date().toISOString(),
      };

      await writeFile(
        configFor(token, repo),
        exampleJsonl(prefix, user.name),
        'bd: initialise beads database with example issues',
        null,
      );
      seeded = true;
    } else {
      const wanted: OrgRepo = {
        owner: parsed.data.owner,
        repo: parsed.data.repo,
        branch: parsed.data.branch?.trim() || '',
        path: parsed.data.path?.trim() || DEFAULT_PATH,
        prefix,
        htmlUrl: '',
        createdByApp: false,
        connectedAt: new Date().toISOString(),
      };

      const meta = await getRepoMeta(configFor(token, { ...wanted, branch: wanted.branch || 'main' }));
      wanted.branch = wanted.branch || meta.defaultBranch;
      wanted.htmlUrl = meta.htmlUrl;

      const config = configFor(token, wanted);
      await ensureBranch(config);

      const snapshot = await readFile(config);
      if (snapshot.sha === null) {
        // An existing repository with no tracker file yet still deserves a
        // starting point rather than an empty board.
        const content = parsed.data.seed === false ? '' : exampleJsonl(prefix, user.name);
        await writeFile(config, content, 'bd: initialise beads database', null);
        seeded = parsed.data.seed !== false;
      }

      repo = wanted;
    }

    await store.update((data) => {
      const target = data.orgs.find((candidate) => candidate.id === org.id);
      if (target) target.repo = repo;
    });

    const fresh = await store.findOrgById(org.id);
    return NextResponse.json(
      { user: fresh ? publicUser(user, fresh) : null, seeded },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
    }
    return fail(error);
  }
}
