'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export interface AuthResult {
  next?: string;
  error?: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function postJson(path: string, body: unknown): Promise<AuthResult> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) return { error: await readError(response) };
  return (await response.json()) as AuthResult;
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);
}

/** Sign in with a passkey; the browser picks the credential, so no email needed. */
export async function signInWithPasskey(): Promise<AuthResult> {
  const optionsResponse = await fetch('/api/auth/passkey/login', { cache: 'no-store' });
  if (!optionsResponse.ok) return { error: await readError(optionsResponse) };

  const options = await optionsResponse.json();
  const assertion = await startAuthentication({ optionsJSON: options });
  return postJson('/api/auth/passkey/login', { response: assertion });
}

export async function addPasskey(label: string): Promise<AuthResult> {
  const optionsResponse = await fetch('/api/auth/passkey/register', { cache: 'no-store' });
  if (!optionsResponse.ok) return { error: await readError(optionsResponse) };

  const options = await optionsResponse.json();
  const attestation = await startRegistration({ optionsJSON: options });
  return postJson('/api/auth/passkey/register', { response: attestation, label });
}
