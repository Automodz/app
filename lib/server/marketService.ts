import 'server-only';
/**
 * THE ONE WAY A LEAD OR AN OFFER COMES INTO EXISTENCE.
 *
 * Source: docs/AUTOMODZ-OS.md §17 · the Booking Service, whose shape this
 * follows deliberately.
 *
 * TWO DEFECTS THIS EXISTS TO CLOSE, both of which shipped:
 *
 *   NOBODY WAS TOLD. `createCarLead` wrote a document and stopped. A customer
 *   asking to buy a car - the highest-value message the product can carry -
 *   landed in a collection the studio had to remember to open. This is exactly
 *   the defect that made new bookings invisible, and it has the same fix.
 *
 *   ANYONE COULD WRITE ANYTHING. `carLeads` allowed unauthenticated create so
 *   the public form could work. That is a spam endpoint with the studio's
 *   notification channel wired to it. Writes now happen here, with the Admin
 *   SDK, and the rules refuse the client outright.
 *
 * Everything the studio is told is derived server-side from the LISTING, never
 * taken from the caller: a lead cannot claim to be about a car it is not, and
 * cannot name a price of its own.
 */
import { adminDb } from './firebaseAdmin';
import { reportError } from './report';
import { notifyAdmins, whatsAppToStudio } from './notify';
import { loadListing } from './marketplace';
import type { CarPhoto } from '@/lib/types';

export class MarketError extends Error {
  constructor(public code: string) { super(code); }
}

/** Trim, cap, and treat an empty string as absent. */
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t === '' ? undefined : t;
};

/** Indian mobile numbers are ten digits; anything shorter cannot be called back. */
const phoneOf = (v: unknown): string | undefined => {
  const t = text(v, 20);
  if (!t) return undefined;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? t : undefined;
};

/**
 * Photos are accepted only as URLs already written by the signed-upload route,
 * which binds every path to the uploader's own uid. A caller cannot name an
 * arbitrary path here.
 */
const photosOf = (v: unknown, uid: string): CarPhoto[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is CarPhoto =>
      Boolean(p) && typeof p === 'object'
      && typeof (p as CarPhoto).url === 'string'
      && typeof (p as CarPhoto).path === 'string'
      && (p as CarPhoto).path.startsWith(`sellRequests/${uid}/`))
    .slice(0, 8);
};

export interface LeadIntent {
  listingId: string;
  type: 'inquiry' | 'viewing';
  name: string;
  phone: string;
  message?: string;
  preferredDate?: string;
  preferredTime?: string;
  /** Present only when the caller proved who they are. Never taken from a body. */
  userId?: string;
}

/**
 * Record a customer's interest in a car, and make sure the studio knows.
 *
 * Returns the lead id. Throws `MarketError` with a code the route maps to a
 * status - no HTTP vocabulary in here.
 */
export async function createLeadAuthoritative(intent: LeadIntent): Promise<string> {
  if (!adminDb) throw new MarketError('not-configured');

  const name = text(intent.name, 100);
  const phone = phoneOf(intent.phone);
  if (!name) throw new MarketError('name-required');
  if (!phone) throw new MarketError('phone-required');
  if (intent.type !== 'inquiry' && intent.type !== 'viewing') {
    throw new MarketError('bad-type');
  }

  /* The listing is READ, not trusted. A lead about a withdrawn or non-existent
     car is refused rather than filed against a title the caller invented. */
  const listing = await loadListing(intent.listingId);
  if (!listing) throw new MarketError('listing-unavailable');
  if (listing.status !== 'available') throw new MarketError('listing-unavailable');

  const now = new Date();
  const ref = await adminDb.collection('carLeads').add({
    listingId: listing.id,
    listingTitle: listing.title,      // from the listing, never from the body
    type: intent.type,
    ...(intent.userId ? { userId: intent.userId } : {}),
    name,
    phone,
    ...(text(intent.message, 1000) ? { message: text(intent.message, 1000) } : {}),
    ...(intent.type === 'viewing' && text(intent.preferredDate, 20)
      ? { preferredDate: text(intent.preferredDate, 20) } : {}),
    ...(intent.type === 'viewing' && text(intent.preferredTime, 20)
      ? { preferredTime: text(intent.preferredTime, 20) } : {}),
    status: 'new',
    createdAt: now,
    updatedAt: now,
  });

  await announceLead({
    id: ref.id, title: listing.title, type: intent.type, name, phone,
    when: intent.type === 'viewing' ? text(intent.preferredDate, 20) : undefined,
  });

  return ref.id;
}

export interface SellIntent {
  userId: string;
  name: string;
  phone: string;
  make: string;
  model: string;
  year: number;
  kmDriven: number;
  expectedPrice?: number;
  description?: string;
  photos?: unknown;
}

/** File a customer's offer to sell their car, and tell the studio. */
export async function createSellRequestAuthoritative(intent: SellIntent): Promise<string> {
  if (!adminDb) throw new MarketError('not-configured');

  const name = text(intent.name, 100);
  const phone = phoneOf(intent.phone);
  const make = text(intent.make, 60);
  const model = text(intent.model, 60);
  if (!name) throw new MarketError('name-required');
  if (!phone) throw new MarketError('phone-required');
  if (!make || !model) throw new MarketError('car-required');

  const year = Number(intent.year);
  const thisYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1950 || year > thisYear + 1) {
    throw new MarketError('year-invalid');
  }
  const km = Number(intent.kmDriven);
  if (!Number.isFinite(km) || km < 0 || km > 1_000_000) throw new MarketError('km-invalid');

  const price = Number(intent.expectedPrice);
  const expectedPrice = Number.isFinite(price) && price > 0 ? Math.round(price) : undefined;

  const now = new Date();
  const ref = await adminDb.collection('sellRequests').add({
    userId: intent.userId,
    name, phone, make, model,
    year: Math.round(year),
    kmDriven: Math.round(km),
    ...(expectedPrice ? { expectedPrice } : {}),
    ...(text(intent.description, 1000) ? { description: text(intent.description, 1000) } : {}),
    photos: photosOf(intent.photos, intent.userId),
    status: 'new',
    createdAt: now,
    updatedAt: now,
  });

  await announceSellRequest({
    id: ref.id, car: `${Math.round(year)} ${make} ${model}`, name, phone, expectedPrice,
  });

  return ref.id;
}

/* ── telling the studio ──────────────────────────────────────────────────── */

const ADMIN_LEADS_URL = '/admin/cars/leads';

/**
 * Both channels, each guarded by its own marker.
 *
 * A WhatsApp outage must not make the in-app notice look sent, and the marker
 * records the ATTEMPT rather than the success - writing it only on success
 * would retry forever against a misconfigured number.
 */
async function announceLead(
  lead: { id: string; title: string; type: string; name: string; phone: string; when?: string },
): Promise<void> {
  if (!adminDb) return;
  const act = lead.type === 'viewing' ? 'wants to see' : 'is asking about';
  const title = lead.type === 'viewing' ? 'Viewing request' : 'Car enquiry';
  const body = `${lead.name} ${act} the ${lead.title}`;

  try {
    await notifyAdmins('car_lead', title, body, {
      url: ADMIN_LEADS_URL, dedupeKey: lead.id,
    });
  } catch (e) {
    await reportError(e, { op: 'market.notify.admins', extra: { leadId: lead.id } });
  }

  const markerRef = adminDb.collection('notificationLog').doc(`wa_car_lead_${lead.id}`);
  try {
    if (!(await markerRef.get()).exists) {
      const sent = await whatsAppToStudio(
        `${title} - ${lead.title}\n`
        + `${lead.name} · ${lead.phone}\n`
        + (lead.when ? `Wants to come: ${lead.when}` : 'Asking for details'),
      );
      await markerRef.set({ at: new Date(), sent, kind: 'car_lead' });
    }
  } catch (e) {
    await reportError(e, { op: 'market.notify.whatsapp', extra: { leadId: lead.id } });
  }
}

async function announceSellRequest(
  offer: { id: string; car: string; name: string; phone: string; expectedPrice?: number },
): Promise<void> {
  if (!adminDb) return;
  const body = `${offer.name} is offering a ${offer.car}`;

  try {
    await notifyAdmins('sell_request', 'Car offered', body, {
      url: ADMIN_LEADS_URL, dedupeKey: offer.id,
    });
  } catch (e) {
    await reportError(e, { op: 'market.notify.admins', extra: { sellId: offer.id } });
  }

  const markerRef = adminDb.collection('notificationLog').doc(`wa_sell_request_${offer.id}`);
  try {
    if (!(await markerRef.get()).exists) {
      const sent = await whatsAppToStudio(
        `Car offered - ${offer.car}\n`
        + `${offer.name} · ${offer.phone}\n`
        + (offer.expectedPrice ? `Wants about ₹${offer.expectedPrice}` : 'No price named'),
      );
      await markerRef.set({ at: new Date(), sent, kind: 'sell_request' });
    }
  } catch (e) {
    await reportError(e, { op: 'market.notify.whatsapp', extra: { sellId: offer.id } });
  }
}
