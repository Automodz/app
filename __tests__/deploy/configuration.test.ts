/**
 * THE DEPLOYMENT CHECKLIST IS A FILE, AND IT MUST BE COMPLETE.
 *
 * `.env.example` is what somebody copies when they set the product up. A key
 * the code READS and that file does not NAME is a feature that silently does
 * not exist in production - and four of them were missing:
 *
 *   CLOUDINARY_API_KEY / _SECRET / CLOUDINARY_CLOUD_NAME
 *       `/api/media/sign` answers 503 without them, so NO photograph can be
 *       uploaded: not a certificate, not a car, not a sell request. The file
 *       still advertised `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, which was
 *       removed when uploads became signed - an invitation to re-create the
 *       unsigned preset that shipped the write permission in the bundle.
 *
 *   CRON_SECRET
 *       The nightly job FAILS CLOSED. Unset, it refuses every request, so no
 *       retention reminders, no membership expiry, no stale bookings aged out
 *       and no daily figures - for ever, silently.
 *
 *   NEXT_PUBLIC_SITE_URL
 *       Canonicals, the sitemap and every shared link.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const EXAMPLE = readFileSync('.env.example', 'utf8');
const documented = new Set(
  [...EXAMPLE.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]),
);

/** Every key the product reads at runtime. */
const read = new Set<string>();
for (const f of [...walk('lib'), ...walk('app'), ...walk('components'), ...walk('navigation')]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    read.add(m[1]);
  }
}

/**
 * Set by the platform or by a test harness, never by a human filling in a
 * file. Naming them in the checklist would be telling somebody to invent a
 * value the platform is about to overwrite.
 */
const PROVIDED = new Set([
  'NODE_ENV',
  'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_GIT_COMMIT_SHA',
  'FIRESTORE_EMULATOR_HOST', 'NEXT_PUBLIC_FIREBASE_EMULATOR',
]);

describe('every key the code reads is on the checklist', () => {
  it('nothing the product needs is missing from .env.example', () => {
    const missing = [...read].filter(k => !PROVIDED.has(k) && !documented.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('and nothing on the checklist is dead', () => {
    /* A key nobody reads is a key somebody will fill in and wonder about. */
    const dead = [...documented].filter(k => !read.has(k)).sort();
    /* `NEXT_PUBLIC_WHATSAPP_NUMBER` is read through `lib/company.ts`'s own
       constant rather than `process.env` directly; it stays documented because
       it is genuinely configuration. */
    expect(dead.filter(k => k !== 'NEXT_PUBLIC_WHATSAPP_NUMBER')).toEqual([]);
  });

  it('THE UNSIGNED UPLOAD PRESET IS GONE, and stays gone', () => {
    /* It shipped the cloud name AND the permission to write to it in the
       public bundle. Nothing reads it; nothing should offer it. */
    expect(EXAMPLE).not.toMatch(/CLOUDINARY_UPLOAD_PRESET/);
    /* Code, not prose: `lib/server/cloudinary.ts` names it in the comment that
       explains why it was removed, and that note is worth keeping. */
    const codeOf = (p: string) =>
      readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const f of [...walk('lib'), ...walk('app'), ...walk('components')]) {
      expect({ f, uses: /CLOUDINARY_UPLOAD_PRESET/.test(codeOf(f)) })
        .toEqual({ f, uses: false });
    }
  });

  it('the three server-side Cloudinary values are named, because uploads need them', () => {
    for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      expect({ k, documented: documented.has(k) }).toEqual({ k, documented: true });
    }
  });

  it('and the nightly job’s secret is named, because it fails closed', () => {
    expect(documented.has('CRON_SECRET')).toBe(true);
    const cron = readFileSync('app/api/cron/daily/route.ts', 'utf8');
    /* Fails CLOSED - an unset secret must refuse, never run for the world. */
    expect(cron).toMatch(/if \(!secret \|\|/);
  });
});

describe('the platform is told what to run and when', () => {
  it('the nightly job is scheduled', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons?: { path: string; schedule: string }[];
    };
    expect(vercel.crons).toEqual([
      expect.objectContaining({ path: '/api/cron/daily' }),
    ]);
    expect(vercel.crons?.[0].schedule).toMatch(/^\S+ \S+ \S+ \S+ \S+$/);
  });

  it('and every composite query the product makes has an index declared', () => {
    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
      indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[];
    };
    /* Single-field indexes are automatic and the API REFUSES a declared one,
       which aborts the deploy of every real index alongside it. */
    expect(idx.indexes.filter(i => i.fields.length === 1)).toEqual([]);
    expect(idx.indexes.length).toBeGreaterThan(5);
  });
});
