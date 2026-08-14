'use client';
/**
 * STAYING SIGNED IN.
 *
 * There are TWO sessions in this product and they expire independently. The
 * Firebase client session lives in IndexedDB under `browserLocalPersistence`
 * and effectively never lapses on its own. The server session is an httpOnly
 * cookie with Firebase's fourteen-day ceiling, and it is the only one the rooms
 * can read - so when the cookie goes, a customer whose Firebase session is
 * perfectly intact is served the public landing page as though they had never
 * signed in.
 *
 * Until now the ONLY place that cookie could be minted was `/auth/login`. So
 * the recovery path was: open the app, see marketing, work out that you are
 * somehow signed out, find the sign-in, and let its effect quietly re-open the
 * session you already had. Most people would just conclude the app had logged
 * them out.
 *
 * This closes that gap in the obvious way every other application does: if the
 * server says nobody is here but the browser still holds a real Firebase
 * session, open the server session and re-render. No prompt, no popup, no door.
 *
 * ── WHAT IT COSTS AN ANONYMOUS VISITOR: NOTHING ─────────────────────────────
 * The Firebase auth SDK is a heavy import and the public landing page must not
 * carry it. So this checks a one-bit local marker FIRST, and only reaches for
 * the SDK if this browser has ever had a session opened in it. A first-time
 * visitor loads no Firebase at all.
 *
 * The marker is not a credential and grants nothing: it says "somebody once
 * signed in on this device", and every actual decision is still made by the
 * Admin SDK against a token it verifies. It is cleared on sign-out and whenever
 * the server refuses.
 *
 * ── AND IT NEVER LOOPS ──────────────────────────────────────────────────────
 * One attempt per tab, recorded in `sessionStorage` before the attempt rather
 * than after it. A refresh that failed to produce a cookie would otherwise
 * re-render, find no session, and try again for ever.
 */
import { useEffect } from 'react';

/** "Somebody has signed in on this device." One bit, no identity, no token. */
export const KNOWN = 'automodz-known';
/** "This tab has already tried to recover the session." */
const TRIED = 'automodz-session-tried';

export const rememberDevice = () => {
  try { localStorage.setItem(KNOWN, '1'); } catch { /* storage denied */ }
};

export const forgetDevice = () => {
  try {
    localStorage.removeItem(KNOWN);
    sessionStorage.removeItem(TRIED);
  } catch { /* storage denied */ }
};

export function SessionKeeper({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    /* The server can already see who this is. Nothing to recover. */
    if (signedIn) { rememberDevice(); return; }

    let known = false;
    let tried = true;
    try {
      known = localStorage.getItem(KNOWN) === '1';
      tried = sessionStorage.getItem(TRIED) === '1';
    } catch {
      /* Private mode with storage denied: no marker to read, so no attempt.
         The door still works and is one tap away. */
      return;
    }
    if (!known || tried) return;

    let cancelled = false;
    void (async () => {
      try { sessionStorage.setItem(TRIED, '1'); } catch { /* nothing to record with */ }

      /* Imported HERE, not at module scope: this is the line that keeps the
         Firebase SDK out of the public landing page's bundle. */
      const { waitForUser, idToken } = await import('@/lib/clientSession');
      const user = await waitForUser();
      if (cancelled) return;

      if (!user) {
        /* The Firebase session is genuinely gone - cleared storage, a revoked
           account, seven days of Safari inactivity. The marker is a lie now. */
        forgetDevice();
        return;
      }

      /* FORCED. A cached ID token lives an hour and refreshes only near its
         expiry, so a device that slept through that boundary offers an expired
         one. (It is NOT true that a cookie mint refuses anything older than
         five minutes - measured, 377 seconds old, accepted.) */
      const token = await idToken(true);
      if (cancelled || !token) return;

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }).catch(() => null);
      if (cancelled) return;

      if (res?.ok) {
        /**
         * A DOCUMENT LOAD, not `router.refresh()`.
         *
         * `refresh` would re-fetch THIS route and leave every other RSC payload
         * in the client Router Cache exactly as it was - rendered a moment ago,
         * signed out. A soft navigation afterwards could then serve one of
         * those. `__tests__/auth/entry.test.ts` holds the whole product to this
         * rule ("nothing soft-navigates across a change the server must see"),
         * and gaining a session is such a change; carving an exception for the
         * one case where the stale payload is merely embarrassing rather than
         * dangerous is how the rule stops being a rule.
         *
         * `replace`, so the history does not grow, and to the same address, so
         * the customer arrives where they were already trying to be. It costs
         * one load, once, to a customer whose fourteen-day cookie has lapsed.
         */
        window.location.replace(window.location.href);
        return;
      }
      /* 401 means the server looked at a real token and said no: revoked,
         disabled, or for another project. Stop claiming this device knows
         anybody. A 503 or a dead network says nothing, so the marker stands
         and the next visit tries again. */
      if (res?.status === 401) forgetDevice();
    })();

    return () => { cancelled = true; };
  }, [signedIn]);

  return null;
}
