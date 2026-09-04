'use client';

import { useEffect, useMemo, useState, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DEPENDENCY_TYPES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  type Issue,
  isOpen,
  priorityMeta,
  statusMeta,
} from '@/lib/beads';
import { Icon, PriorityIcon, StatusIcon, TypeIcon } from './icons';
import { useStore } from './store';
import {
  Avatar,
  AutoTextarea,
  DropdownMenu,
  LabelPill,
  Markdown,
  absoluteTime,
  relativeTime,
  type MenuOption,
} from './ui';

type MenuKind = 'status' | 'priority' | 'type' | 'assignee' | 'link';

function EditableSection({
  heading,
  value,
  placeholder,
  onSave,
}: {
  heading: string;
  value: string | undefined;
  placeholder: string;
  onSave: (next: string) => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [editing, value]);

  const commit = (): void => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(draft);
  };

  return (
    <>
      <div className="section-heading">{heading}</div>
      {editing ? (
        <div className="composer">
          <AutoTextarea
            autoFocus
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                commit();
              }
            }}
          />
          <div className="composer-actions">
            <button type="button" className="btn is-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn is-primary" onClick={commit}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className="detail-body"
          onClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setEditing(true);
          }}
          style={{ cursor: 'text' }}
        >
          {value ? (
            <Markdown source={value} />
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </div>
      )}
    </>
  );
}

export function IssueDetail({ id }: { id: string }): JSX.Element {
  const router = useRouter();
  const {
    byId,
    issues,
    ready,
    updateIssue,
    deleteIssue,
    addComment,
    linkDependency,
    unlinkDependency,
  } = useStore();

  const issue = byId.get(id);

  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (issue && !editingTitle) setTitleDraft(issue.title);
  }, [editingTitle, issue]);

  const blockedBy = useMemo(() => {
    if (!issue) return [];
    return (issue.dependencies ?? []).map((dep) => ({
      dep,
      target: byId.get(dep.depends_on_id),
    }));
  }, [byId, issue]);

  const blocking = useMemo(() => {
    if (!issue) return [];
    return issues
      .filter((candidate) =>
        (candidate.dependencies ?? []).some((dep) => dep.depends_on_id === issue.id),
      )
      .map((candidate) => ({
        candidate,
        type:
          (candidate.dependencies ?? []).find((dep) => dep.depends_on_id === issue.id)?.type ??
          'blocks',
      }));
  }, [issues, issue]);

  const assignees = useMemo(() => {
    const names = new Set<string>();
    for (const item of issues) {
      if (item.assignee) names.add(item.assignee);
      if (item.owner) names.add(item.owner);
    }
    return [...names].sort();
  }, [issues]);

  if (!ready) {
    return (
      <div className="detail">
        <div className="detail-main">
          <div className="detail-inner">
            <div className="skeleton-bar" style={{ width: 120, marginBottom: 20 }} />
            <div className="skeleton-bar" style={{ width: '70%', height: 20, marginBottom: 16 }} />
            <div className="skeleton-bar" style={{ width: '100%', marginBottom: 8 }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="empty">
        <h2>{id} not found</h2>
        <p>
          It is not in the JSONL database on this branch. It may have been deleted, or the
          database may point at a different branch.
        </p>
        <Link href="/" className="btn">
          Back to all issues
        </Link>
      </div>
    );
  }

  const openMenu = (kind: MenuKind, event: ReactMouseEvent<HTMLElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuAnchor({ x: rect.left, y: rect.bottom + 4 });
    setMenu(kind);
  };

  const commitTitle = (): void => {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== issue.title) void updateIssue(issue.id, { title: next });
  };

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="detail-inner">
          <div className="detail-breadcrumb">
            <Link href="/" style={{ color: 'var(--text-tertiary)' }}>
              All issues
            </Link>
            <Icon.ChevronRight size={11} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{issue.id}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn is-ghost"
                title="Delete issue"
                onClick={() => {
                  if (window.confirm(`Delete ${issue.id}? This rewrites the JSONL on GitHub.`)) {
                    void deleteIssue(issue.id).then(() => router.push('/'));
                  }
                }}
              >
                <Icon.Trash size={13} />
              </button>
            </span>
          </div>

          {editingTitle ? (
            <AutoTextarea
              autoFocus
              className="detail-title"
              value={titleDraft}
              onChange={setTitleDraft}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTitle();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setTitleDraft(issue.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h1
              className="detail-title"
              onClick={() => setEditingTitle(true)}
              style={{ cursor: 'text' }}
            >
              {issue.title}
            </h1>
          )}

          <EditableSection
            heading="Description"
            value={issue.description}
            placeholder="Add a description…"
            onSave={(next) => void updateIssue(issue.id, { description: next })}
          />

          <EditableSection
            heading="Design"
            value={issue.design}
            placeholder="Add design notes…"
            onSave={(next) => void updateIssue(issue.id, { design: next })}
          />

          <EditableSection
            heading="Acceptance criteria"
            value={issue.acceptance_criteria}
            placeholder="Add acceptance criteria…"
            onSave={(next) => void updateIssue(issue.id, { acceptance_criteria: next })}
          />

          <EditableSection
            heading="Notes"
            value={issue.notes}
            placeholder="Add notes…"
            onSave={(next) => void updateIssue(issue.id, { notes: next })}
          />

          {issue.close_reason ? (
            <>
              <div className="section-heading">Close reason</div>
              <div className="detail-body">
                <Markdown source={issue.close_reason} />
              </div>
            </>
          ) : null}

          <div className="section-heading">
            <Icon.Comment size={12} />
            Comments
            <span style={{ color: 'var(--text-quaternary)' }}>
              {issue.comments?.length ?? 0}
            </span>
          </div>

          {(issue.comments ?? []).map((entry, index) => (
            <div className="comment" key={`${entry.created_at ?? index}-${index}`}>
              <Avatar name={entry.author} size={24} />
              <div className="comment-body">
                <div className="comment-head">
                  <span className="comment-author">{entry.author ?? 'unknown'}</span>
                  <span className="comment-time" title={absoluteTime(entry.created_at)}>
                    {relativeTime(entry.created_at)}
                  </span>
                </div>
                <div className="comment-text">{entry.text ?? entry.content ?? ''}</div>
              </div>
            </div>
          ))}

          <div className="composer" style={{ marginTop: 12 }}>
            <AutoTextarea
              value={comment}
              onChange={setComment}
              placeholder="Leave a comment…"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (comment.trim()) {
                    void addComment(issue.id, comment.trim());
                    setComment('');
                  }
                }
              }}
            />
            <div className="composer-actions">
              <span
                style={{
                  marginRight: 'auto',
                  fontSize: 11,
                  color: 'var(--text-quaternary)',
                  alignSelf: 'center',
                }}
              >
                <span className="kbd">⌘</span> <span className="kbd">↵</span> to comment
              </span>
              <button
                type="button"
                className="btn is-primary"
                disabled={!comment.trim()}
                onClick={() => {
                  void addComment(issue.id, comment.trim());
                  setComment('');
                }}
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="detail-aside">
        <div className="aside-group">
          <div className="aside-label">Status</div>
          <button type="button" className="aside-row" onClick={(event) => openMenu('status', event)}>
            <StatusIcon status={issue.status} />
            {statusMeta(issue.status).label}
          </button>
        </div>

        <div className="aside-group">
          <div className="aside-label">Priority</div>
          <button
            type="button"
            className="aside-row"
            onClick={(event) => openMenu('priority', event)}
          >
            <PriorityIcon priority={issue.priority} />
            {priorityMeta(issue.priority).label}
          </button>
        </div>

        <div className="aside-group">
          <div className="aside-label">Type</div>
          <button type="button" className="aside-row" onClick={(event) => openMenu('type', event)}>
            <TypeIcon type={issue.issue_type} />
            {issue.issue_type}
          </button>
        </div>

        <div className="aside-group">
          <div className="aside-label">Assignee</div>
          <button
            type="button"
            className="aside-row"
            onClick={(event) => openMenu('assignee', event)}
          >
            <Avatar name={issue.assignee ?? undefined} size={18} />
            {issue.assignee ?? <span className="muted">Unassigned</span>}
          </button>
          {issue.owner && issue.owner !== issue.assignee ? (
            <div className="aside-row" style={{ cursor: 'default' }} title={`Owner: ${issue.owner}`}>
              <Avatar name={issue.owner} size={18} />
              <span
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {issue.owner}
              </span>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                owner
              </span>
            </div>
          ) : null}
        </div>

        {issue.labels?.length ? (
          <div className="aside-group">
            <div className="aside-label">Labels</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {issue.labels.map((label) => (
                <LabelPill key={label} label={label} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="aside-group">
          <div className="aside-label">
            Dependencies
            <button
              type="button"
              style={{ float: 'right', color: 'var(--text-quaternary)' }}
              onClick={(event) => openMenu('link', event)}
              title="Link an issue"
            >
              <Icon.Plus size={12} />
            </button>
          </div>

          {blockedBy.length === 0 && blocking.length === 0 ? (
            <div className="aside-row" style={{ cursor: 'default' }}>
              <span className="muted">No links</span>
            </div>
          ) : null}

          {blockedBy.map(({ dep, target }) => (
            <div className="dep-row" key={`${dep.depends_on_id}-${dep.type}`}>
              <span className="dep-id">{dep.type === 'blocks' ? '↑' : '·'}</span>
              {target ? <StatusIcon status={target.status} size={12} /> : null}
              <Link href={`/issue/${dep.depends_on_id}`} className="dep-title">
                {target?.title ?? dep.depends_on_id}
              </Link>
              <button
                type="button"
                className="dep-remove"
                title="Unlink"
                onClick={() => void unlinkDependency(issue.id, dep.depends_on_id)}
              >
                <Icon.Close size={11} />
              </button>
            </div>
          ))}

          {blocking.map(({ candidate }) => (
            <div className="dep-row" key={`blocking-${candidate.id}`}>
              <span className="dep-id">↓</span>
              <StatusIcon status={candidate.status} size={12} />
              <Link href={`/issue/${candidate.id}`} className="dep-title">
                {candidate.title}
              </Link>
            </div>
          ))}
        </div>

        <div className="aside-group">
          <div className="aside-label">Activity</div>
          <div className="aside-row" style={{ cursor: 'default', fontSize: 12 }}>
            <span className="muted">Created</span>
            <span style={{ marginLeft: 'auto' }} title={absoluteTime(issue.created_at)}>
              {relativeTime(issue.created_at)}
            </span>
          </div>
          <div className="aside-row" style={{ cursor: 'default', fontSize: 12 }}>
            <span className="muted">Updated</span>
            <span style={{ marginLeft: 'auto' }} title={absoluteTime(issue.updated_at)}>
              {relativeTime(issue.updated_at)}
            </span>
          </div>
          {issue.started_at ? (
            <div className="aside-row" style={{ cursor: 'default', fontSize: 12 }}>
              <span className="muted">Started</span>
              <span style={{ marginLeft: 'auto' }} title={absoluteTime(issue.started_at)}>
                {relativeTime(issue.started_at)}
              </span>
            </div>
          ) : null}
          {issue.closed_at ? (
            <div className="aside-row" style={{ cursor: 'default', fontSize: 12 }}>
              <span className="muted">Closed</span>
              <span style={{ marginLeft: 'auto' }} title={absoluteTime(issue.closed_at)}>
                {relativeTime(issue.closed_at)}
              </span>
            </div>
          ) : null}
          {issue.created_by ? (
            <div className="aside-row" style={{ cursor: 'default', fontSize: 12 }}>
              <span className="muted">By</span>
              <span style={{ marginLeft: 'auto' }}>{issue.created_by}</span>
            </div>
          ) : null}
        </div>
      </aside>

      {menu === 'status' ? (
        <DropdownMenu
          anchor={menuAnchor}
          selected={issue.status}
          onClose={() => setMenu(null)}
          onSelect={(value) => void updateIssue(issue.id, { status: value })}
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
          selected={issue.priority}
          onClose={() => setMenu(null)}
          onSelect={(value) => void updateIssue(issue.id, { priority: value })}
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
          selected={issue.issue_type}
          onClose={() => setMenu(null)}
          onSelect={(value) => void updateIssue(issue.id, { issue_type: value })}
          options={ISSUE_TYPES.map<MenuOption<string>>((type) => ({
            value: type,
            label: type,
            icon: <TypeIcon type={type} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'assignee' ? (
        <DropdownMenu
          searchable
          anchor={menuAnchor}
          selected={issue.assignee ?? ''}
          onClose={() => setMenu(null)}
          onSelect={(value) => void updateIssue(issue.id, { assignee: value })}
          options={[
            { value: '', label: 'Unassigned' },
            ...assignees.map<MenuOption<string>>((name) => ({
              value: name,
              label: name,
              icon: <Avatar name={name} size={16} />,
            })),
          ]}
        />
      ) : null}

      {menu === 'link' ? (
        <DropdownMenu
          searchable
          placeholder="Link to issue…"
          anchor={menuAnchor}
          onClose={() => setMenu(null)}
          onSelect={(value) => {
            const [type, target] = String(value).split('::');
            if (type && target) void linkDependency(issue.id, target, type);
          }}
          options={issues
            .filter((candidate) => candidate.id !== issue.id)
            .filter((candidate) => isOpen(candidate))
            .flatMap<MenuOption<string>>((candidate) =>
              DEPENDENCY_TYPES.filter((type) => type === 'blocks' || type === 'related').map(
                (type) => ({
                  value: `${type}::${candidate.id}`,
                  label: `${type === 'blocks' ? 'Blocked by' : 'Related to'} ${candidate.id} · ${candidate.title}`,
                  icon: <StatusIcon status={candidate.status} size={14} />,
                }),
              ),
            )}
        />
      ) : null}
    </div>
  );
}
