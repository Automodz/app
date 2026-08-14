/**
 * THE NEXT ACTION - an object, never a link.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §4
 *
 * The engine names WHAT SHOULD HAPPEN. It does not know where that happens,
 * and it must not: `lib/os/*` is shared with the studio's operations
 * application, where the same intent lives at an entirely different address.
 * An engine that knew `/studio` could never be reused by a surface where
 * arranging a visit is `/admin/bookings/new`.
 *
 * So this emits an intent and its parameters. `navigation/resolve.ts` - the one
 * place that owns the route table - turns it into an address. Change a route
 * and exactly one file changes.
 */
import type { OwnershipState } from './ownership';
import type { ClubModel } from './club';
import type { Proposal } from './proposal';

/**
 * Everything the product can ask an owner to do next. One per surface: if a
 * screen appears to need two, the state is under-modelled (§6).
 */
export type ActionIntent =
  | 'add_car'
  | 'arrange_visit'
  | 'arrange_again'
  | 'manage_visit'
  | 'follow_visit'
  | 'see_visit'
  | 'renew_protection'
  | 'renew_membership'
  | 'rejoin_membership';

export interface NextAction {
  intent: ActionIntent;
  /** The customer's words for the act. §21.8 */
  label: string;
  /**
   * What the intent acts upon. The resolver reads these; nothing else may.
   * `visitId` for a visit, `category` for a bookable service.
   */
  params?: { visitId?: string; category?: string; vehicleId?: string };
}

export interface ActionInput {
  state: OwnershipState;
  club: ClubModel;
  proposal: Proposal | null;
  liveVisitId?: string;
  agreedVisitId?: string;
  /** docs/HOME-STATE-MAP.md - a proposal only speaks in the steady states. */
  proposalApplies: boolean;
}

/**
 * The one next thing to do, for a given ownership position.
 *
 * Every arm returns an action: there is no state in which the product has
 * nothing to offer. "Nothing to do" is a screen that has given up.
 */
export function nextActionFor(input: ActionInput): NextAction {
  const { state, club, proposal, liveVisitId, agreedVisitId, proposalApplies } = input;

  switch (state) {
    case 'new':
      return { intent: 'add_car', label: 'Add your car' };

    case 'ready':
      return {
        intent: 'see_visit',
        label: 'See the visit',
        params: { visitId: liveVisitId },
      };

    case 'in_studio':
      return {
        intent: 'follow_visit',
        label: 'Follow the visit',
        params: { visitId: liveVisitId },
      };

    case 'booked':
      return {
        intent: 'manage_visit',
        label: 'Manage the visit',
        params: { visitId: agreedVisitId },
      };

    case 'declined':
      return { intent: 'arrange_again', label: 'Arrange again' };

    case 'membership_attention':
      return club.state === 'lapsed'
        ? { intent: 'rejoin_membership', label: 'Rejoin the Club' }
        : { intent: 'renew_membership', label: 'Renew the Club' };

    case 'warranty_expiring':
      return {
        intent: 'renew_protection',
        label: proposal?.serviceCategory === 'Washing' ? 'Arrange it' : 'Renew it',
        params: { category: proposal?.serviceCategory },
      };

    case 'unvisited':
      return { intent: 'arrange_visit', label: 'Arrange a visit' };

    case 'dormant':
    case 'protected':
    case 'settled':
    default:
      if (proposal && proposalApplies) {
        return {
          intent: 'renew_protection',
          label: proposal.serviceCategory === 'Washing' ? 'Arrange it' : 'Renew it',
          params: { category: proposal.serviceCategory },
        };
      }
      return { intent: 'arrange_visit', label: 'Arrange a visit' };
  }
}
