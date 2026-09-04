import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { store, type User } from './store';

const RP_NAME = 'beads';

/**
 * The relying-party id must be the site's registered domain and the origin must
 * match exactly, or the browser refuses the ceremony. Both are derived from the
 * public URL so a deployment behind a different hostname works without a code
 * change.
 */
export function relyingParty(requestOrigin: string | null): { id: string; origin: string } {
  const configuredOrigin = process.env['WEBAUTHN_ORIGIN']?.trim() || requestOrigin || '';
  const configuredId = process.env['WEBAUTHN_RP_ID']?.trim();

  if (configuredId) return { id: configuredId, origin: configuredOrigin };

  try {
    return { id: new URL(configuredOrigin).hostname, origin: configuredOrigin };
  } catch {
    return { id: 'localhost', origin: configuredOrigin || 'http://localhost:4311' };
  }
}

export async function registrationOptions(
  user: User,
  origin: string | null,
): Promise<Record<string, unknown>> {
  const rp = relyingParty(origin);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((passkey) => ({ id: passkey.id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await store.update((data) => {
    const target = data.users.find((candidate) => candidate.id === user.id);
    if (target) target.registrationChallenge = options.challenge;
  });

  return options as unknown as Record<string, unknown>;
}

export async function confirmRegistration(
  user: User,
  response: RegistrationResponseJSON,
  label: string,
  origin: string | null,
): Promise<void> {
  const rp = relyingParty(origin);
  const expectedChallenge = user.registrationChallenge;
  if (!expectedChallenge) throw new Error('Start the passkey registration again');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('That passkey could not be verified');
  }

  const { credential } = verification.registrationInfo;

  await store.update((data) => {
    const target = data.users.find((candidate) => candidate.id === user.id);
    if (!target) return;

    target.registrationChallenge = null;
    target.passkeys.push({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      label: label.trim() || 'Passkey',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });
  });
}

export async function authenticationOptions(
  origin: string | null,
): Promise<{ options: Record<string, unknown>; challengeId: string }> {
  const rp = relyingParty(origin);

  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: 'preferred',
  });

  const challengeId = crypto.randomUUID();
  await store.update((data) => {
    data.loginChallenges.push({
      id: challengeId,
      challenge: options.challenge,
      createdAt: Date.now(),
    });
  });

  return { options: options as unknown as Record<string, unknown>, challengeId };
}

/**
 * Discoverable credentials mean the browser tells us which passkey was used, so
 * the user never has to type an email to sign in.
 */
export async function confirmAuthentication(
  response: AuthenticationResponseJSON,
  challengeId: string,
  origin: string | null,
): Promise<User> {
  const rp = relyingParty(origin);
  const snapshot = await store.snapshot();
  const pending = snapshot.loginChallenges.find((entry) => entry.id === challengeId);
  if (!pending) throw new Error('That sign-in attempt expired — try again');

  const user = await store.findUserByCredentialId(response.id);
  if (!user) throw new Error('That passkey is not registered here');

  const passkey = user.passkeys.find((candidate) => candidate.id === response.id);
  if (!passkey) throw new Error('That passkey is not registered here');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: false,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
      counter: passkey.counter,
      transports: passkey.transports as never,
    },
  });

  if (!verification.verified) throw new Error('That passkey could not be verified');

  await store.update((data) => {
    data.loginChallenges = data.loginChallenges.filter((entry) => entry.id !== challengeId);
    const target = data.users.find((candidate) => candidate.id === user.id);
    const credential = target?.passkeys.find((candidate) => candidate.id === response.id);
    if (credential) {
      credential.counter = verification.authenticationInfo.newCounter;
      credential.lastUsedAt = new Date().toISOString();
    }
  });

  return user;
}
