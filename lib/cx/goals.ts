/**
 * Care goals — the booking flow asks "What does your car need today?"
 * instead of listing service categories. Each goal maps onto the existing
 * catalog; the recommendation engine picks ONE service and explains why.
 * Presentation-only: pricing, categories and the catalog stay untouched.
 */
import type { Booking, Service, Subscription, Vehicle } from '@/lib/types';
import type { Protection } from '@/lib/cx/protection';

export type GoalId = 'protect' | 'shine' | 'quick' | 'deep' | 'maintain';

export type Goal = {
  id: GoalId;
  /** service category the goal maps onto */
  category: Service['category'];
  title: string;
  line: string;
};

export const GOALS: Goal[] = [
  { id: 'protect',  category: 'PPF',     title: 'Protect my paint',   line: 'Invisible film armour against chips and scratches' },
  { id: 'shine',    category: 'Ceramic', title: 'Restore the shine',  line: 'Ceramic depth and gloss that lasts for years' },
  { id: 'quick',    category: 'Washing', title: 'A quick wash',       line: 'In and out — clean, dried, dressed' },
  { id: 'deep',     category: 'Washing', title: 'A deep clean',       line: 'Every panel, wheel and seam, done properly' },
  { id: 'maintain', category: 'Coating', title: 'Keep it maintained', line: 'Teflon and glass care between the big work' },
];

export type Recommendation = {
  service: Service;
  /** concierge one-liners explaining the pick — shown as "why this" */
  reasons: string[];
};

/** Pick one service for a goal, personalised to the vehicle's history,
 *  protection state and membership. Deterministic, no pressure. */
export function recommend(
  goal: Goal,
  services: Service[],
  ctx: {
    vehicle: Vehicle;
    history: Booking[];          // this vehicle's bookings, newest first
    protection: Protection[];
    membership: Subscription | null;
    washesRemaining: number;
  },
): Recommendation | null {
  const pool = services.filter(s => s.category === goal.category);
  if (pool.length === 0) return null;

  const reasons: string[] = [];
  let pick: Service;

  if (goal.id === 'quick') {
    pick = [...pool].sort((a, b) => a.duration - b.duration || a.price - b.price)[0];
    reasons.push('The fastest way to a clean car in our catalog.');
  } else if (goal.id === 'deep') {
    pick = [...pool].sort((a, b) => b.price - a.price)[0];
    reasons.push('Our most thorough wash — every seam gets attention.');
  } else {
    pick = pool.find(s => s.popular) ?? [...pool].sort((a, b) => a.order - b.order)[0];
    if (pick.popular) reasons.push('The choice most owners make for this.');
  }

  // Personal context — read from the car's own story
  const done = ctx.history.find(b => b.status === 'completed' && b.serviceName === pick.name);
  if (done) reasons.push(`${ctx.vehicle.name} has had this before and it served it well.`);

  const layer = ctx.protection.find(p => p.kind === goal.category);
  if (layer && !layer.active) {
    reasons.push(`Its previous ${layer.kind} protection has lapsed — a fresh layer restores it.`);
  } else if (layer?.active && layer.until) {
    reasons.push(`Note: its current ${layer.kind} is protected until ${layer.until.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`);
  }

  if (goal.category === 'Washing' && ctx.membership && ctx.washesRemaining > 0) {
    reasons.push(`Covered by your ${ctx.membership.plan} membership — no charge today.`);
  }

  if (reasons.length === 0) reasons.push('Matched to what your car needs for this goal.');
  return { service: pick, reasons };
}

/** Deep links still speak category (?cat=PPF) — resolve to the goal. */
export const goalForCategory = (cat: string): Goal | undefined =>
  GOALS.find(g => g.category === cat);
