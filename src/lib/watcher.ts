import { loadConfig } from './github';
import { load, type Database } from './db';

export interface Snapshot {
  sha: string | null;
  headSha: string | null;
  issues: Database['issues'];
  skipped: number;
  at: number;
}

type Listener = (snapshot: Snapshot) => void;

/**
 * One poll loop per server process, fanned out to every connected client.
 * Without this, each open tab would burn its own GitHub rate limit.
 */
class Watcher {
  private listeners = new Set<Listener>();
  private timer: NodeJS.Timeout | null = null;
  private latest: Snapshot | null = null;
  private inFlight: Promise<Snapshot> | null = null;

  get intervalMs(): number {
    const raw = Number(process.env['POLL_INTERVAL_MS'] ?? '5000');
    return Number.isFinite(raw) && raw >= 1000 ? raw : 5000;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.latest) listener(this.latest);
    this.start();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** Coalesces concurrent callers onto a single in-flight GitHub read. */
  async refresh(force = false): Promise<Snapshot> {
    if (!force && this.inFlight) return this.inFlight;

    const work = (async () => {
      const database = await load(loadConfig());
      const snapshot: Snapshot = {
        sha: database.sha,
        headSha: database.headSha,
        issues: database.issues,
        skipped: database.skipped,
        at: Date.now(),
      };

      const changed = this.latest?.sha !== snapshot.sha;
      this.latest = snapshot;
      if (changed) this.emit(snapshot);

      return snapshot;
    })();

    this.inFlight = work;
    try {
      return await work;
    } finally {
      if (this.inFlight === work) this.inFlight = null;
    }
  }

  current(): Snapshot | null {
    return this.latest;
  }

  /** Called after a local write so other tabs see it without waiting a tick. */
  publish(database: Database): void {
    const snapshot: Snapshot = {
      sha: database.sha,
      headSha: database.headSha,
      issues: database.issues,
      skipped: database.skipped,
      at: Date.now(),
    };
    this.latest = snapshot;
    this.emit(snapshot);
  }

  private emit(snapshot: Snapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A broken client must not stop the fan-out.
      }
    }
  }

  private start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.refresh().catch(() => undefined);
    }, this.intervalMs);
    void this.refresh().catch(() => undefined);
  }

  private stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

const globalKey = Symbol.for('beads-linear.watcher');
type GlobalWithWatcher = typeof globalThis & { [globalKey]?: Watcher };

/** Survives Next.js dev-server module reloads. */
export const watcher: Watcher =
  (globalThis as GlobalWithWatcher)[globalKey] ??
  ((globalThis as GlobalWithWatcher)[globalKey] = new Watcher());
