'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import type { Issue } from '@/lib/beads';

export type ConnectionState = 'connecting' | 'live' | 'syncing' | 'error';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

export interface SourceMeta {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

interface StoreValue {
  issues: Issue[];
  byId: ReadonlyMap<string, Issue>;
  connection: ConnectionState;
  source: SourceMeta | null;
  sha: string | null;
  error: string | null;
  ready: boolean;
  toasts: Toast[];
  notify: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  refresh: () => Promise<void>;
  createIssue: (input: Record<string, unknown>) => Promise<Issue | null>;
  updateIssue: (id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteIssue: (id: string) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  linkDependency: (id: string, dependsOn: string, type: string) => Promise<void>;
  unlinkDependency: (id: string, dependsOn: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [source, setSource] = useState<SourceMeta | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toastSeq = useRef(0);
  const inflight = useRef(0);

  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = (toastSeq.current += 1);
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const settle = useCallback(() => {
    inflight.current = Math.max(0, inflight.current - 1);
    if (inflight.current === 0) setConnection((c) => (c === 'syncing' ? 'live' : c));
  }, []);

  const begin = useCallback(() => {
    inflight.current += 1;
    setConnection('syncing');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/db', { cache: 'no-store' });
      if (!response.ok) {
        setError(await readError(response));
        setConnection('error');
        setReady(true);
        return;
      }

      const body = (await response.json()) as {
        issues: Issue[];
        sha: string | null;
        source: SourceMeta;
      };

      setIssues(body.issues);
      setSha(body.sha);
      setSource(body.source);
      setError(null);
      setConnection('live');
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Network error');
      setConnection('error');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates: the server pushes a fresh snapshot whenever the GitHub blob
  // sha changes, whether this app or `bd` + `git push` caused it.
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const connect = (): void => {
      if (closed) return;
      source = new EventSource('/api/stream');

      source.addEventListener('open', () => {
        attempt = 0;
        setConnection((current) => (current === 'error' ? 'live' : current));
      });

      source.addEventListener('snapshot', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent<string>).data) as {
            issues: Issue[];
            sha: string | null;
          };
          setIssues(payload.issues);
          setSha(payload.sha);
          setError(null);
          setReady(true);
          if (inflight.current === 0) setConnection('live');
        } catch {
          // A malformed frame is not worth tearing the stream down for.
        }
      });

      source.addEventListener('error', () => {
        source?.close();
        if (closed) return;
        setConnection('error');
        attempt += 1;
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt, 20_000));
      });
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  const applyLocal = useCallback((updated: Issue) => {
    setIssues((current) => {
      const index = current.findIndex((issue) => issue.id === updated.id);
      if (index === -1) return [...current, updated];
      const copy = [...current];
      copy[index] = updated;
      return copy;
    });
  }, []);

  const createIssue = useCallback(
    async (input: Record<string, unknown>): Promise<Issue | null> => {
      begin();
      try {
        const response = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          notify(await readError(response), 'error');
          return null;
        }

        const body = (await response.json()) as { issue: Issue };
        applyLocal(body.issue);
        notify(`Created ${body.issue.id}`);
        return body.issue;
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Create failed', 'error');
        return null;
      } finally {
        settle();
      }
    },
    [applyLocal, begin, notify, settle],
  );

  const updateIssue = useCallback(
    async (id: string, patch: Record<string, unknown>): Promise<void> => {
      // Optimistic: paint the change now, reconcile when GitHub confirms.
      const previous = issues.find((issue) => issue.id === id);
      if (previous) applyLocal({ ...previous, ...patch } as Issue);

      begin();
      try {
        const response = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          if (previous) applyLocal(previous);
          notify(await readError(response), 'error');
          return;
        }

        const body = (await response.json()) as { issue: Issue };
        applyLocal(body.issue);
      } catch (cause) {
        if (previous) applyLocal(previous);
        notify(cause instanceof Error ? cause.message : 'Update failed', 'error');
      } finally {
        settle();
      }
    },
    [applyLocal, begin, issues, notify, settle],
  );

  const deleteIssue = useCallback(
    async (id: string): Promise<void> => {
      begin();
      try {
        const response = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          notify(await readError(response), 'error');
          return;
        }
        setIssues((current) => current.filter((issue) => issue.id !== id));
        notify(`Deleted ${id}`);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Delete failed', 'error');
      } finally {
        settle();
      }
    },
    [begin, notify, settle],
  );

  const addComment = useCallback(
    async (id: string, text: string): Promise<void> => {
      begin();
      try {
        const response = await fetch(`/api/issues/${encodeURIComponent(id)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) {
          notify(await readError(response), 'error');
          return;
        }
        const body = (await response.json()) as { issue: Issue };
        applyLocal(body.issue);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Comment failed', 'error');
      } finally {
        settle();
      }
    },
    [applyLocal, begin, notify, settle],
  );

  const linkDependency = useCallback(
    async (id: string, dependsOn: string, type: string): Promise<void> => {
      begin();
      try {
        const response = await fetch(`/api/issues/${encodeURIComponent(id)}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depends_on_id: dependsOn, type }),
        });
        if (!response.ok) {
          notify(await readError(response), 'error');
          return;
        }
        const body = (await response.json()) as { issue: Issue };
        applyLocal(body.issue);
        notify(`Linked ${id} → ${dependsOn}`);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Link failed', 'error');
      } finally {
        settle();
      }
    },
    [applyLocal, begin, notify, settle],
  );

  const unlinkDependency = useCallback(
    async (id: string, dependsOn: string): Promise<void> => {
      begin();
      try {
        const response = await fetch(
          `/api/issues/${encodeURIComponent(id)}/dependencies?depends_on_id=${encodeURIComponent(dependsOn)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) {
          notify(await readError(response), 'error');
          return;
        }
        const body = (await response.json()) as { issue: Issue };
        applyLocal(body.issue);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'Unlink failed', 'error');
      } finally {
        settle();
      }
    },
    [applyLocal, begin, notify, settle],
  );

  const byId = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) map.set(issue.id, issue);
    return map;
  }, [issues]);

  const value = useMemo<StoreValue>(
    () => ({
      issues,
      byId,
      connection,
      source,
      sha,
      error,
      ready,
      toasts,
      notify,
      dismiss,
      refresh,
      createIssue,
      updateIssue,
      deleteIssue,
      addComment,
      linkDependency,
      unlinkDependency,
    }),
    [
      addComment,
      byId,
      connection,
      createIssue,
      deleteIssue,
      dismiss,
      error,
      issues,
      linkDependency,
      notify,
      ready,
      refresh,
      sha,
      source,
      toasts,
      unlinkDependency,
      updateIssue,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
