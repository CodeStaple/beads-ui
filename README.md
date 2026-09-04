# beads-linear

A live, Linear-identical interface for the [beads](https://github.com/gastownhall/beads)
issue tracker, with **GitHub as the database**.

No server database, no ORM, no migrations. A single JSONL file in a GitHub
repository holds every bead. The app reads it, writes commits back to it, and
streams changes to every open tab — including changes made by `bd` on someone
else's laptop.

## Why this shape

`bd` keeps issues in a local Dolt database and syncs peer-to-peer over
`refs/dolt/data`. That is excellent for agents on a machine and useless for a
browser. But beads ships a documented interchange format for exactly this case —
its own config calls it *"JSONL auto-export for viewers, interchange"*:

```
bd export  ->  .beads/issues.jsonl  ->  bd import
```

That file is the seam this app plugs into. Because the JSONL is the canonical
export format, everything written here stays legible to `bd`, and everything
`bd` writes stays legible here.

## GitHub as the database

| Database concept | GitHub mechanism |
| --- | --- |
| Table | `.beads/issues.jsonl` on a data branch |
| Row | one JSON object per line |
| Read | Contents API (Git Data blobs API above 1 MB) |
| Write | `PUT /contents` — one commit per mutation |
| Optimistic concurrency | the blob `sha` is a compare-and-swap token |
| Conflict handling | 409 → re-read, replay the mutation, retry (4 attempts) |
| Audit log | `git log` of the file, surfaced as **Database history** |
| Point-in-time restore | `git checkout <sha> -- .beads/issues.jsonl` |

Writes never blind-overwrite. Every mutation reads the current blob, applies
itself to fresh state, and submits with the sha it read. If anything else
committed in between, GitHub rejects the write and the mutation replays rather
than clobbering the other change.

## Live updates

One poll loop per server process watches the blob sha and fans every new
snapshot out over Server-Sent Events, so N open tabs cost one GitHub request per
interval instead of N. A change pushed to GitHub from outside the app —
`bd export` then `git push`, or an edit in the GitHub web UI — reaches the
browser in about a second with no reload. Local mutations paint optimistically
and reconcile when the commit lands.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in GITHUB_TOKEN (needs `repo` scope)
npm run dev                    # http://localhost:4311
```

The token needs `repo` scope; `gh auth token` produces a usable one.

First run against an empty repository:

```bash
curl -X POST http://localhost:4311/api/bootstrap   # creates the branch + file
```

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `GITHUB_TOKEN` | — | required, `repo` scope |
| `GITHUB_OWNER` / `GITHUB_REPO` | — | required, the repository holding the data |
| `GITHUB_BRANCH` | `beads-db` | data branch, kept off `main` on purpose |
| `GITHUB_PATH` | `.beads/issues.jsonl` | the database file |
| `BEADS_PREFIX` | `so` | id prefix when the file is empty |
| `BEADS_ACTOR` | `beads-linear` | author on comments and dependency edges |
| `POLL_INTERVAL_MS` | `5000` | how often the server checks GitHub |

## Keeping `bd` and the app in sync

```bash
scripts/bd-sync.sh diff    # what pulling would change (bd import --dry-run)
scripts/bd-sync.sh pull    # GitHub  -> local bd workspace
scripts/bd-sync.sh push    # local bd workspace -> GitHub
```

## The interface

The visual language is Linear's, taken from `linear.app` by reading the computed
`:root` custom properties out of the live site rather than eyeballing
screenshots — `#08090a` app background, `#0f1011` panel, `#1e2022` surface,
`#e4e5e9` text, `#5e6ad2` accent, Inter with a 13px base and Linear's
11/12/13/15px scale.

- **Grouped issue list** — sticky group headers, priority and state icons,
  labels, comment counts, relative dates, assignee avatars
- **Board** — kanban across whichever field you group by
- **Issue detail** — inline-editable title and body, markdown rendering with
  tables and code fences, comments, dependency links
- **Command palette** — `⌘K`, searches commands and every bead
- **Dependency graph** — longest-path layering, blockers flowing left to right
- **Database history** — the commit log of the JSONL file

### Keyboard

| Key | Action |
| --- | --- |
| `⌘K` | command palette |
| `C` | new issue |
| `J` / `K` or `↑` / `↓` | move through the list |
| `Enter` | open the focused issue |
| `E` | toggle In Progress |
| `D` | toggle Done |
| `⌘↵` | submit a comment or dialog |

## Beads fidelity

All seven `bd` statuses (`open`, `in_progress`, `blocked`, `deferred`, `closed`,
`pinned`, `hooked`), all nine issue types, priorities `0`–`4`, and the
`blocks` / `related` / `parent-child` / `discovered-from` dependency types.
`design`, `acceptance_criteria` and `notes` are first-class editable sections.

**Ready** reimplements `bd ready`: an open bead with no open blocker.

Unknown fields on a record are preserved verbatim through a read-modify-write,
so a newer `bd` release adding a column will not lose data here.

## Layout

```
src/lib/beads.ts     domain model, JSONL codec, readiness rules
src/lib/github.ts    the database driver — reads, CAS writes, branch bootstrap
src/lib/db.ts        repository layer: mutations with conflict replay
src/lib/watcher.ts   shared poll loop, fanned out over SSE
src/app/api/         REST surface over the above
src/components/      the interface
```

## Limits

- No auth. It is a local tool against a repository you can already push to;
  put it behind something before exposing it.
- GitHub's API allows 5,000 requests/hour. The shared watcher keeps a running
  instance at ~720/hour at the default interval.
- The Contents API commits whole files, so the JSONL is rewritten per mutation.
  Fine into the low thousands of beads; past that, shard the file.
- "My issues" infers an identity from the most frequent assignee, since there
  is no login.
