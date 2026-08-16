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
  /**
   * THE ONE SENTENCE, AND THERE IS ONLY ONE.
   *
   * `note` stood beside it - "a second, quieter fact" - and Home drew both,
   * stacked. On a car with a waning coat that read:
   *
   *     Ceramic coating renewal due.
   *     The ceramic coating has 14 days of protection left - time to renew it.
   *
   * which is one fact said twice, because `os/proposal` emits a HEADLINE and a
   * REASON for a card and the hero was borrowing both. The owner asked for one
   * line under the car, and one line is also §4.4: a fact is said once.
   *
   * So each branch below returns a single sentence, and where a branch used to
   * carry a second fact worth keeping - why a visit was refused, what the Club
   * needs - it is joined into that sentence rather than stacked under it.
   */
  line?: string;
  /**
   * One honest line about time, from `os/stay`. Absent unless the engine has
   * something true to say - §19.2 forbids inventing a duration.
   */
  timing?: string;
  tone: StateTone;
}

/** §3.3 - colour only where it carries meaning grey cannot. */
const NEUTRAL: StateTone = 'lapsed';

/**
 * A clause joined onto a sentence, so it reads as one rather than as two
 * stapled together. The studio writes its reasons as sentences of their own -
 * "The bay was needed for a longer job." - and " - The bay was needed…" in the
 * middle of a line is a capital letter with nothing in front of it.
 */
const lower = (s: string): string =>
  (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

export function homeStateCopy(read: OwnershipRead, carName: string): HomeStateCopy {
  const { state, live, agreed, declined, club, proposal, stay } = read;
  const car = carName || 'your car';

  switch (state) {
    /* ── the car is with us ─────────────────────────────────────────────── */
    case 'ready':
      return {
        word: 'Ready',
        /* §13.3 - the studio's own words outrank ours when it left any. The
           SERVICE NAME used to sit under this as a second line; it is on the
           visit the customer is about to open, and a name is not a sentence. */
        line: stay?.narrationIsStudio && stay.narration
          ? stay.narration
          : `The ${car} is ready to collect.`,
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
        /* THE REASON IS THE SENTENCE, not a line under it. A refusal without
           its reason is the studio declining and not saying why. */
        line: declined?.noShow
          ? `The ${car} missed its slot.`
          : declined?.rejectionReason
            ? `We couldn’t take that visit - ${lower(declined.rejectionReason)}`
            : 'We couldn’t take that visit.',
        tone: 'urgent',
      };

    /* ── the Club needs answering ───────────────────────────────────────── */
    case 'membership_attention': {
      const gone = club.state === 'lapsed';
      const said = gone ? 'Your membership has lapsed' : 'Your membership needs renewing';
      return {
        word: 'The Club',
        line: club.context ? `${said} - ${lower(club.context)}` : `${said}.`,
        tone: gone ? 'urgent' : 'caution',
      };
    }

    /* ── a layer is waning ──────────────────────────────────────────────── */
    case 'warranty_expiring':
      return {
        word: 'Care due',
        /* THE REASON, NOT THE HEADLINE. The two are a card's title and its
           body - "Ceramic coating renewal due." over "The ceramic coating has
           14 days of protection left - time to renew it." - and the hero drew
           both, one above the other, saying the same thing with and without
           the number. The reason contains the headline; the headline does not
           contain the reason. */
        line: proposal?.reason ?? (proposal?.headline ? `${proposal.headline}.` : undefined),
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
        /* The reason, for the same reason as `warranty_expiring` above. */
        return {
          word: 'Care due',
          line: proposal.reason ?? `${proposal.headline}.`,
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
