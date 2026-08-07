import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const app = initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g,'\n') })});
const auth = getAuth(app);
const ORIGIN = process.env.ORIGIN ?? 'https://automodz.vercel.app';

const u = await auth.getUserByEmail('sheth871@gmail.com');
const tok = await auth.createCustomToken(u.uid);
const ex = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tok,returnSecureToken:true})})).json();
const s = await fetch(`${ORIGIN}/api/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:ex.idToken})});
const jar = `automodz-session-id=${/automodz-session-id=([^;]+)/.exec(s.headers.get('set-cookie')||'')?.[1]??''}`;

const cars = { 'Kia Seltos (lead, in care)':'MfU7e5qLzdLvkvvi8E3o', 'BMW (booked)':'atuFTVOn7fnROvMCwgll',
               'Defender (needs attention)':'HVhtQNcvNWQelmyO0nfI', 'I20 NLine':'DYIeih9YtXdTDiNmnpPC' };
console.log(`\nHOME as ${u.email} on ${ORIGIN}`);
for (const [label, id] of Object.entries(cars)) {
  const page = await (await fetch(`${ORIGIN}/?car=${id}`,{headers:{cookie:jar}})).text();
  const mark = (n, ...needles) => needles.some(x=>page.includes(x)) ? n : '';
  console.log(`\n  ${label}`);
  console.log('    ' + [
    mark('live','Received'), mark('next','NEXT VISIT'), mark('suggestion','WORTH CONSIDERING'),
    mark('protection','<details'), mark('life','Its life at'), mark('club','CLUB'),
    mark('garage','aria-current'), mark('market','selling'),
  ].filter(Boolean).join(' · ') || '(nothing)');
}

const i20 = await (await fetch(`${ORIGIN}/?car=DYIeih9YtXdTDiNmnpPC`,{headers:{cookie:jar}})).text();
const grab = (t, re) => (re.exec(t)?.[1] ?? '(not found)').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g,'&');
console.log('\nTHE RECOMMENDATION, as a customer reads it:');
console.log('  headline:', grab(i20, />WORTH CONSIDERING<\/span>.*?>([^<]{4,90})</s));
console.log('  reason  :', grab(i20, /time to renew it[^<]*|([^<>]*days of protection left[^<]*)/));

const h = await (await fetch(`${ORIGIN}/`,{headers:{cookie:jar}})).text();
const has = (label, ...needles) =>
  console.log(`  ${needles.some(n=>h.includes(n)) ? '✓' : '✕'} ${label}`);

console.log(`\nLEAD CAR SUMMARY\n`);
has('the car, named', 'Kia Seltos', 'BMW', 'Defender');
has('live visit state', 'In care', 'Llumar', 'LLumar');
has('stage rail', 'RECEIVED', 'Received');
has('studio photographs', 'photo-1618843479313', 'photo-1601362840469');
has('one primary action', 'Follow the visit', 'Arrange a visit', 'View');
has('protection region', '<details');
has('protection layers', 'Paint protection film', 'Ceramic coating', 'Glass coating');
has('a recommendation, with reasoning', 'WORTH CONSIDERING');
has('what is coming', 'NEXT VISIT');
has('its life', 'Its life at');
has('the club', 'CLUB', 'Gold');
has('other cars as navigation', 'aria-current');
has('marketplace rail', 'selling', 'Creta', 'City');
await fetch(`${ORIGIN}/api/session`,{method:'DELETE',headers:{cookie:jar}});
process.exit(0);
