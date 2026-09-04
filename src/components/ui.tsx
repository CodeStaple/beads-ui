'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { Icon } from './icons';

/* ------------------------------------------------------------ avatars -- */

const AVATAR_COLORS = [
  '#5e6ad2',
  '#43bc58',
  '#f0bf00',
  '#ff7235',
  '#eb5aaa',
  '#00b8cb',
  '#a56be0',
  '#ff5d5e',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function initialsOf(name: string): string {
  const cleaned = name.replace(/@.*$/, '').replace(/[._-]+/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

export function Avatar({ name, size = 20 }: { name?: string; size?: number }): JSX.Element {
  if (!name) {
    return (
      <span
        className="avatar is-empty"
        style={{ width: size, height: size }}
        title="Unassigned"
      >
        <Icon.Plus size={Math.round(size * 0.5)} />
      </span>
    );
  }

  const color = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length]!;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

/* -------------------------------------------------------------- label -- */

const LABEL_COLORS = ['#5e6ad2', '#43bc58', '#f0bf00', '#ff7235', '#eb5aaa', '#00b8cb', '#a56be0'];

export function labelColor(label: string): string {
  return LABEL_COLORS[hashString(label) % LABEL_COLORS.length]!;
}

export function LabelPill({ label }: { label: string }): JSX.Element {
  return (
    <span className="label-pill">
      <span className="label-dot" style={{ background: labelColor(label) }} />
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- time -- */

export function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;

  const days = Math.round(seconds / 86_400);
  if (days < 31) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function absoluteTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* --------------------------------------------------------------- menu -- */

export interface MenuOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

export function DropdownMenu<T extends string | number>({
  anchor,
  options,
  selected,
  onSelect,
  onClose,
  searchable = false,
  placeholder = 'Search…',
}: {
  anchor: { x: number; y: number };
  options: readonly MenuOption<T>[];
  selected?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  searchable?: boolean;
  placeholder?: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y });

  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const left = Math.min(anchor.x, window.innerWidth - rect.width - 8);
    const top =
      anchor.y + rect.height > window.innerHeight - 8
        ? Math.max(8, anchor.y - rect.height - 4)
        : anchor.y;

    setPosition({ left: Math.max(8, left), top });
  }, [anchor.x, anchor.y]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div className="menu" ref={ref} style={{ left: position.left, top: position.top }}>
      {searchable ? (
        <div style={{ padding: '4px 6px 6px' }}>
          <input
            autoFocus
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: '100%', fontSize: 13, color: 'var(--text-primary)' }}
          />
        </div>
      ) : null}

      {filtered.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className={`menu-item${option.value === selected ? ' is-active' : ''}`}
          onClick={() => {
            onSelect(option.value);
            onClose();
          }}
        >
          {option.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {option.label}
          </span>
          {option.value === selected ? (
            <span className="check">
              <Icon.Check size={13} />
            </span>
          ) : option.hint ? (
            <span className="check" style={{ color: 'var(--text-quaternary)' }}>
              {option.hint}
            </span>
          ) : null}
        </button>
      ))}

      {filtered.length === 0 ? (
        <div style={{ padding: '10px', color: 'var(--text-quaternary)', fontSize: 12 }}>
          No matches
        </div>
      ) : null}
    </div>
  );
}

export function useMenu(): {
  anchor: { x: number; y: number } | null;
  open: (event: { clientX: number; clientY: number; currentTarget: Element }) => void;
  close: () => void;
} {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const open = useCallback(
    (event: { clientX: number; clientY: number; currentTarget: Element }) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor({ x: rect.left, y: rect.bottom + 4 });
    },
    [],
  );

  const close = useCallback(() => setAnchor(null), []);

  return { anchor, open, close };
}

/* ----------------------------------------------------------- markdown -- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
    )
    .replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noreferrer noopener">$2</a>',
    );
}

/**
 * Deliberately small: bd descriptions use headings, lists, fences, tables and
 * inline code. Everything is escaped before any tag is introduced.
 */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  let inFence = false;
  let fenceLang = '';
  let fenceBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];
  let tableBuffer: string[] = [];

  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = (): void => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  const flushTable = (): void => {
    if (!tableBuffer.length) return;

    const rows = tableBuffer
      .filter((row) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(row) || row.includes('---') === false)
      .filter((row) => !/^[\s|:-]+$/.test(row));

    const cells = rows.map((row) =>
      row
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    );

    if (cells.length) {
      const [head, ...body] = cells;
      out.push('<table><thead><tr>');
      for (const cell of head!) out.push(`<th>${renderInline(cell)}</th>`);
      out.push('</tr></thead><tbody>');
      for (const row of body) {
        out.push('<tr>');
        for (const cell of row) out.push(`<td>${renderInline(cell)}</td>`);
        out.push('</tr>');
      }
      out.push('</tbody></table>');
    }

    tableBuffer = [];
  };

  for (const line of lines) {
    const fence = /^```(\w*)\s*$/.exec(line);

    if (fence) {
      if (inFence) {
        out.push(
          `<pre><code${fenceLang ? ` class="language-${escapeHtml(fenceLang)}"` : ''}>${escapeHtml(fenceBuffer.join('\n'))}</code></pre>`,
        );
        fenceBuffer = [];
        inFence = false;
        fenceLang = '';
      } else {
        flushParagraph();
        flushList();
        flushTable();
        inFence = true;
        fenceLang = fence[1] ?? '';
      }
      continue;
    }

    if (inFence) {
      fenceBuffer.push(line);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      flushList();
      tableBuffer.push(line);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1]!.length, 3);
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line.trim()) && line.trim().length >= 3) {
      flushParagraph();
      flushList();
      out.push('<hr />');
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${renderInline(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${renderInline(numbered[1]!)}</li>`);
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      out.push(`<blockquote>${renderInline(quote[1]!)}</blockquote>`);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (inFence && fenceBuffer.length) {
    out.push(`<pre><code>${escapeHtml(fenceBuffer.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  flushTable();

  return out.join('\n');
}

export function Markdown({ source }: { source: string }): JSX.Element {
  return (
    <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />
  );
}

/* ------------------------------------------------------- autosize box -- */

export function AutoTextarea({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      rows={1}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
