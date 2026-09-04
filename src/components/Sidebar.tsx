'use client';

import { useMemo, useState, type JSX, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isOpen, isReady, statusMeta } from '@/lib/beads';
import { Icon, StatusIcon, TypeIcon } from './icons';
import { useStore } from './store';
import { labelColor } from './ui';

function NavLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  count?: number;
}): JSX.Element {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} className={`nav-item${active ? ' is-active' : ''}`}>
      {icon}
      <span className="nav-item-label">{label}</span>
      {count !== undefined ? <span className="nav-item-count">{count}</span> : null}
    </Link>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="nav-section">
      <button
        type="button"
        className={`nav-section-header${open ? '' : ' is-collapsed'}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="chevron" style={{ display: 'inline-flex' }}>
          <Icon.Chevron size={12} />
        </span>
        {title}
      </button>
      {open ? children : null}
    </div>
  );
}

export function Sidebar({ onOpenCreate }: { onOpenCreate: () => void }): JSX.Element {
  const { issues, byId, connection, source, sha } = useStore();

  const stats = useMemo(() => {
    const open = issues.filter(isOpen);
    const ready = open.filter((issue) => isReady(issue, byId));
    const blocked = open.filter((issue) => !isReady(issue, byId));

    const labels = new Map<string, number>();
    for (const issue of open) {
      for (const label of issue.labels ?? []) {
        labels.set(label, (labels.get(label) ?? 0) + 1);
      }
    }

    const epics = issues.filter((issue) => issue.issue_type === 'epic');

    return {
      total: issues.length,
      open: open.length,
      ready: ready.length,
      blocked: blocked.length,
      labels: [...labels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
      epics,
    };
  }, [byId, issues]);

  const connectionClass =
    connection === 'live'
      ? 'is-live'
      : connection === 'syncing'
        ? 'is-syncing'
        : connection === 'error'
          ? 'is-error'
          : '';

  const workspace = source ? source.repo : 'beads';
  const repoUrl = source ? `https://github.com/${source.owner}/${source.repo}` : null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="workspace">
          <span className="workspace-badge">{workspace.slice(0, 2).toUpperCase()}</span>
          <span className="workspace-name">{workspace}</span>
          <Icon.Chevron size={12} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
        </div>
        <Link href="/search" className="icon-button" title="Search  /">
          <Icon.Search size={15} />
        </Link>
        <button type="button" className="icon-button" title="New issue  C" onClick={onOpenCreate}>
          <Icon.Compose size={15} />
        </button>
      </div>

      <nav className="sidebar-scroll">
        <NavLink href="/ready" icon={<Icon.Inbox size={15} />} label="Ready" count={stats.ready} />
        <NavLink
          href="/my-issues"
          icon={<Icon.MyIssues size={15} />}
          label="My issues"
        />
        <NavLink href="/" icon={<Icon.Issues size={15} />} label="All issues" count={stats.open} />
        <NavLink
          href="/blocked"
          icon={<Icon.Blocked size={15} />}
          label="Blocked"
          count={stats.blocked}
        />

        <Section title="Views">
          <NavLink href="/board" icon={<Icon.Board size={15} />} label="Board" />
          <NavLink href="/graph" icon={<Icon.Graph size={15} />} label="Dependencies" />
          <NavLink href="/history" icon={<Icon.History size={15} />} label="Database history" />
        </Section>

        {stats.epics.length ? (
          <Section title="Epics">
            {stats.epics.map((epic) => (
              <Link key={epic.id} href={`/issue/${epic.id}`} className="nav-item">
                <TypeIcon type="epic" size={15} />
                <span className="nav-item-label">{epic.title}</span>
              </Link>
            ))}
          </Section>
        ) : null}

        <Section title="Statuses">
          {(['in_progress', 'blocked', 'open', 'deferred', 'closed'] as const).map((status) => {
            const count = issues.filter((issue) => issue.status === status).length;
            if (!count) return null;
            return (
              <Link key={status} href={`/status/${status}`} className="nav-item">
                <StatusIcon status={status} size={15} />
                <span className="nav-item-label">{statusMeta(status).label}</span>
                <span className="nav-item-count">{count}</span>
              </Link>
            );
          })}
        </Section>

        {stats.labels.length ? (
          <Section title="Labels" defaultOpen={false}>
            {stats.labels.map(([label, count]) => (
              <Link
                key={label}
                href={`/label/${encodeURIComponent(label)}`}
                className="nav-item"
              >
                <span
                  className="label-dot"
                  style={{ background: labelColor(label), marginLeft: 4, marginRight: 3 }}
                />
                <span className="nav-item-label">{label}</span>
                <span className="nav-item-count">{count}</span>
              </Link>
            ))}
          </Section>
        ) : null}
      </nav>

      <div className="sidebar-footer">
        <div className="db-line">
          <span className={`live-dot ${connectionClass}`} />
          <span>
            {connection === 'live'
              ? 'Live'
              : connection === 'syncing'
                ? 'Syncing…'
                : connection === 'error'
                  ? 'Disconnected'
                  : 'Connecting…'}
          </span>
        </div>
        {source ? (
          <a
            className="db-line"
            href={repoUrl ? `${repoUrl}/blob/${source.branch}/${source.path}` : '#'}
            target="_blank"
            rel="noreferrer noopener"
            title={`${source.owner}/${source.repo}@${source.branch}:${source.path}`}
          >
            <Icon.Github size={11} />
            <code>
              {source.repo}@{source.branch}
            </code>
          </a>
        ) : null}
        {sha ? (
          <div className="db-line" title="Blob SHA of the JSONL database">
            <code style={{ paddingLeft: 17 }}>{sha.slice(0, 10)}</code>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
