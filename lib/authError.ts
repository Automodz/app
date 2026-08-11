/**
 * WHAT WENT WRONG AT THE DOOR, SAID TWICE.
 *
 * Once to the customer, in words they can act on. Once to whoever is on call,
 * as the code the SDK actually raised.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * The door had four handled codes and an `else` that said "That did not go
 * through. Please try again." Everything else — a disabled provider, an
 * unauthorised domain, a browser refusing third-party storage, a Firestore
 * rule refusing the profile write — arrived as that one sentence.
 *
 * It is a fine sentence for a customer and a useless one for anybody trying to
 * fix it: a production failure was reported in Chrome AND Safari, for both new
 * and returning accounts, and the message was identical in every case, so
 * there was nothing to tell the causes apart by. The code was being thrown
 * away at the only place it was ever available.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 * The customer sentence NEVER contains a code, a stack, or a Firebase word.
 * The diagnostic ALWAYS carries the code, and reaches the console on every
 * environment — a customer will not open devtools, and the owner can.
 *
 * Pure: no React, no Firebase, no clock. So the mapping can be asserted
 * directly rather than by driving a sign-in.
 */

/** Whose problem it is. Decides nothing on screen; it is for the report. */
export type AuthFaultKind =
  /** The customer changed their mind. Not a failure at all. */
  | 'abandoned'
  /** The customer's browser or network. They can act on it. */
  | 'browser'
  /** The studio's configuration. Only the studio can fix it. */
  | 'studio'
  /** Unrecognised — the code is carried through so it can be named once seen. */
  | 'unknown';

export interface AuthFault {
  kind: AuthFaultKind;
  /** What the customer reads. Never a code, never jargon. Empty = say nothing. */
  message: string;
  /** The raw code, for the console and for `?debug=1`. */
  code: string;
}

/**
 * IN-APP BROWSERS CANNOT POP UP AT ALL.
 *
 * Instagram's and Facebook's webviews have no pop-up setting to change, so
 * "allow pop-ups" is an instruction the customer cannot follow. The only true
 * advice is to leave.
 */
const POPUP_BLOCKED = (inApp: boolean) => inApp
  ? 'Open this page in Safari or Chrome to sign in — this app’s built-in browser can’t.'
  : 'Allow pop-ups for AutoModz, then try again.';

/**
 * Map a thrown error to what the customer is told and what the console records.
 *
 * `inApp` is whether this is an in-app webview, which changes only the
 * pop-up advice.
 */
export function authFault(err: unknown, inApp = false): AuthFault {
  const code = String((err as { code?: unknown })?.code ?? '')
    || (err instanceof Error ? `js/${err.name}` : 'unknown');

  switch (code) {
    /* ── not failures ──────────────────────────────────────────────────── */
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return { kind: 'abandoned', message: '', code };

    /* ── the customer's side, and each one is actionable ───────────────── */
    case 'auth/popup-blocked':
      return { kind: 'browser', message: POPUP_BLOCKED(inApp), code };

    case 'auth/network-request-failed':
      return {
        kind: 'browser',
        message: 'That didn’t reach Google — check your connection and try again.',
        code,
      };

    /**
     * THE ONE THAT LOOKS LIKE NOTHING AND IS USUALLY STORAGE.
     *
     * The credential comes back through a hidden iframe on the auth domain,
     * which is a THIRD-PARTY origin to this site. Safari's tracking prevention
     * and Chrome's third-party-storage restrictions both block that frame's
     * storage, the relay never delivers, and the SDK raises this. It presents
     * to the customer as a sign-in that simply does not finish.
     */
    case 'auth/internal-error':
    case 'auth/timeout':
      return {
        kind: 'browser',
        message: 'Your browser blocked the last step. Turn off cross-site '
          + 'tracking prevention for this site, or try another browser.',
        code,
      };

    case 'auth/web-storage-unsupported':
      return {
        kind: 'browser',
        message: 'This browser is blocking the storage sign-in needs. Try a '
          + 'normal (non-private) window.',
        code,
      };

    case 'auth/account-exists-with-different-credential':
      return {
        kind: 'browser',
        message: 'That email is already here under a different sign-in. Use the '
          + 'one you started with.',
        code,
      };

    /* ── the studio's side. The customer is not at fault and is not asked
          to do anything except come back. ───────────────────────────────── */
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return {
        kind: 'studio',
        message: 'Sign-in is not set up correctly at our end. We’ve been told — '
          + 'please try again shortly.',
        code,
      };

    case 'auth/user-disabled':
      return {
        kind: 'studio',
        message: 'This account is closed. Talk to the studio and we’ll sort it.',
        code,
      };

    /**
     * FIRESTORE, NOT AUTH. The sign-in succeeded and the profile write did
     * not — a rules refusal, or the database unreachable. It arrived as the
     * generic message before, which made it indistinguishable from a failed
     * sign-in even though the customer was, at that moment, signed in.
     */
    case 'permission-denied':
      return {
        kind: 'studio',
        message: 'We signed you in but couldn’t open your studio. We’ve been '
          + 'told — please try again shortly.',
        code,
      };

    case 'unavailable':
    case 'deadline-exceeded':
      return {
        kind: 'browser',
        message: 'We couldn’t reach the studio. Check your connection and try again.',
        code,
      };

    default:
      return {
        kind: 'unknown',
        message: 'That did not go through. Please try again.',
        code,
      };
  }
}

/**
 * The line that reaches the console, on every environment.
 *
 * A customer will never open devtools; the owner can, and this is the whole
 * difference between "it says it did not go through" and a cause. It carries
 * the code and the SDK's own message and nothing about the customer.
 */
export function authDiagnostic(fault: AuthFault, err: unknown): string {
  const detail = (err as { message?: unknown })?.message;
  return `[auth] ${fault.kind}: ${fault.code}`
    + (typeof detail === 'string' && detail ? ` — ${detail}` : '');
}
