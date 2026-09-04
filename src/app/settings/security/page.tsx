'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { addPasskey, passkeysSupported } from '@/lib/client-auth';

interface Passkey {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface SessionUser {
  email: string;
  name: string;
  passkeys: Passkey[];
  org: { name: string; github: { login: string } | null; repo: { owner: string; repo: string } | null };
}

export default function SecuritySettingsPage(): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const body = (await response.json()) as { user: SessionUser | null };
    setUser(body.user);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await addPasskey('This device');
      if (result.error) setError(result.error);
      else await refresh();
    } catch {
      setError('Passkey setup was cancelled');
    }
    setBusy(false);
  };

  const signOut = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="settings-page">
      <div className="settings-section">
        <div className="settings-heading">Account</div>
        <div className="settings-sub">
          {user ? `${user.name} · ${user.email}` : 'Loading…'}
        </div>
        <div className="settings-sub">
          Workspace <strong>{user?.org.name}</strong>
          {user?.org.repo ? ` · ${user.org.repo.owner}/${user.org.repo.repo}` : ''}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-heading">Passkeys</div>
        <div className="settings-sub">
          A passkey signs you in with Touch ID, Windows Hello or your phone instead of a password.
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        {(user?.passkeys ?? []).map((passkey) => (
          <div className="passkey-row" key={passkey.id}>
            <span>{passkey.label}</span>
            <span style={{ color: 'var(--text-quaternary)' }}>
              {passkey.lastUsedAt
                ? `last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}`
                : `added ${new Date(passkey.createdAt).toLocaleDateString()}`}
            </span>
          </div>
        ))}

        {user && user.passkeys.length === 0 ? (
          <div className="settings-sub">No passkeys yet.</div>
        ) : null}

        {passkeysSupported() ? (
          <div className="auth-actions" style={{ maxWidth: 220 }}>
            <button className="auth-button is-secondary" type="button" onClick={onAdd} disabled={busy}>
              {busy ? 'Waiting for your device…' : 'Add a passkey'}
            </button>
          </div>
        ) : (
          <div className="settings-sub">This browser does not support passkeys.</div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-heading">Session</div>
        <div className="auth-actions" style={{ maxWidth: 220 }}>
          <button className="auth-button is-secondary" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
