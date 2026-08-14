/**
 * The Proposal engine (Constitution Art. 6 · P2). Care is proposed, not
 * requested: the system authors at most ONE open proposal per vehicle, and
 * every proposal cites the object that generated it. A proposal is not a
 * stored object - it is a pure derivation over a vehicle's protections and
 * care cadence, built on the existing term engine. Accepting one opens the
 * arrange sheet, which creates a real Visit (booking, status `pending`).
 */
import { daysLeft } from './term';
import type { LiveProtection } from './protection';
import { PROTECTION_TITLE, type ProtectionKind } from '@/lib/types';

/**
 * REPOINTED at the stored protection model (`lib/os/protection`), away from the
 * retired `lib/cx/protection`. The two carried a field called `term` that meant
 * different things - a health word in the old, a Term OBJECT in the new - so
 * the engine silently could not read a real customer's protections. Health now
 * comes from the one term engine (`healthOf`) rather than being re-derived here.
 *
 * Only the kinds the studio actually SELLS can be proposed. The stored model
 * has ten kinds, seven of which are customer-declared (insurance, PUC, RC,
 * FASTag…). Proposing "renew your registration" as a bookable service would be
 * nonsense, so the reverse of `CATEGORY_TO_KIND` is the whole permitted set.
 */
const KIND_TO_CATEGORY = {
  ppf: 'PPF',
  ceramic: 'Ceramic',
  glass: 'Coating',
} as const satisfies Partial<Record<ProtectionKind, string>>;

type ServiceableKind = keyof typeof KIND_TO_CATEGORY;

const isServiceable = (k: ProtectionKind): k is ServiceableKind => k in KIND_TO_CATEGORY;

export type ProposalCategory = (typeof KIND_TO_CATEGORY)[ServiceableKind] | 'Washing';

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
  protections: LiveProtection[];
  lastCaredOn?: string;
  now?: Date;
}): Proposal | null {
  const { vehicleId, protections, lastCaredOn, now = new Date() } = args;

  /* 1 · a protection nearing its end - urgent beats attention; cites the coat.
     `health` and `daysLeft` are the term engine's own derivation, so the
     lifecycle is decided in exactly one place (§22.2). A perpetual or balance
     term has no daysLeft and cannot be "nearing" a date it does not have. */
  const nearing = protections
    .filter(p => isServiceable(p.kind))
    .filter(p => p.health === 'attention' || p.health === 'urgent')
    .filter(p => p.daysLeft != null)
    .sort((a, b) => a.daysLeft! - b.daysLeft!);

  if (nearing.length) {
    const p = nearing[0];
    const left = p.daysLeft!;
    const word = PROTECTION_TITLE[p.kind];
    return {
      vehicleId,
      reason: `The ${word.toLowerCase()} has ${left} day${left === 1 ? '' : 's'} of protection left - time to renew it.`,
      headline: `${word} renewal due`,
      serviceCategory: KIND_TO_CATEGORY[p.kind as ServiceableKind],
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
