/**
 * OWNERSHIP STATE → WHAT THE SCREEN SAYS.
 *
 * Source: docs/HOME-STATE-MAP.md
 * Reference: reference/customer-old/app/app/page.tsx:348-421
 *
 * The engine decides WHICH state the car is in. This decides what that state
 * SAYS - nothing more. It builds no addresses: the next action is emitted as an
 * intent by `lib/os/action.ts` and resolved by `navigation/resolve.ts`, so
 * neither this file nor any renderer knows a route
 * (docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §4).
 *
 * All nine branches are ported from the old Home. Six of them have been
 * unreachable since the customer UI was replaced, because the engine that
 * produces them had no callers.
 */

import type { StateTone } from '@/design';
import { ACT_TITLE, ACT_LINE, careAct, visitPhase } from '@/lib/os/visit';
import { longDate } from './project';
import type { OwnershipRead } from './ownership';
import { proposalApplies } from './ownership';

export interface HomeStateCopy {
  word: string;
  line?: string;
  /** A second, quieter fact - the service name, the reason it was refused. */
  note?: string;
  /**
   * One honest line about time, from `os/stay`. Absent unless the engine has
   * something true to say - §19.2 forbids inventing a duration.
   */
  timing?: string;
  tone: StateTone;
}

/** §3.3 - colour only where it carries meaning grey cannot. */
const NEUTRAL: StateTone = 'lapsed';

export function homeStateCopy(read: OwnershipRead, carName: string): HomeStateCopy {
  const { state, live, agreed, declined, club, proposal, stay } = read;
  const car = carName || 'your car';

  switch (state) {
    /* ── the car is with us ─────────────────────────────────────────────── */
    case 'ready':
      return {
        word: 'Ready',
        line: `The ${car} is ready to collect.`,
        /* The studio's own words when it left a note, else the service. §13.3 */
        note: stay?.narrationIsStudio ? stay.narration : live?.serviceName,
        timing: stay?.timing ?? undefined,
        tone: 'assent',
      };

    case 'in_studio': {
      const act = live ? careAct(live.status) : null;
      return {
        word: act ? ACT_TITLE[act] : 'In the studio',
        /* When the studio has narrated this act, its sentence outranks ours. */
        line: stay?.narrationIsStudio
          ? stay.narration
          : (act ? ACT_LINE[act] : `The ${car} is with us.`),
        note: live?.serviceName,
        /* One honest line about time, or nothing at all - never a guess. */
        timing: stay?.timing ?? undefined,
        tone: NEUTRAL,
      };
    }

    /* ── something is agreed ────────────────────────────────────────────── */
    case 'booked': {
      if (!agreed) return { word: 'Booked in', tone: 'assent' };
      const confirmed = visitPhase(agreed.status) === 'agreed';
      const when = agreed.scheduledDate ? longDate(agreed.scheduledDate) : '';
      const at = agreed.scheduledTime ? ` at ${agreed.scheduledTime}` : '';
      return {
        word: confirmed ? 'Booked in' : 'Requested',
        line: `${agreed.serviceName}, ${when}${at}.`,
        tone: confirmed ? 'assent' : NEUTRAL,
      };
    }

    /* ── something went wrong, and it is recent enough to answer ────────── */
    case 'declined':
      return {
        word: declined?.noShow ? 'Missed' : 'Not taken',
        line: declined?.noShow
          ? `The ${car} missed its slot.`
          : 'We couldn’t take that visit.',
        note: declined?.rejectionReason ?? undefined,
        tone: 'urgent',
      };

    /* ── the Club needs answering ───────────────────────────────────────── */
    case 'membership_attention': {
      const gone = club.state === 'lapsed';
      return {
        word: 'The Club',
        line: gone ? 'Your membership has lapsed.' : 'Your membership needs renewing.',
        note: club.context ?? undefined,
        tone: gone ? 'urgent' : 'caution',
      };
    }

    /* ── a layer is waning ──────────────────────────────────────────────── */
    case 'warranty_expiring':
      return {
        word: 'Care due',
        line: proposal?.headline ? `${proposal.headline}.` : undefined,
        note: proposal?.reason,
        tone: 'caution',
      };

    /* ── a car, but no story yet ────────────────────────────────────────── */
    case 'new':
      return {
        word: 'New',
        line: 'Your car’s place is ready.',
        tone: NEUTRAL,
      };

    case 'unvisited':
      return {
        word: 'New',
        line: `The ${car} hasn’t been in yet.`,
        tone: NEUTRAL,
      };

    /* ── the steady states, where a proposal may speak ───────────────────── */
    case 'dormant':
    case 'protected':
    case 'settled':
    default: {
      if (proposal && proposalApplies(state)) {
        return {
          word: 'Care due',
          line: `${proposal.headline}.`,
          note: proposal.reason,
          tone: 'caution',
        };
      }
      return {
        word: state === 'dormant' ? 'Resting' : 'Cared for',
        tone: 'assent',
      };
    }
  }
}
