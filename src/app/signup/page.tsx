'use client';

import { useState, type FormEvent, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { postJson } from '@/lib/client-auth';

export default function SignupPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await postJson('/api/auth/signup', {
      email,
      password,
      name: name || undefined,
      orgName: orgName || undefined,
    });

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    router.replace(result.next ?? '/onboarding');
    router.refresh();
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-mark">beads</div>
        <h1 className="auth-title">Create your workspace</h1>
        <p className="auth-subtitle">
          You get your own organisation. Next you will connect GitHub and pick the repository
          that stores your issues.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              className="auth-input"
              autoComplete="name"
              placeholder="Optional"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="org">Workspace name</label>
            <input
              id="org"
              className="auth-input"
              placeholder="Optional — defaults to your name"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="auth-actions">
            <button className="auth-button" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create workspace'}
            </button>
          </div>
        </form>

        <p className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
