'use client';

import { useEffect, useState, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ISSUE_STATUSES, ISSUE_TYPES, priorityMeta, statusMeta } from '@/lib/beads';
import { Icon, PriorityIcon, StatusIcon, TypeIcon } from './icons';
import { useStore } from './store';
import { DropdownMenu, type MenuOption } from './ui';

export function CreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const router = useRouter();
  const { createIssue, source } = useStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState(2);
  const [type, setType] = useState('task');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<null | 'status' | 'priority' | 'type'>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStatus('open');
      setPriority(2);
      setType('task');
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !menu) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [menu, onClose, open]);

  if (!open) return null;

  const openMenu = (
    kind: 'status' | 'priority' | 'type',
    event: ReactMouseEvent<HTMLElement>,
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left, y: rect.bottom + 4 });
    setMenu(kind);
  };

  const submit = async (): Promise<void> => {
    if (!title.trim() || busy) return;
    setBusy(true);

    const created = await createIssue({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      issue_type: type,
    });

    setBusy(false);
    if (created) {
      onClose();
      router.push(`/issue/${created.id}`);
    }
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="New issue">
        <div className="dialog-header">
          <Icon.Github size={13} />
          <span>
            New issue in{' '}
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {source ? `${source.repo}@${source.branch}` : 'the database'}
            </strong>
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <button type="button" className="icon-button" onClick={onClose}>
              <Icon.Close size={14} />
            </button>
          </span>
        </div>

        <div className="dialog-body">
          <input
            autoFocus
            className="title-input"
            value={title}
            placeholder="Issue title"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <textarea
            className="body-input"
            value={description}
            placeholder="Add a description… (markdown supported)"
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="chip is-set" onClick={(event) => openMenu('status', event)}>
              <StatusIcon status={status} size={12} />
              {statusMeta(status).label}
            </button>
            <button
              type="button"
              className="chip is-set"
              onClick={(event) => openMenu('priority', event)}
            >
              <PriorityIcon priority={priority} size={12} />
              {priorityMeta(priority).label}
            </button>
            <button type="button" className="chip is-set" onClick={(event) => openMenu('type', event)}>
              <TypeIcon type={type} size={12} />
              {type}
            </button>
          </div>
        </div>

        <div className="dialog-footer">
          <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
            Commits one line to the JSONL database
          </span>
          <span className="spacer" />
          <button type="button" className="btn is-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn is-primary"
            disabled={!title.trim() || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Creating…' : 'Create issue'}
          </button>
        </div>
      </div>

      {menu === 'status' ? (
        <DropdownMenu
          anchor={anchor}
          selected={status}
          onClose={() => setMenu(null)}
          onSelect={setStatus}
          options={ISSUE_STATUSES.map<MenuOption<string>>((value) => ({
            value,
            label: statusMeta(value).label,
            icon: <StatusIcon status={value} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'priority' ? (
        <DropdownMenu
          anchor={anchor}
          selected={priority}
          onClose={() => setMenu(null)}
          onSelect={setPriority}
          options={[0, 1, 2, 3, 4].map<MenuOption<number>>((value) => ({
            value,
            label: priorityMeta(value).label,
            icon: <PriorityIcon priority={value} size={14} />,
          }))}
        />
      ) : null}

      {menu === 'type' ? (
        <DropdownMenu
          anchor={anchor}
          selected={type}
          onClose={() => setMenu(null)}
          onSelect={setType}
          options={ISSUE_TYPES.map<MenuOption<string>>((value) => ({
            value,
            label: value,
            icon: <TypeIcon type={value} size={14} />,
          }))}
        />
      ) : null}
    </div>
  );
}
