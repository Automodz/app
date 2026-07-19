/**
 * Protection derivation — a vehicle's shield status, computed from its own
 * completed bookings × the service catalog's warranties. Shared by the
 * Garage passport and the booking flow's vehicle cards. Nothing invented,
 * nothing stored twice.
 */
import type { Booking, Service } from '@/lib/types';

/** "5 Year" / "6 Month" → months; null when no warranty */
export const warrantyMonths = (w: string | null | undefined): number | null => {
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

export type Protection = {
  kind: 'PPF' | 'Ceramic';
  applied: string;
  until: Date | null;
  active: boolean;
  service: string;
};

/** Active protection layers on a vehicle, derived from its completed work.
 *  `history` must be sorted newest-first. */
export const deriveProtection = (history: Booking[], services: Service[]): Protection[] => {
  const byName = new Map(services.map(s => [s.name, s]));
  const out: Protection[] = [];
  (['PPF', 'Ceramic'] as const).forEach(kind => {
    const last = history.find(b => b.status === 'completed' && b.serviceCategory === kind);
    if (!last) return;
    const months = warrantyMonths(byName.get(last.serviceName)?.warranty);
    const until = months ? addMonths(last.scheduledDate, months) : null;
    out.push({
      kind, applied: last.scheduledDate, until,
      active: until ? until > new Date() : true,
      service: last.serviceName,
    });
  });
  return out;
};
