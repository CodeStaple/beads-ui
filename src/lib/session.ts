/**
 * Session cookies are signed with Web Crypto only, so this module is safe to
 * import from Next.js middleware (edge runtime) as well as from node routes.
 * Node's `crypto` module must never appear here.
 */

const COOKIE_NAME = 'beads_session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function secretMaterial(): string {
  const secret = process.env['SESSION_SECRET']?.trim();
  if (secret && secret.length >= 16) return secret;

  // A missing secret must not silently downgrade to a guessable one in
  // production; in development a per-process value keeps `next dev` usable.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required (at least 16 characters)');
  }
  return 'development-only-session-secret';
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretMaterial()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function sign(payload: SessionPayload): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verify(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await key(),
      base64UrlDecode(signature),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload;
    if (typeof payload.userId !== 'string' || typeof payload.expiresAt !== 'number') return null;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function issue(userId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  return sign({ userId, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export const sessionCookieName = COOKIE_NAME;

export function cookieOptions(maxAgeSeconds = DEFAULT_TTL_SECONDS): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
