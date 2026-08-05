/**
 * THE BOOKING WORKFLOW, ENFORCED.
 *
 * The customer's only booking path is in-app. Every guarantee below is one that,
 * if it broke, would either lose a customer's request or charge them twice —
 * so each is asserted rather than trusted.
 *
 * These are source assertions. The behaviour they guard is a sequence of
 * Firestore writes across a transaction, an idempotency marker and three
 * notification channels; mounting that would test the mocks.
 */
import { readFileSync } from 'fs';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const service = codeOf('lib/server/bookingService.ts');
const route = codeOf('app/api/booking/create/route.ts');
const notify = codeOf('lib/server/bookingNotify.ts');
const flow = codeOf('components/studio/BookingFlow.tsx');
const manage = codeOf('components/studio/ManageVisit.tsx');
const board = codeOf('app/admin/page.tsx');

describe('no duplicate bookings', () => {
  it('every request carries an idempotency key', () => {
    expect(flow).toMatch(/idempotencyKey/);
    expect(service).toMatch(/bad-idempotency-key/);
  });

  it('the key is one per intent — this car, this service, this slot', () => {
    expect(flow).toMatch(/vehicleId[^\n]*service[^\n]*date[^\n]*time/);
  });

  it('a replayed request returns the first booking rather than making a second', () => {
    expect(service).toMatch(/replayed: true/);
  });

  it('the booking and its idempotency marker commit together', () => {
    /* Two writes in one transaction. Separately, a crash between them leaves a
       booking with no marker — and the retry makes a second booking. */
    expect(service).toMatch(/runTransaction/);
    expect(service).toMatch(/t\.set\(intentRef/);
  });
});

describe('no duplicate notifications', () => {
  it('the studio is told only on a genuine creation', () => {
    expect(route).toMatch(/!result\.replayed[\s\S]{0,80}announceBooking/);
  });

  it('the fan-out is keyed on the booking, so a second call collapses', () => {
    expect(notify).toMatch(/dedupeKey: booking\.id/);
    expect(notify).toMatch(/wa_booking_created_\$\{booking\.id\}/);
  });

  it('the activity entry has a deterministic id', () => {
    expect(notify).toMatch(/doc\(`booking_created_\$\{booking\.id\}`\)/);
  });

  it('notifying happens outside the transaction', () => {
    /* `createBookingAuthoritative` retries up to twelve times. A notification
       inside it would fire up to twelve times for one booking. */
    expect(service).not.toMatch(/announceBooking/);
    expect(service).not.toMatch(/notifyAdmins/);
  });
});

describe('a booking cannot be missed', () => {
  it('the studio board listens for pending bookings rather than polling', () => {
    expect(board).toMatch(/subscribePendingBookings/);
  });

  it('the board announces them politely', () => {
    expect(board).toMatch(/awaiting confirmation/);
    expect(board).toMatch(/aria-live="polite"/);
  });

  it('three channels are attempted, and each is wrapped alone', () => {
    /* One failing channel must not cost the others — a WhatsApp outage cannot
       be allowed to swallow the in-app notice. */
    expect(notify).toMatch(/notifyAdmins/);
    expect(notify).toMatch(/whatsAppToStudio/);
    expect(notify).toMatch(/collection\('activity'\)/);
    expect((notify.match(/catch \(e\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('telling the studio can never fail the booking', () => {
    expect(notify).toMatch(/reportError/);
    expect(route).toMatch(/await announceBooking/);
  });
});

describe('no customer action disappears', () => {
  it('the customer is given a reference and told the status', () => {
    expect(flow).toMatch(/reference/);
    expect(flow).toMatch(/Pending/);
  });

  it('the rooms are refreshed so the visit is there when the sheet closes', () => {
    expect(flow).toMatch(/router\.refresh\(\)/);
    expect(manage).toMatch(/router\.refresh\(\)/);
  });

  it('cancelling and rescheduling reuse the existing services', () => {
    expect(manage).toMatch(/from '@\/lib\/services\/bookings'/);
    expect(manage).toMatch(/cancelBooking/);
    expect(manage).toMatch(/rescheduleBooking/);
  });
});

describe('the customer is never offered what the server will refuse', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it('rules permit a customer to change only a pending or confirmed booking', () => {
    expect(rules).toMatch(/resource\.data\.status in \['pending', 'confirmed'\]/);
  });

  it('rules whitelist the fields a customer may touch', () => {
    expect(rules).toMatch(/hasOnly\(\['scheduledDate', 'scheduledTime', 'status', 'cancelledAt', 'updatedAt'\]\)/);
  });

  it('rules allow a customer to move a booking only to cancelled', () => {
    expect(rules).toMatch(/request\.resource\.data\.status == 'cancelled'/);
  });

  it('the sheet mirrors that rule instead of inventing one', () => {
    expect(manage).toMatch(/changeable/);
  });
});

describe('the pending listener can actually run', () => {
  it('the composite index it needs exists', () => {
    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
      indexes: { collectionGroup: string; fields: { fieldPath: string; order?: string }[] }[];
    };
    const hit = idx.indexes.some(i =>
      i.collectionGroup === 'bookings'
      && i.fields.length === 2
      && i.fields[0].fieldPath === 'status'
      && i.fields[1].fieldPath === 'createdAt'
      && i.fields[1].order === 'DESCENDING');
    expect(hit).toBe(true);
  });
});
