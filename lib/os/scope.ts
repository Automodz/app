/**
 * HOW MUCH OF THE CAR — design screen 07, "Scope & quote".
 *
 * Source: docs/DESIGN-PARITY-AUDIT.md screen 07, §PHASE 3 (`services` EXTEND)
 *
 * ── WHY A SCOPE IS NOT A SERVICE ─────────────────────────────────────────
 * "Front end PPF" and "Full-body PPF" are one piece of work at two sizes: the
 * same film, the same warranty, the same bay, the same brand standing behind
 * it. Two catalogue entries would duplicate every one of those, and the day
 * somebody edits one the studio is selling two different warranties under one
 * name. A scope is a PRICED VARIANT, and it lives on the service.
 *
 * ── THE CATALOGUE IS AUTHORITATIVE FOR THE NEXT QUOTE, NEVER THE LAST ────
 * This engine READS the catalogue and produces a `BookedScope` — a snapshot
 * carrying the label, the panels and the prices as they stood at that moment.
 * The snapshot is what an estimate and then a booking carry, so raising the
 * price of full-body PPF changes what the next customer is quoted and cannot
 * touch what the last one agreed to. That is the same rule `CapturedTerm`
 * exists for, applied to money instead of to a warranty.
 *
 * ── NOTHING HERE IS A STRING FROM A CLIENT ───────────────────────────────
 * A scope id, a panel id and an add-on id are looked up in the service
 * document and REFUSED when they are not there. Every price comes from the
 * object that was found; none is ever read off the request. A caller cannot
 * express a price, and cannot express a panel the studio does not fit.
 *
 * Pure, like every engine here: no React, no Firestore, no addresses.
 */
import type { BookedScope, Service, ServiceAddOn, ServiceScope } from '@/lib/types';
import { spanDays, DAY_OPEN_MIN } from '@/lib/availability';

/** What a customer chose. Ids only — never a label, never a figure. */
export interface ScopeChoice {
  /** Absent, or `WHOLE`, means the service as the catalogue sells it. */
  scopeId?: string;
  /** Only meaningful for a `custom` scope. */
  panelIds?: string[];
  addOnIds?: string[];
}

/**
 * The id for "the whole service, as listed".
 *
 * Every service must be bookable, including the seven in production that carry
 * no scopes at all. Without this the extension would have made the entire
 * existing catalogue unbookable the moment the new screen shipped.
 */
export const WHOLE_SCOPE = 'whole';

export type ScopeFailure =
  | 'unknown-service'
  | 'service-not-offered'
  | 'service-not-priced'
  | 'unknown-scope'
  | 'custom-needs-panels'
  | 'unknown-panel'
  | 'unknown-add-on'
  | 'scope-not-priced';

export interface PricedLine {
  name: string;
  price: number;
}

export type ScopeResolution =
  | {
      ok: true;
      scope: BookedScope;
      /** What `priceVisit` is handed as the WORK. One line per thing chosen. */
      lines: PricedLine[];
      /** Which catalogue scope was matched, for wording the screen. */
      chosen: ServiceScope;
    }
  | { ok: false; reason: ScopeFailure };

const fail = (reason: ScopeFailure): ScopeResolution => ({ ok: false, reason });

/**
 * The coverages a service actually offers, always including the whole.
 *
 * A service with no `scopes` array offers exactly one: itself. The screen
 * therefore has something to draw for every service in the catalogue, rather
 * than an empty chooser for the seven that predate the field.
 */
export function scopesOf(service: Service): ServiceScope[] {
  const declared = (service.scopes ?? []).filter(s => s && s.id && s.id !== WHOLE_SCOPE);
  if (declared.length === 0) {
    return [{
      id: WHOLE_SCOPE,
      kind: 'full',
      label: service.name,
      detail: service.description || 'The service as the studio sells it.',
      price: service.price,
      durationMinutes: service.duration,
    }];
  }
  return [...declared].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function addOnsOf(service: Service): ServiceAddOn[] {
  return [...(service.addOns ?? [])]
    .filter(a => a && a.id && Number.isFinite(a.price) && a.price >= 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * WHAT A CHOICE COSTS AND HOW LONG IT TAKES — resolved once, from the
 * catalogue, into a snapshot.
 *
 * It does NOT apply the membership, the promo, the fees or the tax: those are
 * `priceVisit`'s, and there is exactly one of it. This produces the WORK, and
 * hands it over as lines.
 */
export function resolveScope(
  service: Service | null | undefined,
  choice: ScopeChoice,
): ScopeResolution {
  if (!service) return fail('unknown-service');
  if (service.active === false) return fail('service-not-offered');
  if (typeof service.price !== 'number' || service.price <= 0) return fail('service-not-priced');

  const available = scopesOf(service);
  const wanted = choice.scopeId?.trim() || WHOLE_SCOPE;
  const chosen = available.find(s => s.id === wanted);
  if (!chosen) return fail('unknown-scope');

  /* ── the coverage ── */
  const lines: PricedLine[] = [];
  let workPrice = 0;
  let minutes = 0;
  let panels: BookedScope['panels'];

  if (chosen.kind === 'custom') {
    /* "On quote" IS A REAL STATE. A custom coverage has no table price, and a
       zero would claim the studio does the work for nothing. It is priced by
       the panels the customer picked; picking none is not a free full body,
       it is an unanswered question. */
    const catalogue = chosen.panels ?? [];
    const ids = [...new Set(choice.panelIds ?? [])];
    if (ids.length === 0) return fail('custom-needs-panels');

    panels = [];
    for (const id of ids) {
      const panel = catalogue.find(p => p.id === id);
      if (!panel) return fail('unknown-panel');
      panels.push({ id: panel.id, label: panel.label, price: panel.price });
      lines.push({ name: `${chosen.label} · ${panel.label}`, price: panel.price });
      workPrice += panel.price;
      minutes += panel.durationMinutes ?? 0;
    }
  } else {
    if (typeof chosen.price !== 'number' || chosen.price <= 0) return fail('scope-not-priced');
    workPrice = chosen.price;
    minutes = chosen.durationMinutes ?? service.duration;
    lines.push({
      name: chosen.id === WHOLE_SCOPE ? service.name : `${service.name} · ${chosen.label}`,
      price: chosen.price,
    });
  }

  /* ── the extra stages ── */
  const catalogueAddOns = addOnsOf(service);
  const addOns: BookedScope['addOns'] = [];
  for (const id of [...new Set(choice.addOnIds ?? [])]) {
    const found = catalogueAddOns.find(a => a.id === id);
    if (!found) return fail('unknown-add-on');
    addOns.push({
      id: found.id, label: found.label,
      price: found.price, durationMinutes: found.durationMinutes ?? 0,
    });
    lines.push({ name: found.label, price: found.price });
    workPrice += found.price;
    minutes += found.durationMinutes ?? 0;
  }

  /* A duration of zero would tell the availability engine the bay is free the
     instant the car arrives. The service's own duration is the floor. */
  const durationMinutes = Math.max(minutes, service.duration ?? 60);

  return {
    ok: true,
    chosen,
    lines,
    scope: {
      scopeId: chosen.id,
      scopeKind: chosen.kind,
      label: chosen.label,
      ...(panels ? { panels } : {}),
      addOns,
      workPrice,
      durationMinutes,
      /* Screen 07's "2 days in the bay" — the SAME expansion the availability
         engine reserves with, so what the customer is told and what the bay is
         actually held for cannot drift. */
      bayDays: spanDays(DAY_OPEN_MIN, durationMinutes),
    },
  };
}

/**
 * How long an estimate stands.
 *
 * A price quoted against a catalogue does not hold for ever — but it must hold
 * long enough that a customer who thinks about it overnight is not silently
 * repriced. Seven days, stated on the screen, and enforced when the estimate is
 * spent rather than only when it is read.
 */
export const ESTIMATE_VALID_DAYS = 7;

export function estimateExpiryOn(from: string): string {
  const [y, m, d] = from.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + ESTIMATE_VALID_DAYS));
  return at.toISOString().slice(0, 10);
}

export const estimateHasExpired = (expiresOn: string, today: string): boolean =>
  today > expiresOn;
