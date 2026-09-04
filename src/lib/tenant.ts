import { MissingConfigError, type GitHubConfig } from './github';
import { requirePrincipal, type Principal } from './auth';
import type { Org } from './store';

export class NotOnboardedError extends MissingConfigError {
  constructor(message = 'Finish connecting GitHub and choosing a repository first') {
    super(message);
    this.name = 'NotOnboardedError';
  }
}

/** The per-organisation view of "which JSONL file is the database". */
export function configForOrg(org: Org): GitHubConfig {
  if (!org.github) throw new NotOnboardedError('Connect GitHub to continue');
  if (!org.repo) throw new NotOnboardedError('Choose a repository to continue');

  return {
    owner: org.repo.owner,
    repo: org.repo.repo,
    branch: org.repo.branch,
    path: org.repo.path,
    token: org.github.token,
    committerName: 'beads-linear',
    committerEmail: 'beads-linear@users.noreply.github.com',
    prefix: org.repo.prefix,
    actor: 'beads-linear',
  };
}

export interface Tenant extends Principal {
  config: GitHubConfig;
}

/** Every data route resolves its tenant here, never from process env. */
export async function requireTenant(): Promise<Tenant> {
  const principal = await requirePrincipal();
  return { ...principal, config: configForOrg(principal.org) };
}
