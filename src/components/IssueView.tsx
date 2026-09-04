'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ISSUE_STATUSES,
  ISSUE_TYPES,
  type Issue,
  isOpen,
  isReady,
  priorityMeta,
  statusMeta,
} from '@/lib/beads';
import { Icon, PriorityIcon, StatusIcon, TypeIcon } from './icons';
import { useStore } from './store';
import { Avatar, DropdownMenu, LabelPill, relativeTime, type MenuOption } from './ui';

export type GroupKey = 'status' | 'priority' | 'assignee' | 'type' | 'none';
export type Layout = 'list' | 'board';

export interface Filters {
  query: string;
  status: string | null;
  priority: number | null;
  type: string | null;
  assignee: string | null;
  label: string | null;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  status: null,
  priority: null,
  type: null,
  assignee: null,
  label: null,
};

/* ------------------------------------------------------------- helpers -- */

function matches(issue: Issue, filters: Filters): boolean {
  if (filters.status && issue.status !== filters.status) return false;
  if (filters.priority !== null && issue.priority !== filters.priority) return false;
  if (filters.type && issue.issue_type !== filters.type) return false;
  if (filters.assignee && (issue.assignee ?? issue.owner) !== filters.assignee) return false;
  if (filters.label && !(issue.labels ?? []).includes(filters.label)) return false;

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    const haystack = [
      issue.id,
      issue.title,
      issue.description ?? '',
      issue.assignee ?? '',
      (issue.labels ?? []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

function groupOf(issue: Issue, key: GroupKey): string {
  switch (key) {
    case 'status':
      return issue.status;
    case 'priority':
      return String(issue.priority);
    case 'assignee':
      return issue.assignee ?? issue.owner ?? '__unassigned__';
    case 'type':
      return issue.issue_type;
    default:
      return 'all';
  }
}

function groupLabel(key: GroupKey, value: string): string {
  switch (key) {
    case 'status':
      return statusMeta(value).label;
    case 'priority':
      return priorityMeta(Number(value)).label;
    case 'assignee':
      return value === '__unassigned__' ? 'Unassigned' : value;
    case 'type':
      return value.charAt(0).toUpperCase() + value.slice(1);
    default:
      return 'All issues';
  }
}

function groupOrder(key: GroupKey, value: string): number {
  switch (key) {
    case 'status':
      return statusMeta(value).order;
    case 'priority':
      return Number(value);
    case 'type':
      return ISSUE_TYPES.indexOf(value as (typeof ISSUE_TYPES)[number]);
    default:
      return 0;
  }
}

function sortIssues(a: Issue, b: Issue): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const at = Date.parse(a.updated_at ?? a.created_at ?? '') || 0;
  const bt = Date.parse(b.updated_at ?? b.created_at ?? '') || 0;
  return bt - at;
}

/* ----------------------------------------------------------- issue row -- */

function IssueRow({
  issue,
  focused,
  onOpen,
}: {
  issue: Issue;
  focused: boolean;
  onOpen: () => void;
}): JSX.Element {
  const { byId, updateIssue } = useStore();
  const [statusAnchor, setStatusAnchor] = useState<{ x: number; y: number } | null>(null);
  const [priorityAnchor, setPriorityAnchor] = useState<{ x: number; y: number } | null>(null);

  const done = statusMeta(issue.status).category === 'done';
  const ready = isReady(issue, byId);
  const blockers = (issue.dependencies ?? []).filter((dep) => {
    if (dep.type !== 'blocks' && dep.type !== 'parent-child') return false;
    const blocker = byId.get(dep.depends_on_id);
    return blocker ? isOpen(blocker) : false;
  });

  const anchorFrom = (event: ReactMouseEvent<HTMLElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  };

  return (
    <div
      className={`issue-row${focused ? ' is-focused' : ''}${done ? ' is-done' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={-1}
      data-issue-id={issue.id}
    >
      <button
        type="button"
        title={`Priority: ${priorityMeta(issue.priority).label}`}
        style={{ display: 'flex', flexShrink: 0 }}
        onClick={(event) => {
          event.stopPropagation();
          setPriorityAnchor(anchorFrom(event));
        }}
      >
        <PriorityIcon priority={issue.priority} />
      </button>

      <span className="issue-id">{issue.id}</span>

      <button
        type="button"
        title={`Status: ${statusMeta(issue.status).label}`}
        style={{ display: 'flex', flexShrink: 0 }}
        onClick={(event) => {
          event.stopPropagation();
          setStatusAnchor(anchorFrom(event));
        }}
      >
        <StatusIcon status={issue.status} />
      </button>

      <span style={{ display: 'flex', flexShrink: 0 }} title={issue.issue_type}>
        <TypeIcon type={issue.issue_type} />
      </span>

      <span className="issue-title">{issue.title}</span>

      <span className="issue-meta">
        {blockers.length ? (
          <span className="blocked-pill" title={`Blocked by ${blockers.map((d) => d.depends_on_id).join(', ')}`}>
            <Icon.Blocked size={10} />
            {blockers.length}
          </span>
        ) : ready && !done ? (
          <span className="ready-pill" title="No open blockers — this is `bd ready`">
            Ready
          </span>
        ) : null}

        {(issue.labels ?? []).slice(0, 2).map((label) => (
          <LabelPill key={label} label={label} />
        ))}

        {issue.comments?.length ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--text-quaternary)',
              fontSize: 11,
            }}
          >
            <Icon.Comment size={11} />
            {issue.comments.length}
          </span>
        ) : null}

        <span className="issue-date">{relativeTime(issue.updated_at ?? issue.created_at)}</span>
        <Avatar name={issue.assignee ?? issue.owner} />
      </span>

      {statusAnchor ? (
        <DropdownMenu
          anchor={statusAnchor}
          selected={issue.status}
          onClose={() => setStatusAnchor(null)}
          onSelect={(value) => void updateIssue(issue.id, { status: value })}
          options={ISSUE_STATUSES.map<MenuOption<string>>((status) => ({
            value: status,
            label: statusMeta(status).label,
            icon: <StatusIcon status={status} size={14} />,
          }))}
        />
      ) : null}

      {priorityAnchor ? (
        <DropdownMenu
          anchor={priorityAnchor}
          selected={issue.priority}
          onClose={() => setPriorityAnchor(null)}
          onSelect={(value) => void updateIssue(issue.id, { priority: value })}
          options={[0, 1, 2, 3, 4].map<MenuOption<number>>((priority) => ({
            value: priority,
            label: priorityMeta(priority).label,
            icon: <PriorityIcon priority={priority} size={14} />,
          }))}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- board card -- */

function BoardCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }): JSX.Element {
  return (
    <div className="board-card" onClick={onOpen} role="button" tabIndex={-1}>
      <div className="board-card-top">
        <PriorityIcon priority={issue.priority} size={13} />
        <span>{issue.id}</span>
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          <TypeIcon type={issue.issue_type} size={13} />
        </span>
      </div>
      <div className="board-card-title">{issue.title}</div>
      <div className="board-card-bottom">
        {(issue.labels ?? []).slice(0, 2).map((label) => (
          <LabelPill key={label} label={label} />
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          <Avatar name={issue.assignee ?? issue.owner} size={18} />
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- view -- */

export function IssueView({
  title,
  icon,
  select,
  emptyHint,
  defaultLayout = 'list',
  showClosedByDefault = false,
}: {
  title: string;
  icon?: JSX.Element;
  select?: (issue: Issue, byId: ReadonlyMap<string, Issue>) => boolean;
  emptyHint?: string;
  defaultLayout?: Layout;
  showClosedByDefault?: boolean;
}): JSX.Element {
  const router = useRouter();
  const { issues, byId, ready: loaded, error, refresh, updateIssue } = useStore();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [group, setGroup] = useState<GroupKey>('status');
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [showClosed, setShowClosed] = useState(showClosedByDefault);
  const [focusIndex, setFocusIndex] = useState(0);
  const [menu, setMenu] = useState<null | 'status' | 'priority' | 'type' | 'assignee' | 'group'>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const base = select ? issues.filter((issue) => select(issue, byId)) : issues;
    return base
      .filter((issue) => (showClosed ? true : statusMeta(issue.status).category !== 'done'))
      .filter((issue) => matches(issue, filters))
      .sort(sortIssues);
  }, [byId, filters, issues, select, showClosed]);

  const groups = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of visible) {
      const key = groupOf(issue, group);
      const bucket = map.get(key);
      if (bucket) bucket.push(issue);
      else map.set(key, [issue]);
    }
    return [...map.entries()].sort(
      (a, b) => groupOrder(group, a[0]) - groupOrder(group, b[0]) || a[0].localeCompare(b[0]),
    );
  }, [group, visible]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  useEffect(() => {
    setFocusIndex((current) => Math.min(current, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  const openIssue = useCallback(
    (id: string) => router.push(`/issue/${id}`),
    [router],
  );

  // Linear's list keybindings: j/k to move, Enter to open, E/D to change state.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const current = flat[focusIndex];

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusIndex((index) => Math.min(index + 1, flat.length - 1));
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter' && current) {
        event.preventDefault();
        openIssue(current.id);
      } else if (event.key === 'e' && current) {
        event.preventDefault();
        void updateIssue(current.id, {
          status: current.status === 'in_progress' ? 'open' : 'in_progress',
        });
      } else if (event.key === 'd' && current) {
        event.preventDefault();
        void updateIssue(current.id, {
          status: statusMeta(current.status).category === 'done' ? 'open' : 'closed',
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flat, focusIndex, openIssue, updateIssue]);

  useEffect(() => {
    const container = scrollRef.current;
    const current = flat[focusIndex];
    if (!container || !current) return;

    const row = container.querySelector(`[data-issue-id="${CSS.escape(current.id)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [flat, focusIndex]);

  const openMenu = (
    kind: 'status' | 'priority' | 'type' | 'assignee' | 'group',
    event: ReactMouseEvent<HTMLElement>,
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
    setMenu(kind);
  };

  const activeFilterCount =
    (filters.status ? 1 : 0) +
    (filters.priority !== null ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.assignee ? 1 : 0) +
    (filters.label ? 1 : 0);

  const assignees = useMemo(() => {
    const names = new Set<string>();
    for (const issue of issues) {
      const name = issue.assignee ?? issue.owner;
      if (name) names.add(name);
    }
    return [...names].sort();
  }, [issues]);

  return (
    <>
      <header className="view-header">
        <div className="view-title">
          {icon}
          {title}
        </div>
        <span className="count-badge">{visible.length}</span>

        <div className="view-header-spacer" />

        <div className="segmented">
          <button
            type="button"
            className={layout === 'list' ? 'is-active' : ''}
            onClick={() => setLayout('list')}
          >
            <Icon.List size={13} /> List
          </button>
          <button
            type="button"
            className={layout === 'board' ? 'is-active' : ''}
            onClick={() => setLayout('board')}
          >
            <Icon.Board size={13} /> Board
          </button>
        </div>

        <button type="button" className="btn is-ghost" onClick={() => void refresh()} title="Refresh from GitHub">
          <Icon.Refresh size={13} />
        </button>
      </header>

      <div className="filter-bar">
        <div className="search-field">
          <Icon.Search size={13} />
          <input
            value={filters.query}
            placeholder="Filter by title, id, label…"
            onChange={(event) =>
              setFilters((current) => ({ ...current, query: event.target.value }))
            }
          />
          {filters.query ? (
            <button
              type="button"
              className="chip-clear"
              onClick={() => setFilters((current) => ({ ...current, query: '' }))}
            >
              <Icon.Close size={11} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className={`chip${filters.status ? ' is-set' : ''}`}
          onClick={(event) => openMenu('status', event)}
        >
          {filters.status ? <StatusIcon status={filters.status} size={12} /> : <Icon.Filter size={12} />}
          {filters.status ? statusMeta(filters.status).label : 'Status'}
        </button>

        <button
          type="button"
          className={`chip${filters.priority !== null ? ' is-set' : ''}`}
          onClick={(event) => openMenu('priority', event)}
        >
          {filters.priority !== null ? (
            <PriorityIcon priority={filters.priority} size={12} />
          ) : (
            <Icon.Filter size={12} />
          )}
          {filters.priority !== null ? priorityMeta(filters.priority).label : 'Priority'}
        </button>

        <button
          type="button"
          className={`chip${filters.type ? ' is-set' : ''}`}
          onClick={(event) => openMenu('type', event)}
        >
          {filters.type ? <TypeIcon type={filters.type} size={12} /> : <Icon.Filter size={12} />}
          {filters.type ?? 'Type'}
        </button>

        <button
          type="button"
          className={`chip${filters.assignee ? ' is-set' : ''}`}
          onClick={(event) => openMenu('assignee', event)}
        >
          {filters.assignee ? (
            <Avatar name={filters.assignee} size={14} />
          ) : (
            <Icon.Filter size={12} />
          )}
          {filters.assignee ?? 'Assignee'}
        </button>

        {activeFilterCount ? (
          <button
            type="button"
            className="btn is-ghost"
            onClick={() => setFilters((current) => ({ ...EMPTY_FILTERS, query: current.query }))}
          >
            Clear
          </button>
        ) : null}

        <div className="view-header-spacer" />

        <button
          type="button"
          className={`chip${showClosed ? ' is-set' : ''}`}
          onClick={() => setShowClosed((current) => !current)}
          title="Include closed issues"
        >
          <StatusIcon status="closed" size={12} />
          {showClosed ? 'Closed shown' : 'Closed hidden'}
        </button>

        <button type="button" className="chip is-set" onClick={(event) => openMenu('group', event)}>
          Group: {group === 'none' ? 'None' : group}
        </button>
      </div>

      {!loaded ? (
        <div className="list-scroll">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="skeleton-row" key={index}>
              <div className="skeleton-bar" style={{ width: 14, height: 14, borderRadius: 7 }} />
              <div className="skeleton-bar" style={{ width: 52 }} />
              <div className="skeleton-bar" style={{ width: `${30 + ((index * 13) % 40)}%` }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty">
          <h2>Cannot reach the database</h2>
          <p>{error}</p>
          <button type="button" className="btn" onClick={() => void refresh()}>
            <Icon.Refresh size={13} /> Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h2>No issues here</h2>
          <p>{emptyHint ?? 'Press C to create one, or adjust the filters above.'}</p>
        </div>
      ) : layout === 'board' ? (
        <div className="board">
          {groups.map(([key, items]) => (
            <div className="board-column" key={key}>
              <div className="board-column-header">
                {group === 'status' ? <StatusIcon status={key} size={14} /> : null}
                {groupLabel(group, key)}
                <span className="group-count">{items.length}</span>
              </div>
              <div className="board-cards">
                {items.map((issue) => (
                  <BoardCard key={issue.id} issue={issue} onOpen={() => openIssue(issue.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list-scroll" ref={scrollRef}>
          {groups.map(([key, items]) => (
            <section key={key}>
              {group !== 'none' ? (
                <div className="group-header">
                  {group === 'status' ? <StatusIcon status={key} size={14} /> : null}
                  {group === 'priority' ? <PriorityIcon priority={Number(key)} size={14} /> : null}
                  {group === 'type' ? <TypeIcon type={key} size={14} /> : null}
                  {group === 'assignee' ? (
                    <Avatar name={key === '__unassigned__' ? undefined : key} size={16} />
                  ) : null}
                  <span>{groupLabel(group, key)}</span>
                  <span className="group-count">{items.length}</span>
                </div>
              ) : null}

              {items.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  focused={flat[focusIndex]?.id === issue.id}
                  onOpen={() => openIssue(issue.id)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {menu === 'status' ? (
        <DropdownMenu
          anchor={menuAnchor}
          selected={filters.status ?? undefined}
          onClose={() => setMenu(null)}
          onSelect={(value) =>
            setFilters((current) => ({
              ...current,
              status: value === current.status ? null : value,
            }))
          }
          options={ISSUE_STATUSES.map<MenuOption<string>>((status) => ({
            value: status,
            label: statusMeta(status).label,
            icon: <StatusIcon status={status} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'priority' ? (
        <DropdownMenu
          anchor={menuAnchor}
          selected={filters.priority ?? undefined}
          onClose={() => setMenu(null)}
          onSelect={(value) =>
            setFilters((current) => ({
              ...current,
              priority: value === current.priority ? null : value,
            }))
          }
          options={[0, 1, 2, 3, 4].map<MenuOption<number>>((priority) => ({
            value: priority,
            label: priorityMeta(priority).label,
            icon: <PriorityIcon priority={priority} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'type' ? (
        <DropdownMenu
          anchor={menuAnchor}
          selected={filters.type ?? undefined}
          onClose={() => setMenu(null)}
          onSelect={(value) =>
            setFilters((current) => ({ ...current, type: value === current.type ? null : value }))
          }
          options={ISSUE_TYPES.map<MenuOption<string>>((type) => ({
            value: type,
            label: type,
            icon: <TypeIcon type={type} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'group' ? (
        <DropdownMenu
          anchor={menuAnchor}
          selected={group}
          onClose={() => setMenu(null)}
          onSelect={(value) => setGroup(value)}
          options={[
            { value: 'status', label: 'Status' },
            { value: 'priority', label: 'Priority' },
            { value: 'assignee', label: 'Assignee' },
            { value: 'type', label: 'Type' },
            { value: 'none', label: 'No grouping' },
          ] satisfies MenuOption<GroupKey>[]}
        />
      ) : null}

      {menu === 'assignee' ? (
        <DropdownMenu
          searchable
          anchor={menuAnchor}
          selected={filters.assignee ?? undefined}
          onClose={() => setMenu(null)}
          onSelect={(value) =>
            setFilters((current) => ({
              ...current,
              assignee: value === current.assignee ? null : value,
            }))
          }
          options={assignees.map<MenuOption<string>>((name) => ({
            value: name,
            label: name,
            icon: <Avatar name={name} size={16} />,
          }))}
        />
      ) : null}
    </>
  );
}
