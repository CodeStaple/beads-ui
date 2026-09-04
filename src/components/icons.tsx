import type { JSX, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------- status -- */

const STATUS_COLOR: Record<string, string> = {
  open: '#6c6f74',
  in_progress: '#f0bf00',
  blocked: '#ff5d5e',
  deferred: '#6c6f74',
  closed: '#5e6ad2',
  pinned: '#a56be0',
  hooked: '#00b8cb',
};

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? '#6c6f74';
}

/**
 * Linear draws state as a 2px-stroke ring with the completion fraction swept
 * out of the middle as a pie. Each bd status picks a fraction and a colour.
 */
export function StatusIcon({
  status,
  size = 14,
}: {
  status: string;
  size?: number;
}): JSX.Element {
  const color = statusColor(status);

  if (status === 'closed') {
    return (
      <Svg size={size}>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path
          d="M4.6 8.2 6.9 10.5 11.4 5.9"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (status === 'deferred') {
    return (
      <Svg size={size}>
        <circle
          cx="8"
          cy="8"
          r="6.2"
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray="2.2 2.2"
        />
      </Svg>
    );
  }

  if (status === 'blocked') {
    return (
      <Svg size={size}>
        <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" />
        <rect x="4.8" y="7.2" width="6.4" height="1.7" rx="0.85" fill={color} />
      </Svg>
    );
  }

  if (status === 'pinned') {
    return (
      <Svg size={size}>
        <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" />
        <circle cx="8" cy="8" r="2.6" fill={color} />
      </Svg>
    );
  }

  if (status === 'hooked') {
    return (
      <Svg size={size}>
        <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" opacity="0.4" />
        <path
          d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="2.2" fill={color} />
      </Svg>
    );
  }

  if (status === 'in_progress') {
    return (
      <Svg size={size}>
        <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" />
        <path d="M8 8V3.4A4.6 4.6 0 0 1 12.6 8 4.6 4.6 0 0 1 8 12.6 4.6 4.6 0 0 1 8 8Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg size={size}>
      <circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

/* ----------------------------------------------------------- priority -- */

/** Three ascending bars, filled up to the priority level; urgent is a badge. */
export function PriorityIcon({
  priority,
  size = 14,
}: {
  priority: number;
  size?: number;
}): JSX.Element {
  if (priority === 0) {
    return (
      <Svg size={size}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#ff7235" />
        <rect x="7.1" y="3.8" width="1.8" height="5.2" rx="0.9" fill="#1a1206" />
        <rect x="7.1" y="10.4" width="1.8" height="1.8" rx="0.9" fill="#1a1206" />
      </Svg>
    );
  }

  if (priority === 4) {
    return (
      <Svg size={size}>
        <rect x="1.5" y="7.2" width="3" height="1.8" rx="0.9" fill="#6c6f74" />
        <rect x="6.5" y="7.2" width="3" height="1.8" rx="0.9" fill="#6c6f74" />
        <rect x="11.5" y="7.2" width="3" height="1.8" rx="0.9" fill="#6c6f74" />
      </Svg>
    );
  }

  const active = '#c3c4c8';
  const idle = '#3a3c41';
  const filled = 4 - priority;

  return (
    <Svg size={size}>
      <rect x="1.5" y="9" width="3.2" height="5" rx="1" fill={filled >= 1 ? active : idle} />
      <rect x="6.4" y="6" width="3.2" height="8" rx="1" fill={filled >= 2 ? active : idle} />
      <rect x="11.3" y="3" width="3.2" height="11" rx="1" fill={filled >= 3 ? active : idle} />
    </Svg>
  );
}

/* --------------------------------------------------------------- type -- */

const TYPE_COLOR: Record<string, string> = {
  bug: '#ff5d5e',
  feature: '#5e6ad2',
  task: '#8f9197',
  chore: '#6c6f74',
  epic: '#a56be0',
  decision: '#00b8cb',
  spike: '#f0bf00',
  story: '#43bc58',
  milestone: '#eb5aaa',
};

export function typeColor(type: string): string {
  return TYPE_COLOR[type] ?? '#8f9197';
}

export function TypeIcon({ type, size = 14 }: { type: string; size?: number }): JSX.Element {
  const color = typeColor(type);

  switch (type) {
    case 'bug':
      return (
        <Svg size={size}>
          <circle cx="8" cy="9" r="4" stroke={color} strokeWidth="1.4" />
          <path
            d="M8 5V3.4M4.2 6.2 2.8 5M11.8 6.2 13.2 5M3.6 9.4H2M14 9.4h-1.6M4.4 12.4 3.1 13.6M11.6 12.4l1.3 1.2"
            stroke={color}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'feature':
      return (
        <Svg size={size}>
          <path
            d="M8 1.8 9.7 6l4.3.3-3.3 2.8 1 4.2L8 11l-3.7 2.3 1-4.2L2 6.3 6.3 6 8 1.8Z"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'epic':
      return (
        <Svg size={size}>
          <rect x="2" y="2.6" width="12" height="4" rx="1.4" stroke={color} strokeWidth="1.4" />
          <rect x="2" y="9.4" width="8" height="4" rx="1.4" stroke={color} strokeWidth="1.4" />
        </Svg>
      );
    case 'decision':
      return (
        <Svg size={size}>
          <path
            d="M8 1.8 14.2 8 8 14.2 1.8 8 8 1.8Z"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'spike':
      return (
        <Svg size={size}>
          <path
            d="M9.4 1.8 3.2 9.2h4.1l-.7 5 6.2-7.4H8.7l.7-5Z"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'story':
      return (
        <Svg size={size}>
          <path
            d="M3 3.2h4.2a2 2 0 0 1 2 2v7.6a1.6 1.6 0 0 0-1.6-1.4H3V3.2ZM13 3.2H8.8a2 2 0 0 0-2 2v7.6a1.6 1.6 0 0 1 1.6-1.4H13V3.2Z"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'milestone':
      return (
        <Svg size={size}>
          <path d="M4 2.4v11.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M4 3.2h7.6l-1.8 2.5 1.8 2.5H4V3.2Z"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'chore':
      return (
        <Svg size={size}>
          <path
            d="M10.6 2.6a3.4 3.4 0 0 0-4.3 4.3l-4 4a1.4 1.4 0 0 0 2 2l4-4a3.4 3.4 0 0 0 4.3-4.3L10.4 6.6 9.4 5.6l1.2-3Z"
            stroke={color}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.6" stroke={color} strokeWidth="1.4" />
          <path
            d="M5.4 8.1 7.1 9.8l3.5-3.6"
            stroke={color}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
}

/* ------------------------------------------------------------- glyphs -- */

export const Icon = {
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="7.2" cy="7.2" r="4.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.6 10.6 2.8 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  ),
  Compose: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M12.4 2.6a1.7 1.7 0 0 1 2.4 2.4L6.6 13.2l-3.2.8.8-3.2 8.2-8.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Inbox: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M2.4 8.6h3l1 2h3.2l1-2h3M2.4 8.6 4 3.4h8l1.6 5.2v4a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1v-4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Issues: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.6 8h4.8M5.6 5.4h4.8M5.6 10.6h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  ),
  MyIssues: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </Svg>
  ),
  Board: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.2" y="2.6" width="4" height="10.8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.8" y="2.6" width="4" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </Svg>
  ),
  List: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M2.6 4.2h10.8M2.6 8h10.8M2.6 11.8h10.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  ),
  Graph: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="4" cy="4" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5" cy="12.2" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.9 4.9 10 6.3M10.6 8.7 6.6 10.9" stroke="currentColor" strokeWidth="1.3" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="m4.6 6.4 3.4 3.4 3.4-3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  ChevronRight: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="m6.4 4.2 3.6 3.8-3.6 3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 3.4v9.2M3.4 8h9.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="m3.6 8.4 3 3 5.8-6.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Filter: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M2.6 3.8h10.8L9.4 8.6v4.2l-2.8-1.6V8.6L2.6 3.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Github: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M8 1.3a6.7 6.7 0 0 0-2.1 13c.33.06.46-.14.46-.32v-1.2c-1.87.4-2.26-.9-2.26-.9-.3-.78-.75-.98-.75-.98-.6-.42.05-.4.05-.4.68.04 1.03.7 1.03.7.6 1.03 1.58.73 1.96.56.06-.44.24-.74.42-.9-1.49-.17-3.06-.75-3.06-3.32 0-.73.26-1.33.69-1.8-.07-.17-.3-.85.06-1.78 0 0 .56-.18 1.84.68a6.4 6.4 0 0 1 3.35 0c1.28-.86 1.84-.68 1.84-.68.36.93.13 1.61.07 1.78.43.47.68 1.07.68 1.8 0 2.58-1.57 3.15-3.07 3.31.24.21.46.62.46 1.25v1.86c0 .18.12.39.46.32A6.7 6.7 0 0 0 8 1.3Z"
        fill="currentColor"
      />
    </Svg>
  ),
  Blocked: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="m4.4 4.4 7.2 7.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  ),
  Link: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M6.6 9.4a2.6 2.6 0 0 0 3.9.3l1.9-1.9a2.6 2.6 0 0 0-3.7-3.7l-1 1M9.4 6.6a2.6 2.6 0 0 0-3.9-.3L3.6 8.2a2.6 2.6 0 0 0 3.7 3.7l1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M3.4 4.4h9.2M6.4 4.4V3.2a.8.8 0 0 1 .8-.8h1.6a.8.8 0 0 1 .8.8v1.2M5 4.4l.5 8.2a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9l.5-8.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Refresh: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M13.2 8a5.2 5.2 0 1 1-1.6-3.75M13.4 2.6v3.2h-3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Comment: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M13.6 8.6c0 2.6-2.5 4.7-5.6 4.7-.7 0-1.4-.1-2-.3l-3.2 1 1-2.5A4.4 4.4 0 0 1 2.4 8.6c0-2.6 2.5-4.7 5.6-4.7s5.6 2.1 5.6 4.7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  History: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M8 4.4V8l2.4 1.6M2.8 8a5.2 5.2 0 1 0 1.5-3.7M2.6 2.8V6h3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Dots: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="4" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12" cy="8" r="1.3" fill="currentColor" />
    </Svg>
  ),
  Label: (p: IconProps) => (
    <Svg {...p}>
      <path
        d="M2.6 7V3.6a1 1 0 0 1 1-1H7l6.4 6.4a1 1 0 0 1 0 1.4l-3.4 3.4a1 1 0 0 1-1.4 0L2.6 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5.4" cy="5.4" r="1" fill="currentColor" />
    </Svg>
  ),
};
