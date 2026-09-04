'use client';

import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { CreateDialog } from './CreateDialog';
import { useStore } from './store';
import { Icon } from './icons';

function Toasts(): JSX.Element {
  const { toasts, dismiss } = useStore();

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast${toast.kind === 'error' ? ' is-error' : ''}`}>
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            style={{ color: 'inherit', opacity: 0.6, display: 'flex' }}
          >
            <Icon.Close size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const openCreate = useCallback(() => {
    setPaletteOpen(false);
    setCreateOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'c') {
        event.preventDefault();
        openCreate();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openCreate]);

  return (
    <div className="shell">
      <Sidebar onOpenCreate={openCreate} />
      <main className="main">{children}</main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCreate={openCreate}
      />
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <Toasts />
    </div>
  );
}
