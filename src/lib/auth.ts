import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { promisify } from 'node:util';
import { store, type Org, type User } from './store';
import { sessionCookieName, verify } from './session';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<{
  hash: string;
  salt: string;
}> {
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return { hash: derived.toString('hex'), salt };
}

export async function verifyPassword(password: string, user: User): Promise<boolean> {
  const derived = (await scryptAsync(password, user.passwordSalt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(user.passwordHash, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'workspace';
}

export interface SignupInput {
  email: string;
  password: string;
  name?: string;
  orgName?: string;
}

/** Every signup gets its own organisation; there is no shared default tenant. */
export async function createAccount(input: SignupInput): Promise<{ user: User; org: Org }> {
  const email = input.email.trim().toLowerCase();
  const existing = await store.findUserByEmail(email);
  if (existing) throw new AuthError('An account with that email already exists', 409);

  const { hash, salt } = await hashPassword(input.password);
  const name = input.name?.trim() || email.split('@')[0] || 'there';
  const orgName = input.orgName?.trim() || `${name}'s workspace`;

  return store.update((data) => {
    const userId = randomUUID();
    const orgId = randomUUID();
    const now = new Date().toISOString();

    const org: Org = {
      id: orgId,
      name: orgName,
      slug: slugify(orgName),
      ownerUserId: userId,
      createdAt: now,
      github: null,
      repo: null,
    };

    const user: User = {
      id: userId,
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      orgId,
      createdAt: now,
      passkeys: [],
      registrationChallenge: null,
    };

    data.orgs.push(org);
    data.users.push(user);
    return { user, org };
  });
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const payload = await verify(jar.get(sessionCookieName)?.value);
  if (!payload) return null;
  return store.findUserById(payload.userId);
}

export interface Principal {
  user: User;
  org: Org;
}

export async function requirePrincipal(): Promise<Principal> {
  const user = await currentUser();
  if (!user) throw new AuthError('Sign in to continue');

  const org = await store.findOrgById(user.orgId);
  if (!org) throw new AuthError('Your organisation is missing', 500);

  return { user, org };
}

export function publicUser(user: User, org: Org): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passkeys: user.passkeys.map((passkey) => ({
      id: passkey.id,
      label: passkey.label,
      createdAt: passkey.createdAt,
      lastUsedAt: passkey.lastUsedAt,
    })),
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      github: org.github
        ? { login: org.github.login, method: org.github.method, connectedAt: org.github.connectedAt }
        : null,
      repo: org.repo,
    },
  };
}
