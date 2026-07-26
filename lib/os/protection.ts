/**
 * THE PROTECTION ENGINE (Constitution Art. 3 · docs/AUTOMODZ-LIVING-STATES.md).
 *
 * Protection is a STORED object whose terms are captured at the moment they
 * are sold. This module owns the one place a catalogue warranty becomes a
 * Term - and it is called exactly twice in the product's life:
 *
 *   1. when a Visit seals   → the term as sold          (`source: 'captured'`)
 *   2. during the migration → the term as best known    (`source: 'reconstructed'`)
 *
 * It is NEVER called on a read. That is the whole point: the predecessor
 * (`lib/cx/protection.ts`) resolved warranties from the live `services`
 * catalogue on every render, so editing a warranty string in admin silently
 * rewrote what past customers had been promised.
 *
 * Pure - no Firebase, no React. The services layer stores what this returns.
 */
import type {
  CapturedTerm, Protection, ProtectionKind, Service, TermsSource, Visit,
} from '@/lib/types';
import { PROTECTION_CLASS } from '@/lib/types';
import { healthOf, termDaysLeft, HEALTH_RANK, type Health, type Term } from './term';

/** Catalogue category → the kind it protects with. Unlisted = sells no promise. */
export const CATEGORY_TO_KIND: Record<string, ProtectionKind> = {
  PPF: 'ppf',
  Ceramic: 'ceramic',
  Coating: 'glass',
};

/** Months in a catalogue warranty string ("5 Year", "6 Month"). */
const warrantyMonths = (w: string): number | null => {
  const n = parseInt(w, 10);
  if (!n) return null;
  return /month/i.test(w) ? n : n * 12;
};

const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

/**
 * A catalogue warranty string → a Term, as at the date the work was done.
 *
 * Returns null when the catalogue promises nothing. That is deliberate and it
 * is a behaviour change: the predecessor turned a missing warranty into an
 * endlessly "active" protection, which renders as *Protected* forever - a
 * promise nobody made. Art. 1.6: nothing is faked. Work with no warranty is
 * still recorded on the Visit; it simply creates no Protection.
 */
export function termFromWarranty(warranty: string | null | undefined, appliedOn: string): Term | null {
  if (!warranty) return null;
  if (/lifetime/i.test(warranty)) return { kind: 'perpetual' };
  const months = warrantyMonths(warranty);
  if (!months) return null;
  return { kind: 'dated', expiresOn: addMonths(appliedOn, months) };
}

/**
 * The terms a visit's work promises, frozen at the moment of capture.
 * `services` is read HERE and only here - the resulting terms are then stored
 * and the catalogue is never consulted about this car again.
 */
export function captureTerms(args: {
  /** what was actually done, with the date it was done */
  work: { serviceName: string; category: string; appliedOn: string }[];
  /** the catalogue, as it stands at the moment of capture */
  catalogue: Service[];
  source: TermsSource;
}): CapturedTerm[] {
  const byName = new Map(args.catalogue.map(s => [s.name, s]));
  const out: CapturedTerm[] = [];

  for (const w of args.work) {
    const kind = CATEGORY_TO_KIND[w.category];
    if (!kind) continue;                       // this category sells no promise
    const service = byName.get(w.serviceName);
    const term = termFromWarranty(service?.warranty, w.appliedOn);
    if (!term) continue;                       // no warranty, no promise
    out.push({
      kind,
      provider: service?.brand ?? undefined,
      plan: service?.warranty ?? undefined,
      coverage: w.serviceName,
      term,
      source: args.source,
    });
  }

  // one promise per kind - the newest wins, exactly as re-coating replaces
  const newest = new Map<ProtectionKind, CapturedTerm>();
  for (const t of out) newest.set(t.kind, t);
  return [...newest.values()];
}

/**
 * The Protections a sealed Visit creates. Reads `visit.termsCaptured` and
 * nothing else - by this point the catalogue is irrelevant, which is the
 * property the whole anchor exists to provide.
 */
export function protectionsFromVisit(
  visit: Pick<Visit, 'id' | 'vehicleId' | 'locationId' | 'termsCaptured' | 'requestedFor'>,
  appliedOn: string,
): Omit<Protection, 'id' | 'createdAt' | 'updatedAt'>[] {
  return visit.termsCaptured.map(t => ({
    vehicleId: visit.vehicleId,
    locationId: visit.locationId,
    kind: t.kind,
    provider: t.provider,
    plan: t.plan,
    coverage: t.coverage,
    since: appliedOn,
    term: t.term,
    visitId: visit.id,
    termsSource: t.source,
  }));
}

/* ── reading ────────────────────────────────────────────────────────────── */

/** A protection with its derived health - the shape every surface renders. */
export interface LiveProtection extends Protection {
  health: Health;
  /** null for perpetual and balance terms - asking either for days is how
   *  "98% protected" gets printed on a lifetime warranty */
  daysLeft: number | null;
}

export const liveProtection = (p: Protection, now?: Date): LiveProtection => ({
  ...p,
  health: healthOf(p.term, now),
  daysLeft: termDaysLeft(p.term, now),
});

/**
 * Reading order: whatever most needs attention leads, then the soonest to
 * end. A healthy state never outranks one asking for something.
 */
export function sortByUrgency(list: LiveProtection[]): LiveProtection[] {
  return [...list].sort((a, b) => {
    const h = HEALTH_RANK[b.health] - HEALTH_RANK[a.health];
    if (h !== 0) return h;
    if (a.daysLeft != null && b.daysLeft != null) return a.daysLeft - b.daysLeft;
    if (a.daysLeft != null) return -1;
    if (b.daysLeft != null) return 1;
    return 0;
  });
}

/** Physical protection comes from our own work; the rest is the owner's world. */
export const isStudioApplied = (kind: ProtectionKind): boolean =>
  PROTECTION_CLASS[kind] === 'physical';

/**
 * THE MIGRATION-WINDOW READ PATH (VISIT-OBJECT.md §6, Phase 1).
 *
 * Until every car's protections have been written to the `protections`
 * collection, a surface needs something true to render. This projects them
 * from the completed work a car already has, using EXACTLY the capture
 * function the migration will persist - same inputs, same output, flagged
 * `reconstructed`.
 *
 * This is not the old bug wearing a new coat. The predecessor recomputed
 * silently and permanently, so a catalogue edit rewrote history with nothing
 * recording that it had. This is explicitly a transitional projection: it is
 * marked, it is identical to what will be stored, and it disappears the
 * moment stored rows exist. Callers must prefer stored protections and fall
 * back to this - never merge the two.
 */
export function projectProtections(args: {
  vehicleId: string;
  /** this vehicle's completed work, newest first */
  completed: { serviceName: string; serviceCategory: string; scheduledDate: string; id: string }[];
  catalogue: Service[];
  now?: Date;
}): LiveProtection[] {
  // oldest first so a re-coat replaces its ancestor (captureTerms keeps the last)
  const ordered = [...args.completed].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const bySource = new Map<ProtectionKind, string>();

  const captured = captureTerms({
    work: ordered.map(b => {
      const kind = CATEGORY_TO_KIND[b.serviceCategory];
      if (kind) bySource.set(kind, b.id);
      return { serviceName: b.serviceName, category: b.serviceCategory, appliedOn: b.scheduledDate };
    }),
    catalogue: args.catalogue,
    source: 'reconstructed',
  });

  const appliedOn = new Map<ProtectionKind, string>();
  for (const b of ordered) {
    const kind = CATEGORY_TO_KIND[b.serviceCategory];
    if (kind) appliedOn.set(kind, b.scheduledDate);
  }

  return sortByUrgency(captured.map(t => liveProtection({
    id: `${args.vehicleId}_${t.kind}`,
    vehicleId: args.vehicleId,
    kind: t.kind,
    provider: t.provider,
    plan: t.plan,
    coverage: t.coverage,
    since: appliedOn.get(t.kind),
    term: t.term,
    visitId: bySource.get(t.kind),
    termsSource: t.source,
  } as Protection, args.now)));
}
