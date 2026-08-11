import 'server-only';
/**
 * RECORDING WHAT HAPPENED, ONCE.
 *
 * The server twin of `lib/os/events.ts`. The engine decides what an event IS,
 * what it is called, whether it breaks through quiet mode and what it says.
 * This writes it down and, if it may, delivers it.
 *
 * ── ONE COLLECTION, NOT TWO ──────────────────────────────────────────────
 * `notifications` already exists, is already scoped to its owner by rules, is
 * already read by `noticeOf` to surface an unread fact on the car it belongs
 * to, and is already the payload the service worker opens. Adding a parallel
 * `events` collection would mean two records of one fact, two rules blocks and
 * two readers — and the day they disagree, the customer's car says one thing
 * and their phone says another. The event fields are added to the document
 * that already exists.
 *
 * ── IDEMPOTENT BY CONSTRUCTION ───────────────────────────────────────────
 * The document id IS the event's identity (`lib/os/events.eventId`), so this
 * function may be called any number of times for one fact and will write one
 * document. The transaction exists not to prevent duplicates — the id does
 * that — but to make sure a second call does not reset `read` to false on a
 * notice the customer has already seen.
 *
 * ── NOTHING HERE MAY THROW ───────────────────────────────────────────────
 * A booking that fails because the customer could not be told is worse than a
 * customer told late. Every channel is wrapped independently.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { pushToUser } from './notify';
import { reportError } from './report';
import {
  eventId, wordsFor, deliverable, CATEGORY_OF,
  type StudioEventInput,
} from '@/lib/os/events';
import { eventHref } from '@/navigation/resolve';

export interface RecordedEvent {
  id: string;
  /** false when this exact fact had already been recorded. */
  created: boolean;
  /** false when quiet mode held it, or when there was no device to reach. */
  delivered: boolean;
}

/**
 * Write one event for one customer, and deliver it if quiet mode allows.
 *
 * `discriminator` distinguishes repeatable facts — a booking moved twice is
 * two events, and without it the second would collapse onto the first.
 */
export async function recordEvent(
  input: StudioEventInput,
  opts: { discriminator?: string; href?: string } = {},
): Promise<RecordedEvent> {
  const id = eventId(input, opts.discriminator);
  if (!adminDb || !input.customerId) return { id, created: false, delivered: false };
  const db = adminDb;

  const { title, body } = wordsFor(input);
  /* ADDRESSED ONCE, AT WRITE TIME, BY THE ONE FILE THAT KNOWS ADDRESSES.
     `notificationHref` sent every booking notification to `/history/<id>`,
     which renders a visit — and a confirmed booking has no visit yet, so a
     "the bay is yours" push opened the no-car invitation. */
  const url = opts.href ?? eventHref(input.type, input.source);

  let created = false;
  try {
    created = await db.runTransaction(async t => {
      const ref = db.collection('notifications').doc(id);
      const snap = await t.get(ref);
      /* Already recorded. Return without writing — re-setting the document
         would mark a notice the customer has already read as unread again. */
      if (snap.exists) return false;
      t.set(ref, {
        userId: input.customerId,
        title,
        body,
        type: CATEGORY_OF[input.type],
        /* The precise fact, alongside the coarse category every existing
           reader understands. */
        event: input.type,
        sourceKind: input.source.kind,
        sourceId: input.source.id,
        ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
        ...(input.source.kind === 'booking' ? { bookingId: input.source.id } : {}),
        read: false,
        url,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    }, { maxAttempts: 4 });
  } catch (e) {
    await reportError(e, { op: 'event.record', userId: input.customerId, extra: { id } });
    return { id, created: false, delivered: false };
  }

  if (!created) return { id, created: false, delivered: false };

  /* ── DELIVERY ──
     Quiet mode is read HERE rather than passed in, so no caller can forget to
     honour it. A profile that cannot be read is treated as not-quiet: failing
     open on delivery tells a customer something they may not want to hear,
     which is a far smaller harm than a car sitting unreleased because the
     "ready" notice was silently dropped. */
  let quiet = false;
  try {
    const profile = await db.collection('users').doc(input.customerId).get();
    quiet = profile.data()?.quietMode === true;
  } catch {
    quiet = false;
  }

  if (!deliverable(input.type, quiet)) {
    /* Held, and SAID to have been held. The record stands; only the phone stays
       dark, and the customer's own history is untouched. */
    try {
      await db.collection('notifications').doc(id).update({ heldByQuietMode: true });
    } catch { /* the record is what matters; the annotation is not */ }
    return { id, created: true, delivered: false };
  }

  let delivered = false;
  try {
    delivered = (await pushToUser(input.customerId, title, body, url)) > 0;
  } catch {
    delivered = false;
  }
  return { id, created: true, delivered };
}
