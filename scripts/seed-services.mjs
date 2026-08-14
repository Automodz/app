/**
 * WRITE THE STUDIO'S CATALOGUE TO FIRESTORE.
 *
 * The catalogue itself lives in `lib/catalogue/services.ts`, which is the
 * reviewable source of truth. This only carries it across.
 *
 *   node scripts/seed-services.mjs            # show what WOULD change
 *   node scripts/seed-services.mjs --apply    # write it
 *
 * IT IS A PRODUCTION WRITE, so it does nothing without `--apply` and it prints
 * the exact diff first. Run the dry pass, read it, then apply.
 *
 * ── WHAT IT DOES, PRECISELY ──────────────────────────────────────────────
 *   · upserts each of the 18 services by a STABLE id, so running it twice is
 *     the same as running it once and a re-run corrects a hand edit
 *   · sets `active: false` on the seven placeholders, and NEVER deletes them -
 *     bookings, jobs and sealed visits point at those ids, and deleting the
 *     service a paid record refers to would rewrite history
 *   · preserves `createdAt` on anything that already exists
 *
 * It reads the same `.env.local` credentials the app does.
 */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

/* The catalogue is TypeScript, and this is a plain node script, so the entries
   are parsed out of the source rather than duplicated here - one source of
   truth, and a drift between the two is impossible by construction. */
const src = readFileSync(new URL('../lib/catalogue/services.ts', import.meta.url), 'utf8');

const block = src.slice(src.indexOf('export const CATALOGUE'), src.indexOf('export const RETIRED_SERVICE_IDS'));
const entries = [...block.matchAll(/\{\s*\n?\s*id: '([^']+)',([\s\S]*?)\n  \},/g)].map(([, id, body]) => {
  const pick = (k) => {
    const m = body.match(new RegExp(`${k}: (?:'([^']*)'|(null|true|false|\\d+))`));
    if (!m) return undefined;
    if (m[1] !== undefined) return m[1];
    if (m[2] === 'null') return null;
    if (m[2] === 'true') return true;
    if (m[2] === 'false') return false;
    return Number(m[2]);
  };
  return {
    id,
    category: pick('category'),
    brand: pick('brand') ?? null,
    name: pick('name'),
    description: pick('description') ?? '',
    price: pick('price'),
    duration: pick('duration'),
    warranty: pick('warranty') ?? null,
    popular: pick('popular') ?? false,
    active: pick('active') ?? true,
    order: pick('order'),
  };
});

const retired = [...src.matchAll(/'(svc-[a-z-]+)'/g)].map(m => m[1]);

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

if (entries.length !== 18) {
  console.error(`Parsed ${entries.length} services, expected 18. Refusing to run.`);
  process.exit(1);
}

const existing = new Map((await db.collection('services').get()).docs.map(d => [d.id, d.data()]));

console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} - ${entries.length} services, ${retired.length} to retire\n`);
let created = 0; let updated = 0; let unchanged = 0;

for (const s of entries) {
  const before = existing.get(s.id);
  const differs = !before || ['name', 'price', 'duration', 'category', 'brand', 'warranty', 'active', 'order', 'popular']
    .some(k => before[k] !== s[k]);
  const mark = !before ? 'create' : differs ? 'update' : 'same  ';
  if (!before) created++; else if (differs) updated++; else unchanged++;
  console.log(`  ${mark}  ${s.id.padEnd(30)} ${String(s.price).padStart(7)}  ${String(s.duration).padStart(5)}m  ${s.category}`);
  if (APPLY && differs) {
    await db.collection('services').doc(s.id).set({
      ...s,
      createdAt: before?.createdAt ?? Timestamp.fromDate(new Date()),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

console.log('');
for (const id of retired) {
  const before = existing.get(id);
  if (!before) { console.log(`  absent  ${id}`); continue; }
  if (before.active === false) { console.log(`  retired ${id} (already)`); continue; }
  console.log(`  RETIRE  ${id.padEnd(30)} -> active: false  (kept, never deleted)`);
  if (APPLY) {
    await db.collection('services').doc(id).set(
      { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true },
    );
  }
}

console.log(`\n  ${created} created · ${updated} updated · ${unchanged} unchanged`);
if (!APPLY) console.log('\n  Nothing was written. Re-run with --apply to commit these changes.\n');
