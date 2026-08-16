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
/**
 * SERVICE IDENTITY IS NOT A DISPLAY NAME.
 *
 * This resolution used to be `new Map(catalogue.map(s => [s.name, s]))` and a
 * plain `.get(serviceName)` - an exact, case-sensitive match on a string a
 * human types into an admin form. In production that silently cost a real
 * customer a real warranty: a job recorded `"Glass Coating"`, the catalogue
 * holds `"Glass coating"`, and one capital letter meant no match, no warranty,
 * no protection. The car has a two-year glass coating and the product believed
 * it had nothing.
 *
 * The lesson is not the capital letter. It is that a display name is not an
 * identifier: it is edited for presentation, translated, corrected for typos,
 * and none of those should touch what a customer was promised.
 *
 * So, in order:
 *
 *   1. `serviceId` - a real key, when it resolves. New work always carries one.
 *   2. NORMALISED NAME - lowercased, whitespace collapsed. This is the legacy
 *      path, and it exists because historical jobs carry ids from a catalogue
 *      that has since been replaced (`s7`, `s14` against today's `svc-*`), so
 *      their id resolves to nothing and the name is the only key left.
 *   3. Nothing. An unresolved service creates NO protection.
 *
 * Normalisation is deliberately narrow - case and whitespace only. There is no
 * fuzzy matching, no prefix matching, no edit distance: "Ceramic coating" and
 * "Ceramic maintenance" are different promises with different terms, and a
 * matcher loose enough to bridge a typo is loose enough to bridge those two.
 * Art. 1.6 - a wrong promise is worse than no promise.
 */
const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function resolveService(
  catalogue: Service[],
  ref: { serviceId?: string; serviceName: string },
): Service | undefined {
  if (ref.serviceId) {
    const byId = catalogue.find(s => s.id === ref.serviceId);
    if (byId) return byId;
  }
  const wanted = normalise(ref.serviceName);
  return catalogue.find(s => normalise(s.name) === wanted);
}

export function captureTerms(args: {
  /** what was actually done, with the date it was done */
  work: { serviceName: string; serviceId?: string; category: string; appliedOn: string }[];
  /** the catalogue, as it stands at the moment of capture */
  catalogue: Service[];
  source: TermsSource;
}): CapturedTerm[] {
  const out: CapturedTerm[] = [];

  for (const w of args.work) {
    const kind = CATEGORY_TO_KIND[w.category];
    if (!kind) continue;                       // this category sells no promise
    const service = resolveService(args.catalogue, w);
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
 * marked, it is identical to what will be stored, and it disappears the moment
 * a stored row exists FOR THAT KIND.
 *
 * ── AND THE FALLBACK IS PER KIND, NOT PER CAR ────────────────────────────
 * This paragraph used to end "Callers must prefer stored protections and fall
 * back to this - never merge the two", and `computeProtections` read it as
 * all-or-nothing: one stored row of any kind switched the whole projection
 * off. Verifying a pollution certificate writes exactly one Protection, so a
 * customer who sent in their certificate watched their ceramic coating
 * disappear from their car. See `lib/customer/project#computeProtections`.
 *
 * The rule it was protecting is intact and worth restating precisely: never
 * take one FIELD from a stored protection and another from a reconstructed
 * one. A promise must come from a single source, whole. Which source that is
 * is decided per kind, because a kind is the granularity a promise has.
 */
export function projectProtections(args: {
  vehicleId: string;
  /** this vehicle's completed work, newest first */
  completed: {
    serviceName: string;
    /** The booking's own service key, so resolution matches the seal's. */
    serviceId?: string;
    serviceCategory: string;
    scheduledDate: string;
    id: string;
  }[];
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
      /* The booking's own service id, so the reconstructed read path resolves
         by key exactly as the seal does, and falls back to the normalised name
         only when the id belongs to a retired catalogue. */
      return {
        serviceName: b.serviceName,
        serviceId: b.serviceId,
        category: b.serviceCategory,
        appliedOn: b.scheduledDate,
      };
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

/* ── ONE PROMISE PER KIND, ENFORCED ─────────────────────────────────────── */

/**
 * A vehicle exposes AT MOST ONE active protection of a given kind.
 *
 * This was previously guaranteed only by an id convention -
 * `${vehicleId}_${kind}` - which is a naming habit, not an invariant. Any
 * writer that chose its own id broke it, and one did: production carries both
 * `MfU7e5qLzdLvkvvi8E3o_glass` (sealed, expires 2028-07-16) and the seeded
 * `prot-seltos-glass` (expires 2027-09-21). The customer's Home listed "Glass
 * coating" twice, ten months apart. A car cannot have two answers to "how long
 * is my coating good for".
 *
 * So the rule moves into the engine, where no writer can route around it.
 *
 * ── WHY THIS ORDER ──────────────────────────────────────────────────────
 * 1. `captured` - the term as SOLD, snapshotted at seal from the catalogue of
 *    that moment. It is the only source with a provenance chain back to work
 *    that actually happened.
 * 2. LINKED TO A SEALED VISIT - a protection that can name the visit that
 *    created it outranks one that cannot, because the visit is the evidence.
 * 3. HAS A `since` - a protection whose life can be measured outranks one that
 *    can only be estimated.
 * 4. NEWEST `since` - a re-coat replaces its ancestor, which is the same rule
 *    `captureTerms` already applies within a single visit.
 *
 * NOTHING IS MERGED. The winner is returned whole. Taking `since` from one
 * document and `term` from another would manufacture a promise that no visit
 * ever made - the precise failure this file exists to prevent.
 *
 * Deterministic by construction: every tie-break is a total order on values,
 * and the final fallback is the document id, so Firestore's arrival order
 * cannot change the answer.
 */
const rank = (p: Protection): [number, number, number, string] => [
  p.termsSource === 'captured' ? 1 : 0,
  p.visitId ? 1 : 0,
  p.since ? 1 : 0,
  p.since ?? '',
];

export function oneProtectionPerKind<T extends Protection>(list: T[]): T[] {
  const best = new Map<ProtectionKind, T>();
  for (const p of list) {
    const held = best.get(p.kind);
    if (!held) { best.set(p.kind, p); continue; }
    const [a, b] = [rank(p), rank(held)];
    for (let i = 0; i < 4; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] > b[i]) best.set(p.kind, p);
      break;
    }
    /* Every field equal - including `since`. Fall back to the id so the answer
       is still the same on every read. */
    if (a.every((x, i) => x === b[i]) && p.id < held.id) best.set(p.kind, p);
  }
  return [...best.values()];
}

/**
 * IS THIS PERCENTAGE A MEASUREMENT OR A GUESS?
 *
 * A protection with a `since` and a dated term has a real proportion between
 * two real dates. One without `since` falls back to a health bucket - 0.8,
 * 0.2, 0.05 - which is a CATEGORY wearing a number. Eight legacy protections
 * are in that state and no date may be invented for them.
 *
 * The distinction is exposed rather than hidden, so no surface can imply that
 * a bucketed 0.8 was measured. What each surface does with it is a design
 * decision; this only makes the difference knowable.
 */
export type Measurement = 'measured' | 'estimated';

export const measurementOf = (p: Pick<Protection, 'since' | 'term'>): Measurement =>
  p.since && p.term.kind === 'dated' ? 'measured' : 'estimated';

/**
 * HOW MUCH OF A PROMISE IS LEFT, AS A MEASUREMENT - or nothing at all.
 *
 * Returns `null` unless the fraction can be taken between two real dates. That
 * is stricter than the customer-facing dial, and deliberately so: the dial may
 * fall back to a health BUCKET when `since` was never recorded, because the
 * customer can see the word beside it and the studio can be asked. A public
 * listing has neither. "68% life" on a page a stranger reads is a claim about
 * somebody's car, and a bucket wearing a number is not a claim anyone can
 * stand behind.
 *
 * A perpetual promise has no fraction to take - it does not deplete - so it is
 * `null` here too, and the surface says what it is rather than how much is
 * left.
 */
export function measuredLifeOf(
  p: Pick<Protection, 'since' | 'term'>, now = new Date(),
): number | null {
  if (measurementOf(p) !== 'measured') return null;
  if (p.term.kind !== 'dated') return null;

  const end = new Date(`${p.term.expiresOn}T12:00:00`).getTime();
  const start = new Date(`${p.since}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  return Math.max(0, Math.min(1, (end - now.getTime()) / (end - start)));
}
