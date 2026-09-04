import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  orgId: string;
  createdAt: string;
  passkeys: PasskeyCredential[];
  registrationChallenge: string | null;
}

export interface OrgGitHub {
  token: string;
  login: string;
  method: 'pat' | 'oauth';
  connectedAt: string;
  scopes: string | null;
}

export interface OrgRepo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  prefix: string;
  htmlUrl: string;
  createdByApp: boolean;
  connectedAt: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: string;
  github: OrgGitHub | null;
  repo: OrgRepo | null;
}

export interface LoginChallenge {
  id: string;
  challenge: string;
  createdAt: number;
}

interface StoreData {
  version: 1;
  users: User[];
  orgs: Org[];
  loginChallenges: LoginChallenge[];
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function emptyStore(): StoreData {
  return { version: 1, users: [], orgs: [], loginChallenges: [] };
}

export function dataFile(): string {
  return join(process.env['DATA_DIR']?.trim() || '/data', 'beads-ui.json');
}

/**
 * The tracker itself lives in GitHub; this file holds only what GitHub cannot:
 * who may sign in, and which repository each organisation is pointed at.
 * Writes are serialised in-process and land through a rename, so a crash
 * mid-write leaves the previous file intact rather than a truncated one.
 */
class Store {
  private cache: StoreData | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<StoreData> {
    if (this.cache) return this.cache;

    try {
      const raw = await readFile(dataFile(), 'utf8');
      const parsed = JSON.parse(raw) as StoreData;
      this.cache = {
        version: 1,
        users: parsed.users ?? [],
        orgs: parsed.orgs ?? [],
        loginChallenges: parsed.loginChallenges ?? [],
      };
    } catch {
      this.cache = emptyStore();
    }

    return this.cache;
  }

  private async persist(data: StoreData): Promise<void> {
    const target = dataFile();
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(temporary, target);
    this.cache = data;
  }

  async snapshot(): Promise<StoreData> {
    return this.read();
  }

  /** Serialises every mutation so two requests cannot clobber each other. */
  async update<T>(mutator: (data: StoreData) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const cutoff = Date.now() - CHALLENGE_TTL_MS;
      data.loginChallenges = data.loginChallenges.filter((entry) => entry.createdAt > cutoff);
      const result = await mutator(data);
      await this.persist(data);
      return result;
    });

    this.queue = run.catch(() => undefined);
    return run;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const data = await this.read();
    const wanted = email.trim().toLowerCase();
    return data.users.find((user) => user.email === wanted) ?? null;
  }

  async findUserById(id: string): Promise<User | null> {
    const data = await this.read();
    return data.users.find((user) => user.id === id) ?? null;
  }

  async findUserByCredentialId(credentialId: string): Promise<User | null> {
    const data = await this.read();
    return (
      data.users.find((user) =>
        user.passkeys.some((passkey) => passkey.id === credentialId),
      ) ?? null
    );
  }

  async findOrgById(id: string): Promise<Org | null> {
    const data = await this.read();
    return data.orgs.find((org) => org.id === id) ?? null;
  }

  async userCount(): Promise<number> {
    return (await this.read()).users.length;
  }
}

const globalKey = Symbol.for('beads-linear.store');
type GlobalWithStore = typeof globalThis & { [globalKey]?: Store };

export const store: Store =
  (globalThis as GlobalWithStore)[globalKey] ??
  ((globalThis as GlobalWithStore)[globalKey] = new Store());
