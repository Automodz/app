/**
 * Error reporting, over the wire, with no SDK.
 *
 * The booking route is the only way a visit comes into existence, so a 500
 * there is a studio that has stopped taking money. Until now nothing would say
 * so: there is no analytics, no error tracking, and Vercel logs are read by
 * nobody at 9pm on a Sunday.
 *
 * This posts Sentry's Store envelope directly. That is a deliberate choice over
 * `@sentry/nextjs`: the SDK would add ~40 kB to every client bundle and a
 * build-time plugin, to solve a problem that is one HTTPS POST. Reports carry
 * the ids that make an incident findable - user, booking, vehicle, promo - and
 * nothing else. No tokens, no bodies, no prices.
 *
 * Entirely optional: with `SENTRY_DSN` unset this is a no-op, so a missing
 * secret can never take the studio down.
 */

const DSN = process.env.SENTRY_DSN;
const ENV = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12);

/** DSN → the ingest URL and public key Sentry expects. */
const endpoint = (() => {
  if (!DSN) return null;
  try {
    const u = new URL(DSN);
    const projectId = u.pathname.replace(/^\//, '');
    return {
      url: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      key: u.username,
    };
  } catch {
    return null;
  }
})();

export interface ReportContext {
  /** where it happened, e.g. 'booking.create' */
  op: string;
  userId?: string;
  bookingId?: string;
  jobId?: string;
  vehicleId?: string;
  serviceId?: string;
  promoId?: string;
  /** how many times the Firestore transaction was attempted, when known */
  attempts?: number;
  /** anything else safe to say out loud - never a secret, never a price */
  extra?: Record<string, string | number | boolean | undefined>;
}

const SECRET = /(token|secret|key|password|authorization|cookie|private)/i;

/** Belt and braces: drop anything whose NAME smells like a credential. */
const scrub = (o: Record<string, unknown> = {}) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (SECRET.test(k)) continue;
    if (typeof v === 'string' && v.length > 200) { out[k] = v.slice(0, 200) + '…'; continue; }
    if (v !== undefined) out[k] = v;
  }
  return out;
};

export const reportError = async (err: unknown, ctx: ReportContext): Promise<void> => {
  const e = err instanceof Error ? err : new Error(String(err));

  // always leave a trace in the platform log, DSN or not
  console.error(`[${ctx.op}]`, e.message, scrub({ ...ctx, extra: undefined }));

  if (!endpoint) return;
  try {
    await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth':
          `Sentry sentry_version=7, sentry_key=${endpoint.key}, sentry_client=automodz/1.0`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        platform: 'node',
        level: 'error',
        environment: ENV,
        ...(RELEASE ? { release: RELEASE } : {}),
        transaction: ctx.op,
        logger: 'automodz',
        // the identity of the person affected - id only, never name or phone
        ...(ctx.userId ? { user: { id: ctx.userId } } : {}),
        tags: scrub({
          op: ctx.op,
          bookingId: ctx.bookingId,
          jobId: ctx.jobId,
          vehicleId: ctx.vehicleId,
          serviceId: ctx.serviceId,
          promoId: ctx.promoId,
        }),
        extra: scrub({ attempts: ctx.attempts, ...(ctx.extra ?? {}) }),
        exception: {
          values: [{
            type: e.name,
            value: e.message,
            stacktrace: e.stack
              ? { frames: e.stack.split('\n').slice(1, 12).map(f => ({ function: f.trim() })) }
              : undefined,
          }],
        },
      }),
      // never let reporting delay or fail the request it is reporting on
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* the studio does not go down because the telemetry did */
  }
};
