'use client';

import { Suspense, useState, type FormEvent, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { passkeysSupported, postJson, signInWithPasskey } from '@/lib/client-auth';

function LoginForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'passkey' | null>(null);

  const destination = (fallback: string): string => params.get('next') || fallback;

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy('password');
    setError(null);

    const result = await postJson('/api/auth/login', { email, password });
    if (result.error) {
      setError(result.error);
      setBusy(null);
      return;
    }

    router.replace(destination(result.next ?? '/'));
    router.refresh();
  };

  const onPasskey = async (): Promise<void> => {
    setBusy('passkey');
    setError(null);

    try {
      const result = await signInWithPasskey();
      if (result.error) {
        setError(result.error);
        setBusy(null);
        return;
      }
      router.replace(destination(result.next ?? '/'));
      router.refresh();
    } catch {
      // A cancelled prompt is not an error worth shouting about.
      setError('Passkey sign-in was cancelled');
      setBusy(null);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-mark">beads</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Your issues live in your own GitHub repository.</p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="username webauthn"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="auth-actions">
            <button className="auth-button" type="submit" disabled={busy !== null}>
              {busy === 'password' ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        {passkeysSupported() ? (
          <>
            <div className="auth-divider">or</div>
            <button
              className="auth-button is-secondary"
              type="button"
              onClick={onPasskey}
              disabled={busy !== null}
            >
              {busy === 'passkey' ? 'Waiting for your device…' : 'Sign in with a passkey'}
            </button>
          </>
        ) : null}

        <p className="auth-foot">
          New here? <Link href="/signup">Create a workspace</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="auth-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
