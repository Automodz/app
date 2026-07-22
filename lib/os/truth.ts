import type { Booking } from '@/lib/types';
import { careAct, visitPhase, ACT_TITLE } from './visit';
import { daysLeft, termState } from './term';

/**
 * truthOf() - the one sentence under the car's name (design B1).
 * Priority is law: in studio > ready > agreed > term edge > care due > protected > quiet.
 * Pure derivation; never stored.
 */
export interface ProtectionFact {
  label: string;      // "Ceramic coat"
  expiresOn: string;  // ISO date
}

export interface TruthInput {
  visits: Booking[];              // this vehicle's visits
  protections: ProtectionFact[];  // this vehicle's live promises
  lastCaredOn?: string;           // ISO date of last completed visit
  now?: Date;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });

export function truthOf({ visits, protections, lastCaredOn, now = new Date() }: TruthInput): string {
  const live = visits.find(v => visitPhase(v.status) === 'live');
  if (live) {
    const act = careAct(live.status);
    if (act === 'ready') return 'Ready for collection.';
    return act ? `In the studio - ${ACT_TITLE[act].toLowerCase()}.` : 'In the studio.';
  }

  const agreed = visits
    .filter(v => visitPhase(v.status) === 'agreed' || visitPhase(v.status) === 'proposed')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  if (agreed) return `${fmtDay(agreed.scheduledDate)} ${agreed.scheduledTime} - we're ready for it.`;

  const edging = protections
    .map(p => ({ p, state: termState(p.expiresOn, { now }), left: daysLeft(p.expiresOn, now) }))
    .filter(x => x.state === 'waning' || x.state === 'expiring')
    .sort((a, b) => a.left - b.left)[0];
  if (edging) {
    return `${edging.p.label} - ${edging.left} day${edging.left === 1 ? '' : 's'} of protection left.`;
  }

  if (lastCaredOn) {
    const since = -daysLeft(lastCaredOn, now);
    if (since >= 30) return `Last cared for ${since} days ago.`;
  }

  const alive = protections.filter(p => termState(p.expiresOn, { now }) === 'active');
  if (alive.length > 0) return 'All quiet. Protected.';

  return 'All quiet.';
}
