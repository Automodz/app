/**
 * The Proposal engine (Constitution Art. 6 · P2). Care is proposed, not
 * requested: the system authors at most ONE open proposal per vehicle, and
 * every proposal cites the object that generated it. A proposal is not a
 * stored object - it is a pure derivation over a vehicle's protections and
 * care cadence, built on the existing term engine. Accepting one opens the
 * arrange sheet, which creates a real Visit (booking, status `pending`).
 */
import { termState, daysLeft } from './term';
import { PROTECTION_WORD, type Protection, type ProtectionKind } from '@/lib/cx/protection';

export type ProposalCategory = ProtectionKind | 'Washing';

export interface Proposal {
  vehicleId: string;
  /** full sentence, names the source object (voice law) */
  reason: string;
  /** short line for the capsule */
  headline: string;
  /** arrange-sheet prefill */
  serviceCategory: ProposalCategory;
}

/** A wash is due when the last care was this many days ago. */
export const WASH_CADENCE_DAYS = 30;

export function proposalFor(args: {
  vehicleId: string;
  protections: Protection[];
  lastCaredOn?: string;
  now?: Date;
}): Proposal | null {
  const { vehicleId, protections, lastCaredOn, now = new Date() } = args;

  // 1 · a protection nearing its end - expiring beats waning; cites the coat
  const nearing = protections
    .filter(p => p.until)
    .map(p => {
      const iso = p.until!.toISOString().split('T')[0];
      return { p, state: termState(iso, { now }), left: daysLeft(iso, now) };
    })
    .filter(x => x.state === 'waning' || x.state === 'expiring')
    .sort((a, b) => a.left - b.left);

  if (nearing.length) {
    const { p, left } = nearing[0];
    const word = PROTECTION_WORD[p.kind];
    return {
      vehicleId,
      reason: `The ${word.toLowerCase()} has ${left} day${left === 1 ? '' : 's'} of protection left - time to renew it.`,
      headline: `${word} renewal due`,
      serviceCategory: p.kind,
    };
  }

  // 2 · care cadence - cites the last visit
  if (lastCaredOn) {
    const since = -daysLeft(lastCaredOn, now); // past date → positive days since
    if (since >= WASH_CADENCE_DAYS) {
      return {
        vehicleId,
        reason: `It's been ${since} days since the last wash - a maintenance wash keeps it looking its best.`,
        headline: 'Maintenance wash due',
        serviceCategory: 'Washing',
      };
    }
  }

  return null;
}
