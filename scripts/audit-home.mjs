/* Home, state by state, against the deployed app. Read-only. */
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const app = initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g,'\n') })});
const db = getFirestore(app), auth = getAuth(app);
const ORIGIN = process.env.ORIGIN ?? 'https://automodz.vercel.app';

async function session(uid) {
  const tok = await auth.createCustomToken(uid);
  const ex = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tok,returnSecureToken:true})})).json();
  const s = await fetch(`${ORIGIN}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:ex.idToken})});
  return `automodz-session-id=${/automodz-session-id=([^;]+)/.exec(s.headers.get('set-cookie')||'')?.[1]??''}`;
}
const strip = h => h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');

/* Precise markers. The first pass used loose regexes and produced false
   positives on every car - "In care" is a STATE WORD as well as a photo
   caption, and `aria-current` is on the navigation bar as well as the garage
   rail. A probe that cries wolf is worse than no probe. */
const TRUTH = /(\d+ days? of protection left\.|Last cared for \d+ days ago\.|Ready for collection\.|All quiet)/;
const REGIONS = [
  ['truth',      (r,t) => TRUTH.test(t)],
  ['live-rail',  r => r.includes('>Received<') && r.includes('>Final checks<')],
  ['photos',     r => (r.match(/>On arrival<|>Finished</g) ?? []).length > 0],
  ['suggestion', r => r.includes('WORTH CONSIDERING')],
  ['protection', r => r.includes('<details')],
  ['next',       r => r.includes('NEXT VISIT')],
  ['life',       r => r.includes('Its life at')],
  ['log',        (r,t) => /(applied - protected|confirmed your Club|arrived at the studio|Work began on)/.test(t)],
  ['club',       r => r.includes('CLUB')],
  ['garage-rail',r => (r.match(/aria-current="true"/g) ?? []).length > 0],
  ['market',     (r,t) => t.includes('selling')],
];

async function look(label, jar, path='/') {
  const raw = await (await fetch(`${ORIGIN}${path}`,{headers:{cookie:jar}})).text();
  const txt = strip(raw);
  const on = REGIONS.filter(([,f]) => f(raw, txt)).map(([n]) => n);
  const cta = /class="am-tap"[^>]*background:#F4F5F6[^>]*>([^<]+)</.exec(raw)?.[1]
           ?? /background:#F4F5F6;color:#0A0B0D"[^>]*>([^<]+)</.exec(raw)?.[1] ?? '(none)';
  const truth = TRUTH.exec(txt);
  console.log(`\n  ${label}`);
  console.log(`    regions : ${on.join(' · ') || '(none)'}`);
  console.log(`    action  : ${cta}`);
  if (truth) console.log(`    truth   : ${txt.slice(Math.max(0,truth.index-40), truth.index+truth[0].length).trim()}`);
  return { raw, txt, on };
}

console.log(`AUDIT · ${ORIGIN}`);

/* ── who exists ─────────────────────────────────────────────── */
const users = await db.collection('users').get();
const rows = [];
for (const u of users.docs) {
  const cars = await db.collection('users').doc(u.id).collection('vehicles').count().get();
  rows.push({ uid: u.id, email: u.data().email, role: u.data().role, cars: cars.data().count });
}
console.log('\nACCOUNTS');
rows.forEach(r => console.log(`  ${String(r.cars).padStart(2)} cars  ${r.role ?? '?'}  ${r.email}`));

/* ── 01 new customer ────────────────────────────────────────── */
const blank = rows.find(r => r.cars === 0 && r.role !== 'admin');
if (blank) { console.log(`\n01 · BRAND-NEW CUSTOMER (${blank.email})`); await look('Home', await session(blank.uid)); }
else console.log('\n01 · no zero-car account exists to test with');

/* ── 05–08 the demo cars ────────────────────────────────────── */
const demo = await auth.getUserByEmail('sheth871@gmail.com');
const jar = await session(demo.uid);
const cars = await db.collection('users').doc(demo.uid).collection('vehicles').get();

console.log('\n02–08 · DEMO CUSTOMER, PER CAR');
const seen = {};
for (const c of cars.docs) {
  const name = c.data().name;
  const r = await look(`${name}  (${c.id})`, jar, `/?car=${c.id}`);
  seen[name] = r;
}

/* ── cross-car leakage ──────────────────────────────────────── */
console.log('\nCROSS-CAR LEAKAGE');
const names = cars.docs.map(d => d.data().name);
for (const [name, r] of Object.entries(seen)) {
  const others = names.filter(n => n !== name && r.txt.includes(n));
  /* the garage rail names every car by design - check OUTSIDE it */
  /* The garage rail names EVERY car by design - it is the navigation. Only
     what appears BEFORE it belongs to the selected car, so that is the slice
     leakage would show up in. The rail is identified by its own markup. */
  const railAt = r.raw.indexOf('aria-current');
  const own = strip(railAt > 0 ? r.raw.slice(0, railAt) : r.raw);
  const bleed = names.filter(n => n !== name && own.includes(n));
  console.log(`  ${name.padEnd(12)} own region: ${bleed.length ? 'LEAK → ' + bleed.join(', ') : 'clean ✓'}   (rail names all four, by design)`);
  void others;
}
await fetch(`${ORIGIN}/api/session`,{method:'DELETE',headers:{cookie:jar}});
process.exit(0);
