/**
 * TEMPORARY ADAPTER (PRE-1) — protection derivation for Generation-A
 * surfaces. Expiry truth now comes from the ONE Term Engine (lib/os/term);
 * this file only maps completed work × catalog warranties into facts.
 *
 * TODO(P5): Terms replaces this with Protection objects on the Term Engine;
 * delete this file with the passport derivations.
 */
import type { Booking, Service } from '@/lib/types';
import { termState, termAlive, type TermState } from '@/lib/os/term';

/** "5 Year" / "6 Month" → months; null when no warranty */
const warrantyMonths = (w: string | null | undefined): number | null => {
  if (!w) return null;
  const n = parseInt(w, 10);
  if (!n) return null;
  return /month/i.test(w) ? n : n * 12;
};

const addMonths = (iso: string, months: number): Date => {
  const d = new Date(iso + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d;
};

export type ProtectionKind = 'PPF' | 'Ceramic' | 'Coating';

export const PROTECTION_LABEL: Record<ProtectionKind, string> = {
  PPF: 'Paint Protection Film',
  Ceramic: 'Ceramic Coating',
  Coating: 'Glass & Teflon',
};

export type Protection = {
  kind: ProtectionKind;
  applied: string;
  until: Date | null;
  active: boolean;
  /** Term Engine state — the one lifecycle (active/waning/expiring/lapsed) */
  term: TermState;
  service: string;
  /** raw warranty string from the catalog, when known */
  warranty: string | null;
};

/** Active protection layers on a vehicle, derived from its completed work.
 *  `history` must be sorted newest-first. */
export const deriveProtection = (history: Booking[], services: Service[]): Protection[] => {
  const byName = new Map(services.map(s => [s.name, s]));
  const out: Protection[] = [];
  (['PPF', 'Ceramic', 'Coating'] as const).forEach(kind => {
    const last = history.find(b => b.status === 'completed' && b.serviceCategory === kind);
    if (!last) return;
    const warranty = byName.get(last.serviceName)?.warranty ?? null;
    const months = warrantyMonths(warranty);
    const until = months ? addMonths(last.scheduledDate, months) : null;
    const term: TermState = until
      ? termState(until.toISOString().split('T')[0])
      : 'active';
    out.push({
      kind, applied: last.scheduledDate, until,
      active: termAlive(term),
      term,
      service: last.serviceName,
      warranty,
    });
  });
  return out;
};
