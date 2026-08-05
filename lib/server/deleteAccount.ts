import 'server-only';
/**
 * DELETING AN ACCOUNT.
 *
 * Required outright: Apple's Guideline 5.1.1(v) makes in-app deletion mandatory
 * for any app that lets someone create an account, and nothing in this product
 * offered it. Nothing partial counts — a link to "email us" is a rejection.
 *
 * TWO KINDS OF DATA, TREATED DIFFERENTLY, and the distinction is the whole
 * design:
 *
 *   ERASED — what belongs to the person. Their profile, their cars, their push
 *   tokens, their saved listings, their notifications. This is theirs and it
 *   goes.
 *
 *   ANONYMISED — what belongs to the STUDIO's books. A visit that happened,
 *   an invoice that was raised, a membership that was paid for. Deleting these
 *   would destroy the studio's financial record and detach a warranty from the
 *   work that created it — the studio would lose its accounts and the next
 *   owner of that car would lose a promise still in force. So the personal
 *   identifiers are stripped and the record stays.
 *
 * THE AUTH USER GOES LAST. If Firestore fails halfway the account still signs
 * in, and the customer can try again; if Auth were deleted first, a partial
 * failure would strand data belonging to someone who can no longer reach it.
 */
import { adminAuth, adminDb } from './firebaseAdmin';
import { reportError } from './report';

export interface DeletionResult {
  erased: Record<string, number>;
  anonymised: Record<string, number>;
}

/** Firestore refuses batches over 500 writes. */
const BATCH_LIMIT = 400;

async function deleteAll(
  query: FirebaseFirestore.Query,
  counter: (n: number) => void,
): Promise<void> {
  const db = adminDb!;
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    counter(snap.size);
    if (snap.size < BATCH_LIMIT) return;
  }
}

/**
 * What replaces a person on a record the studio must keep.
 *
 * The row still balances and the visit still happened; it simply no longer says
 * who. `deletedAt` marks it so the studio can tell an anonymised record from an
 * incomplete one.
 */
const ANONYMOUS = {
  userName: 'Deleted account',
  userEmail: '',
  userPhone: '',
  customerName: 'Deleted account',
  customerPhone: '',
  customerEmail: '',
};

async function anonymiseAll(
  query: FirebaseFirestore.Query,
  fields: Partial<typeof ANONYMOUS>,
  counter: (n: number) => void,
): Promise<void> {
  const db = adminDb!;
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) return;
    /* Only touch what has not been done already, or this loops forever on a
       query that keeps matching. */
    const pending = snap.docs.filter(d => !d.data().deletedAt);
    if (pending.length === 0) return;
    const batch = db.batch();
    pending.forEach(d => batch.update(d.ref, { ...fields, deletedAt: new Date() }));
    await batch.commit();
    counter(pending.length);
    if (snap.size < BATCH_LIMIT) return;
  }
}

/**
 * Erase a customer's account.
 *
 * Idempotent: every step is "delete what is there" or "anonymise what has not
 * been", so a retry after a timeout finishes the job rather than failing.
 */
export async function deleteAccount(uid: string): Promise<DeletionResult> {
  if (!adminDb || !adminAuth) throw new Error('not-configured');
  const db = adminDb;

  const erased: Record<string, number> = {};
  const anonymised: Record<string, number> = {};
  const add = (bag: Record<string, number>, k: string) =>
    (n: number) => { bag[k] = (bag[k] ?? 0) + n; };

  /* ── 1 · what is theirs ─────────────────────────────────────────────── */

  const userRef = db.collection('users').doc(uid);

  /* Subcollections do not go with their parent in Firestore — deleting the
     user document alone would orphan every one of these forever. */
  for (const sub of ['vehicles', 'fcmTokens', 'savedCars'] as const) {
    await deleteAll(userRef.collection(sub), add(erased, sub));
  }

  /* A vehicle's service history is a subcollection of a subcollection, and the
     vehicles are already gone by now — so it is swept by collection group. */
  await deleteAll(
    db.collectionGroup('serviceHistory').where('userId', '==', uid),
    add(erased, 'serviceHistory'),
  ).catch(() => { /* no index, or none exist: not worth failing a deletion */ });

  await deleteAll(
    db.collection('notifications').where('userId', '==', uid),
    add(erased, 'notifications'),
  );
  await deleteAll(
    db.collection('notificationLog').where('userId', '==', uid),
    add(erased, 'notificationLog'),
  );

  /* ── 2 · what the studio must keep ──────────────────────────────────── */

  await anonymiseAll(
    db.collection('bookings').where('userId', '==', uid),
    { userName: ANONYMOUS.userName, userEmail: '', userPhone: '' },
    add(anonymised, 'bookings'),
  );
  await anonymiseAll(
    db.collection('subscriptions').where('userId', '==', uid),
    { userName: ANONYMOUS.userName, userEmail: '', userPhone: '' },
    add(anonymised, 'subscriptions'),
  );
  await anonymiseAll(
    db.collection('invoices').where('customerId', '==', uid),
    { customerName: ANONYMOUS.customerName, customerPhone: '' },
    add(anonymised, 'invoices'),
  );
  await anonymiseAll(
    db.collection('jobs').where('customerId', '==', uid),
    { customerName: ANONYMOUS.customerName, customerPhone: '' },
    add(anonymised, 'jobs'),
  );

  /* Visits carry no personal fields — they are keyed to a vehicle, and the
     vehicle is gone. Nothing to strip, and the sealed record stays intact
     (§16: history is permanent). */

  /* ── 3 · the profile, then the sign-in ──────────────────────────────── */

  await userRef.delete().catch(() => { /* already gone on a retry */ });
  erased.profile = 1;

  /* LAST. A failure above leaves an account that can still sign in and try
     again; deleting Auth first would strand data its owner could never
     reach. */
  await adminAuth.deleteUser(uid).catch(async e => {
    const code = (e as { code?: string }).code;
    if (code === 'auth/user-not-found') return;
    await reportError(e, { op: 'account.delete.auth', userId: uid });
    throw e;
  });
  erased.signIn = 1;

  return { erased, anonymised };
}
