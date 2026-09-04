'use client';

import { useEffect, useState, type JSX } from 'react';
import { Icon } from '@/components/icons';
import { useStore } from '@/components/store';
import { Avatar, absoluteTime, relativeTime } from '@/components/ui';

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export default function HistoryPage(): JSX.Element {
  const { source } = useStore();
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const response = await fetch('/api/history', { cache: 'no-store' });
        const body = (await response.json()) as { commits?: Commit[]; error?: string };
        if (cancelled) return;
        if (!response.ok) setError(body.error ?? 'Could not load history');
        else setCommits(body.commits ?? []);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Network error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="view-header">
        <div className="view-title">
          <Icon.History size={15} style={{ color: 'var(--text-tertiary)' }} />
          Database history
        </div>
        {commits ? <span className="count-badge">{commits.length}</span> : null}
        <div className="view-header-spacer" />
        {source ? (
          <a
            className="btn is-ghost"
            href={`https://github.com/${source.owner}/${source.repo}/commits/${source.branch}/${source.path}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Icon.Github size={13} /> View on GitHub
          </a>
        ) : null}
      </header>

      {error ? (
        <div className="empty">
          <h2>Could not load history</h2>
          <p>{error}</p>
        </div>
      ) : !commits ? (
        <div className="list-scroll">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton-row" key={index}>
              <div className="skeleton-bar" style={{ width: 20, height: 20, borderRadius: 10 }} />
              <div className="skeleton-bar" style={{ width: `${40 + ((index * 11) % 30)}%` }} />
            </div>
          ))}
        </div>
      ) : commits.length === 0 ? (
        <div className="empty">
          <h2>No commits yet</h2>
          <p>Every write from this app lands here as a commit on the data branch.</p>
        </div>
      ) : (
        <div className="list-scroll">
          {commits.map((commit) => (
            <a
              key={commit.sha}
              className="issue-row"
              href={commit.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Avatar name={commit.author} />
              <span className="issue-title">{commit.message}</span>
              <span className="issue-meta">
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-quaternary)',
                  }}
                >
                  {commit.sha.slice(0, 7)}
                </code>
                <span className="issue-date" title={absoluteTime(commit.date)}>
                  {relativeTime(commit.date)}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
