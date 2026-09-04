import { NextResponse } from 'next/server';
import { ConflictError, GitHubError, MissingConfigError } from './github';
import { NotFoundError, ValidationError } from './db';

export function fail(error: unknown): NextResponse {
  if (error instanceof MissingConfigError) {
    return NextResponse.json({ error: error.message, code: 'not_configured' }, { status: 503 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message, code: 'not_found' }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, code: 'invalid' }, { status: 400 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message, code: 'conflict' }, { status: 409 });
  }
  if (error instanceof GitHubError) {
    return NextResponse.json(
      { error: error.message, code: 'github', detail: error.body.slice(0, 500) },
      { status: error.status === 404 ? 404 : 502 },
    );
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  return NextResponse.json({ error: message, code: 'unknown' }, { status: 500 });
}

export const noStore = { 'Cache-Control': 'no-store, max-age=0' } as const;
