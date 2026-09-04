'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { addPasskey, passkeysSupported, postJson } from '@/lib/client-auth';

interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
}

interface SessionUser {
  name: string;
  org: {
    name: string;
    github: { login: string } | null;
    repo: { owner: string; repo: string } | null;
  };
}

type Mode = 'create' | 'connect';

function suggestName(workspace: string): string {
  const slug = workspace
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `${slug}-beads` : 'beads-tracker';
}

export default function OnboardingPage(): JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<Mode>('create');
  const [repoName, setRepoName] = useState('');
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyState, setPasskeyState] = useState<'idle' | 'added'>('idle');

  const refresh = useCallback(async (): Promise<SessionUser | null> => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const body = (await response.json()) as { user: SessionUser | null };
    setUser(body.user);
    if (body.user && !repoName) setRepoName(suggestName(body.user.org.name));
    return body.user;
  }, [repoName]);

  useEffect(() => {
    void refresh();
    // Runs once: later refreshes are triggered by the actions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRepos = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/org/github/repos', { cache: 'no-store' });
    if (!response.ok) return;
    const body = (await response.json()) as { repositories: RepoSummary[] };
    setRepos(body.repositories);
  }, []);

  useEffect(() => {
    if (user?.org.github) void loadRepos();
  }, [user?.org.github, loadRepos]);

  const connectGitHub = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/org/github', { token: token.trim() });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setToken('');
    await refresh();
  };

  const finish = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const payload =
      mode === 'create'
        ? { mode: 'create', name: repoName.trim() }
        : (() => {
            const repo = repos.find((candidate) => candidate.fullName === selected);
            return repo
              ? { mode: 'connect', owner: repo.owner, repo: repo.name, branch: repo.defaultBranch }
              : null;
          })();

    if (!payload) {
      setError('Pick a repository to continue');
      setBusy(false);
      return;
    }

    const result = await postJson('/api/org/repo', payload);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    router.replace('/');
    router.refresh();
  };

  const onAddPasskey = async (): Promise<void> => {
    setError(null);
    try {
      const result = await addPasskey('This device');
      if (result.error) {
        setError(result.error);
        return;
      }
      setPasskeyState('added');
    } catch {
      setError('Passkey setup was cancelled');
    }
  };

  const connected = Boolean(user?.org.github);

  return (
    <div className="auth-screen">
      <div className="auth-card is-wide">
        <div className="auth-mark">beads</div>

        <div className="auth-steps">
          <div className="auth-step is-done" />
          <div className={`auth-step${connected ? ' is-done' : ''}`} />
        </div>

        {!connected ? (
          <>
            <h1 className="auth-title">Connect GitHub</h1>
            <p className="auth-subtitle">
              beads stores every issue as a line of JSONL in a repository you own. Paste a token
              with <strong>repo</strong> scope — a fine-grained token with read and write access to
              contents and administration works too.
            </p>

            {error ? <div className="auth-error">{error}</div> : null}

            <div className="auth-field">
              <label htmlFor="token">GitHub token</label>
              <textarea
                id="token"
                className="auth-input is-area"
                placeholder="ghp_… or github_pat_…"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>

            <div className="auth-note">
              Create one at <strong>github.com/settings/tokens</strong>. The token is stored against
              your organisation only, and is what commits issue changes on your behalf.
            </div>

            <div className="auth-actions">
              <button
                className="auth-button"
                type="button"
                onClick={connectGitHub}
                disabled={busy || token.trim().length < 20}
              >
                {busy ? 'Checking…' : 'Connect GitHub'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">Where should your issues live?</h1>
            <p className="auth-subtitle">
              Connected as <strong>{user?.org.github?.login}</strong>. Create a fresh repository —
              it comes seeded with three example issues — or point beads at one you already have.
            </p>

            {error ? <div className="auth-error">{error}</div> : null}

            <div className="choice-grid">
              <button
                type="button"
                className={`choice${mode === 'create' ? ' is-selected' : ''}`}
                onClick={() => setMode('create')}
              >
                <div className="choice-title">Create a new repository</div>
                <div className="choice-desc">
                  A private repository with <code>.beads/issues.jsonl</code> and three example
                  issues, ready to work immediately.
                </div>
              </button>

              <button
                type="button"
                className={`choice${mode === 'connect' ? ' is-selected' : ''}`}
                onClick={() => setMode('connect')}
              >
                <div className="choice-title">Connect an existing repository</div>
                <div className="choice-desc">
                  Already running <code>bd</code>? Point beads at that repository and it picks up
                  every issue already in it.
                </div>
              </button>
            </div>

            {mode === 'create' ? (
              <div className="auth-field" style={{ marginTop: 14 }}>
                <label htmlFor="repo">Repository name</label>
                <input
                  id="repo"
                  className="auth-input"
                  value={repoName}
                  onChange={(event) => setRepoName(event.target.value)}
                />
              </div>
            ) : (
              <div className="auth-field" style={{ marginTop: 14 }}>
                <label>Repository</label>
                <div className="repo-picker">
                  {repos.length === 0 ? (
                    <div className="repo-option">No repositories this token can write to.</div>
                  ) : (
                    repos.map((repo) => (
                      <button
                        key={repo.fullName}
                        type="button"
                        className={`repo-option${selected === repo.fullName ? ' is-selected' : ''}`}
                        onClick={() => setSelected(repo.fullName)}
                      >
                        <span>{repo.fullName}</span>
                        <span style={{ color: 'var(--text-quaternary)' }}>
                          {repo.private ? 'private' : 'public'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {passkeysSupported() ? (
              <div className="auth-note" style={{ marginTop: 14 }}>
                {passkeyState === 'added' ? (
                  <>Passkey added — you can sign in without your password next time.</>
                ) : (
                  <>
                    Optional: add a passkey now so you can sign in with Touch ID or your phone.{' '}
                    <button
                      type="button"
                      onClick={onAddPasskey}
                      style={{ color: 'var(--accent)' }}
                    >
                      Add a passkey
                    </button>
                  </>
                )}
              </div>
            ) : null}

            <div className="auth-actions">
              <button className="auth-button" type="button" onClick={finish} disabled={busy}>
                {busy ? 'Setting up…' : mode === 'create' ? 'Create and start' : 'Connect and start'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
