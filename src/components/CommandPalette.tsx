'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { ISSUE_STATUSES, priorityMeta, statusMeta } from '@/lib/beads';
import { Icon, PriorityIcon, StatusIcon, TypeIcon } from './icons';
import { useStore } from './store';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: JSX.Element;
  section: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}): JSX.Element | null {
  const router = useRouter();
  const { issues, refresh, source } = useStore();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = [
      {
        id: 'nav-all',
        label: 'Go to all issues',
        icon: <Icon.Issues size={14} />,
        section: 'Navigation',
        run: () => router.push('/'),
      },
      {
        id: 'nav-ready',
        label: 'Go to ready issues',
        icon: <Icon.Inbox size={14} />,
        section: 'Navigation',
        run: () => router.push('/ready'),
      },
      {
        id: 'nav-blocked',
        label: 'Go to blocked issues',
        icon: <Icon.Blocked size={14} />,
        section: 'Navigation',
        run: () => router.push('/blocked'),
      },
      {
        id: 'nav-board',
        label: 'Go to board',
        icon: <Icon.Board size={14} />,
        section: 'Navigation',
        run: () => router.push('/board'),
      },
      {
        id: 'nav-graph',
        label: 'Go to dependency graph',
        icon: <Icon.Graph size={14} />,
        section: 'Navigation',
        run: () => router.push('/graph'),
      },
      {
        id: 'nav-history',
        label: 'Go to database history',
        icon: <Icon.History size={14} />,
        section: 'Navigation',
        run: () => router.push('/history'),
      },
    ];

    const actions: Command[] = [
      {
        id: 'act-create',
        label: 'Create new issue',
        hint: 'C',
        icon: <Icon.Compose size={14} />,
        section: 'Actions',
        run: onCreate,
      },
      {
        id: 'act-refresh',
        label: 'Refresh from GitHub',
        icon: <Icon.Refresh size={14} />,
        section: 'Actions',
        run: () => void refresh(),
      },
    ];

    if (source) {
      actions.push({
        id: 'act-open-github',
        label: 'Open the database file on GitHub',
        icon: <Icon.Github size={14} />,
        section: 'Actions',
        run: () =>
          window.open(
            `https://github.com/${source.owner}/${source.repo}/blob/${source.branch}/${source.path}`,
            '_blank',
            'noreferrer',
          ),
      });
    }

    const statusFilters: Command[] = ISSUE_STATUSES.map((status) => ({
      id: `status-${status}`,
      label: `Show ${statusMeta(status).label.toLowerCase()} issues`,
      icon: <StatusIcon status={status} size={14} />,
      section: 'Filter',
      run: () => router.push(`/status/${status}`),
    }));

    const issueCommands: Command[] = issues.slice(0, 400).map((issue) => ({
      id: `issue-${issue.id}`,
      label: `${issue.id}  ${issue.title}`,
      hint: priorityMeta(issue.priority).short,
      icon: <TypeIcon type={issue.issue_type} size={14} />,
      section: 'Issues',
      run: () => router.push(`/issue/${issue.id}`),
    }));

    return [...actions, ...navigation, ...statusFilters, ...issueCommands];
  }, [issues, onCreate, refresh, router, source]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands.filter((command) => command.section !== 'Issues').slice(0, 40);
    }

    const needle = query.toLowerCase();
    return commands
      .filter((command) => command.label.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [commands, query]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => Math.min(index + 1, filtered.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const command = filtered[active];
        if (command) {
          onClose();
          command.run();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, filtered, onClose, open]);

  useEffect(() => {
    listRef.current
      ?.querySelector('.palette-item.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  let lastSection = '';

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Icon.Search size={16} style={{ color: 'var(--text-quaternary)' }} />
          <input
            autoFocus
            value={query}
            placeholder="Type a command or search issues…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="kbd">esc</span>
        </div>

        <div className="palette-list" ref={listRef}>
          {filtered.map((command, index) => {
            const header = command.section !== lastSection ? command.section : null;
            lastSection = command.section;

            return (
              <div key={command.id}>
                {header ? <div className="palette-section">{header}</div> : null}
                <button
                  type="button"
                  className={`palette-item${index === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onClose();
                    command.run();
                  }}
                >
                  {command.icon}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {command.label}
                  </span>
                  {command.hint ? <span className="palette-hint">{command.hint}</span> : null}
                </button>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-quaternary)' }}>
              No results for “{query}”
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
