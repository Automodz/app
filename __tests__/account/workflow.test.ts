/**
 * THE ACCOUNT - ONE OF EACH, AND A WAY OUT.
 *
 * Deleting an account is the only irreversible act a customer can perform, and
 * it was the one thing this product could not do at all. These assertions cover
 * what it must erase, what it must NOT erase, and the fact that none of it can
 * be reached without proving who you are.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { Service, User } from '@/lib/types';
import type { CustomerPicture } from '@/lib/customer/picture';
import { toYou } from '@/lib/customer/project';

/* The account room, as it actually renders. These used to grep `project.ts`
   for literals like `href: '/privacy'` - which asserted how the address was
   SPELLED rather than where the control goes, and broke the moment the
   projection started resolving through `navigation/resolve` like every other
   one. Behaviour is the thing worth pinning. */
const picture = (over: Partial<CustomerPicture> = {}): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com',
    role: 'customer' } as User,
  cars: [], subscription: null, subscriptions: [], invoices: [], notifications: [],
  catalogue: [] as Service[],
  addresses: [], approvals: [], ...over,
});

const youHrefs = () => {
  const m = toYou(picture());
  return [
    m.garage, m.notifications, m.ownership, m.privacy,
    m.details, m.terms, m.deletion, m.support,
  ]
    .flatMap(e => (e ? [e.action.href] : []))
    .concat(m.membership ? [m.membership.action.href] : []);
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const del = codeOf('lib/server/deleteAccount.ts');
const route = codeOf('app/api/account/delete/route.ts');
const settings = codeOf('components/you/AccountSettings.tsx');
const project = codeOf('lib/customer/project.ts');

describe('one profile, one preference source', () => {
  const sources = [...walk('lib'), ...walk('components'), ...walk('app')]
    .filter(f => !f.includes('node_modules'));

  it('only one module writes a customer profile', () => {
    const writers = sources.filter(f => /export const updateUserProfile/.test(codeOf(f)));
    expect(writers).toEqual(['lib/services/auth.ts']);
  });

  it('there is exactly one notification preference shape', () => {
    const declarers = sources.filter(f => /interface NotificationPrefs/.test(codeOf(f)));
    expect(declarers).toEqual(['lib/types.ts']);
  });

  it('the settings sheet writes preferences through that one service', () => {
    /* Against the ACCOUNT it loaded, not the client store's user. `/you`
       renders on the server and mounts no `AuthProvider`, so that user is
       always null there - every switch moved on screen and wrote nothing. */
    expect(settings).toMatch(/updateUserProfile\(account\.uid, \{ notificationPrefs: next \}\)/);
  });

  it('a preference is saved when touched, not behind a Save button', () => {
    /* A customer who switches something off and closes the sheet must not
       still be sent it. */
    expect(settings).toMatch(/const togglePref[\s\S]{0,400}await updateUserProfile/);
  });

  it('the job that sends reminders reads the same store', () => {
    expect(codeOf('lib/server/retention.ts')).toMatch(/notificationPrefs/);
  });

});

describe('deleting an account', () => {
  it('exists at all, and in-app', () => {
    /* Apple 5.1.1(v): an app with account creation must offer deletion inside
       the app. A link to "email us" is a rejection. */
    expect(settings).toMatch(/\/api\/account\/delete/);
    expect(youHrefs()).toContain('/you?panel=delete');
  });

  it('is server-authoritative', () => {
    /* A client can delete neither its own Auth user nor the business records
       that must be anonymised - the rules refuse both, correctly. */
    expect(del).toMatch(/adminAuth/);
    expect(del).toMatch(/adminDb/);
  });

  it('acts only on the verified caller, never on an id from the body', () => {
    expect(route).toMatch(/verifyIdToken\(authHeader\.slice\(7\), true\)/);
    expect(route).not.toMatch(/body[\s\S]{0,40}uid/);
  });

  it('refuses a staff account', () => {
    expect(route).toMatch(/'staff-account'/);
  });

  it('erases what belongs to the person', () => {
    for (const owned of ['vehicles', 'fcmTokens', 'savedCars', 'notifications']) {
      expect(del).toContain(owned);
    }
    expect(del).toMatch(/userRef\.delete\(\)/);
  });

  it('erases subcollections explicitly, because Firestore does not cascade', () => {
    /* Deleting the user document alone orphans every subcollection forever. */
    expect(del).toMatch(/for \(const sub of \['vehicles', 'fcmTokens', 'savedCars'\]/);
  });

  it('does NOT erase the studio’s books - it anonymises them', () => {
    /* Deleting these would destroy the studio's financial record and detach a
       warranty from the work that created it. */
    for (const kept of ['bookings', 'subscriptions', 'invoices', 'jobs']) {
      expect(del).toMatch(new RegExp(`anonymiseAll\\([\\s\\S]{0,80}${kept}`));
    }
    expect(del).toMatch(/Deleted account/);
  });

  it('never deletes a sealed visit', () => {
    /* §16 - history is permanent. Visits carry no personal fields anyway. */
    expect(del).not.toMatch(/collection\('visits'\)/);
  });

  it('deletes the sign-in LAST', () => {
    const authAt = del.indexOf('adminAuth.deleteUser');
    const profileAt = del.indexOf('userRef.delete()');
    expect(authAt).toBeGreaterThan(profileAt);
  });

  it('is idempotent, so a retry finishes rather than fails', () => {
    expect(del).toMatch(/auth\/user-not-found/);
    expect(del).toMatch(/!d\.data\(\)\.deletedAt/);
  });

  it('batches under the Firestore write limit', () => {
    expect(del).toMatch(/BATCH_LIMIT = 400/);
  });

  it('requires the customer to type the word, not just tap twice', () => {
    expect(settings).toMatch(/toUpperCase\(\) !== 'DELETE'/);
  });

  it('drops the local session once the account is gone', () => {
    expect(settings).toMatch(/signOut\(auth\)/);
    expect(settings).toMatch(/clearSession\(\)/);
  });
});

describe('privacy and terms are published', () => {
  /* Comments stripped: the page's own comment EXPLAINS that it carries no
     `force-dynamic`, and a raw read matched its own explanation. */
  const privacy = codeOf('app/privacy/page.tsx');
  const terms = codeOf('app/terms/page.tsx');
  const legal = readFileSync('lib/legal.ts', 'utf8');

  it('both exist at stable public addresses', () => {
    expect(privacy).toMatch(/export default async function PrivacyPage/);
    expect(terms).toMatch(/export default async function TermsPage/);
  });

  it('neither requires a session', () => {
    /* Apple needs a privacy policy reachable without signing in, and so does
       anyone deciding whether to sign up. */
    expect(privacy).not.toMatch(/ServerRoom|currentSession|force-dynamic/);
    expect(terms).not.toMatch(/ServerRoom|currentSession|force-dynamic/);
  });

  it('the content is written once, not twice', () => {
    expect(privacy).toMatch(/from '@\/lib\/legal'/);
    expect(terms).toMatch(/from '@\/lib\/legal'/);
  });

  it('the privacy policy describes the deletion this code performs', () => {
    expect(legal).toMatch(/Deleting your account/);
    expect(legal).toMatch(/name, email and phone removed/);
  });

  it('it states plainly that no card details are held', () => {
    /* True because there is no payment gateway in the product. */
    expect(legal).toMatch(/do not take card or bank details/);
  });

  it('both are reachable from the account room', () => {
    expect(youHrefs()).toEqual(expect.arrayContaining(['/privacy', '/terms']));
  });
});

describe('no control is inert', () => {
  it('every You entry points somewhere real', () => {
    const hrefs = youHrefs();
    expect(hrefs.length).toBeGreaterThan(4);
    for (const h of hrefs) {
      /* A control on the account room that opens the account room is inert
         (§10.5), and an address that is not an address is worse. */
      expect(h).not.toBe('/you');
      expect(h).not.toMatch(/undefined|null/);
    }
    /* No two controls lead to the same place. */
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('every entry but support is an address in this product', () => {
    const m = toYou(picture());
    /* `m.ownership` STOOD IN THIS LIST - "Bring someone with you", the door
       to the referral panel. The programme is removed, so the row is gone from
       the model rather than left pointing nowhere. */
    for (const e of [m.garage, m.notifications, m.privacy,
      m.details, m.terms, m.deletion]) {
      expect(e?.action.href.startsWith('/')).toBe(true);
    }
    /* §20.1 - support is the one control that deliberately leaves: it reaches
       a human at the studio, and the studio answers on WhatsApp. The old
       assertion never covered it, because it only read `href: '…'` literals
       and this one is built by `waLink`. */
    expect(m.support.action.href).toMatch(/^https:\/\/wa\.me\//);
  });
});
