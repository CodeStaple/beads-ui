import { NextResponse, type NextRequest } from 'next/server';
import { watcherFor } from '@/lib/watcher';
import { requireTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-sent events carrying every new snapshot of the GitHub-backed database,
 * so a change made by `bd` + `git push` shows up without a reload.
 */
export async function GET(request: NextRequest): Promise<Response> {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    // An unauthenticated or half-onboarded client gets a plain error rather
    // than a stream it would retry against forever.
    return NextResponse.json({ error: 'Not available', code: 'auth' }, { status: 401 });
  }

  const watcher = watcherFor(tenant.org.id, tenant.config);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;

      const send = (event: string, data: unknown): void => {
        if (!open) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          open = false;
        }
      };

      const unsubscribe = watcher.subscribe((snapshot) => {
        send('snapshot', {
          issues: snapshot.issues,
          sha: snapshot.sha,
          headSha: snapshot.headSha,
          skipped: snapshot.skipped,
          at: snapshot.at,
        });
      });

      // Keeps proxies from closing an idle connection.
      const heartbeat = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          open = false;
        }
      }, 20_000);

      const close = (): void => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      request.signal.addEventListener('abort', close);
      send('hello', { intervalMs: watcher.intervalMs });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
