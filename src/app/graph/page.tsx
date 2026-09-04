'use client';

import { useMemo, type JSX } from 'react';
import Link from 'next/link';
import { isOpen, statusMeta, type Issue } from '@/lib/beads';
import { Icon, StatusIcon, typeColor } from '@/components/icons';
import { useStore } from '@/components/store';

interface Node {
  issue: Issue;
  depth: number;
  x: number;
  y: number;
}

const COLUMN_WIDTH = 250;
const ROW_HEIGHT = 46;
const NODE_WIDTH = 210;
const NODE_HEIGHT = 30;

/**
 * Longest-path layering: an issue sits one column right of everything that
 * blocks it, so dependencies always flow left-to-right.
 */
function layout(issues: Issue[]): { nodes: Node[]; edges: Array<[string, string]> } {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const edges: Array<[string, string]> = [];

  for (const issue of issues) {
    for (const dep of issue.dependencies ?? []) {
      if (byId.has(dep.depends_on_id)) edges.push([dep.depends_on_id, issue.id]);
    }
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const issue = byId.get(id);
    let best = 0;

    for (const dep of issue?.dependencies ?? []) {
      if (byId.has(dep.depends_on_id)) {
        best = Math.max(best, resolve(dep.depends_on_id) + 1);
      }
    }

    visiting.delete(id);
    depth.set(id, best);
    return best;
  };

  for (const issue of issues) resolve(issue.id);

  const columns = new Map<number, Issue[]>();
  for (const issue of issues) {
    const level = depth.get(issue.id) ?? 0;
    const bucket = columns.get(level);
    if (bucket) bucket.push(issue);
    else columns.set(level, [issue]);
  }

  const nodes: Node[] = [];
  for (const [level, bucket] of columns) {
    bucket.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    bucket.forEach((issue, index) => {
      nodes.push({
        issue,
        depth: level,
        x: 24 + level * COLUMN_WIDTH,
        y: 24 + index * ROW_HEIGHT,
      });
    });
  }

  return { nodes, edges };
}

export default function GraphPage(): JSX.Element {
  const { issues, ready } = useStore();

  const connected = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (issue.dependencies ?? []).length > 0 ||
          issues.some((other) =>
            (other.dependencies ?? []).some((dep) => dep.depends_on_id === issue.id),
          ),
      ),
    [issues],
  );

  const { nodes, edges } = useMemo(() => layout(connected), [connected]);
  const positions = useMemo(() => new Map(nodes.map((node) => [node.issue.id, node])), [nodes]);

  const width = Math.max(...nodes.map((node) => node.x + NODE_WIDTH + 24), 600);
  const height = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT + 24), 400);

  return (
    <>
      <header className="view-header">
        <div className="view-title">
          <Icon.Graph size={15} style={{ color: 'var(--text-tertiary)' }} />
          Dependencies
        </div>
        <span className="count-badge">{connected.length} linked</span>
        <div className="view-header-spacer" />
        <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
          Arrows point from a blocker to what it blocks
        </span>
      </header>

      {!ready ? (
        <div className="empty">
          <p>Loading the graph…</p>
        </div>
      ) : connected.length === 0 ? (
        <div className="empty">
          <h2>No dependencies yet</h2>
          <p>
            Link issues from the detail pane, or with <code>bd dep add</code>. Beads models
            blockers as first-class edges, so this view is the dependency graph itself.
          </p>
        </div>
      ) : (
        <div className="list-scroll" style={{ padding: 8 }}>
          <svg width={width} height={height} style={{ display: 'block' }}>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a3c41" />
              </marker>
            </defs>

            {edges.map(([from, to], index) => {
              const a = positions.get(from);
              const b = positions.get(to);
              if (!a || !b) return null;

              const x1 = a.x + NODE_WIDTH;
              const y1 = a.y + NODE_HEIGHT / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_HEIGHT / 2;
              const mid = (x1 + x2) / 2;

              return (
                <path
                  key={`${from}-${to}-${index}`}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#2e3035"
                  strokeWidth="1.4"
                  markerEnd="url(#arrow)"
                />
              );
            })}

            {nodes.map((node) => {
              const done = statusMeta(node.issue.status).category === 'done';
              return (
                <g key={node.issue.id} transform={`translate(${node.x}, ${node.y})`}>
                  <a href={`/issue/${node.issue.id}`}>
                    <rect
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      rx="6"
                      fill="#18191c"
                      stroke={done ? '#232428' : typeColor(node.issue.issue_type)}
                      strokeWidth="1"
                      opacity={done ? 0.55 : 1}
                    />
                    <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          height: NODE_HEIGHT,
                          padding: '0 9px',
                          fontSize: 12,
                          color: done ? 'var(--text-quaternary)' : 'var(--text-primary)',
                          overflow: 'hidden',
                        }}
                      >
                        <StatusIcon status={node.issue.status} size={12} />
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--text-quaternary)',
                            flexShrink: 0,
                          }}
                        >
                          {node.issue.id}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {node.issue.title}
                        </span>
                      </div>
                    </foreignObject>
                  </a>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </>
  );
}
