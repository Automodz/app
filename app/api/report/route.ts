import { NextRequest, NextResponse } from 'next/server';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * The sink for unhandled exceptions in the browser.
 *
 * The error boundaries already catch every client crash and show a calm screen;
 * until now that was all they did, so nobody ever learned a screen had broken.
 * They post here instead of loading a browser SDK - the whole client cost is a
 * `fetch` in a component that only renders when something has already failed.
 *
 * Deliberately unauthenticated: a crash may well BE the auth layer failing, and
 * a report that needs a working session is a report you never get. It is
 * therefore treated as untrusted - message and digest are truncated, everything
 * else is discarded, and the response body is empty either way.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { message?: string; digest?: string; where?: string; stack?: string } | null;

  const message = String(body?.message ?? 'client error').slice(0, 300);
  const where = String(body?.where ?? 'client').slice(0, 60).replace(/[^a-zA-Z0-9._/-]/g, '');

  const e = new Error(message);
  e.name = 'ClientError';
  e.stack = typeof body?.stack === 'string' ? body.stack.slice(0, 2000) : undefined;

  await reportError(e, {
    op: `client.${where || 'unknown'}`,
    extra: { digest: String(body?.digest ?? '').slice(0, 60) },
  });

  return new NextResponse(null, { status: 204 });
}
