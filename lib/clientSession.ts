/**
 * WHO IS SIGNED IN, IN THE BROWSER — WAITED FOR, NOT GUESSED AT.
 *
 * `auth.currentUser` is null for the first moments of every page load. The SDK
 * restores the persisted session from IndexedDB asynchronously, and until that
 * lands it has no idea who anybody is. Code that reads `currentUser` straight
 * after an import is not reading "signed out" — it is reading "not yet".
 *
 * ON THE ADMIN AND KIOSK TREES that was survivable, because `ClientSession`
 * mounts `AuthProvider`, whose `onAuthStateChanged` subscription is what drives
 * the restore and holds the answer by the time anything is clickable.
 *
 * THE CUSTOMER ROOMS MOUNT NONE OF IT. They render on the server and
 * deliberately ship no provider — which is the right trade for a first paint,
 * and it means nothing in those rooms ever subscribes, so `currentUser` can
 * still be null at the moment a customer presses something. What that produced:
 *
 *   · finishing the first arrival threw `signed-out` and told the customer
 *     "that didn't save" — so `welcomedAt` was never written and the welcome
 *     greeted them again on every single sign-in, forever;
 *   · a booking, and the availability lookup behind it, went out with no
 *     Authorization header and came back 401.
 *
 * Each was found and fixed separately as though it were its own bug. They are
 * one bug, and this is the one answer to it: subscribe once, resolve the moment
 * the SDK knows, and never ask before then. §22.2 — one implementation of
 * anything.
 *
 * `onAuthStateChanged` rather than `authStateReady()` because the latter is not
 * in this SDK version's modular surface, and this works on every version.
 */
import type { User } from 'firebase/auth';

/**
 * The signed-in user once the SDK has actually decided, or null.
 *
 * Resolves immediately when the answer is already known, so the common case
 * costs nothing. Never rejects: "we could not tell" and "nobody" are the same
 * answer to every caller here, and a throw would only turn a signed-out state
 * into an error somebody has to catch.
 */
export async function waitForUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  const { auth } = await import('./firebase');
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  const { onAuthStateChanged } = await import('firebase/auth');
  return new Promise<User | null>((resolve) => {
    /* Unsubscribed on the first answer — this is a question, not a feed. */
    const stop = onAuthStateChanged(
      auth,
      (user) => { stop(); resolve(user); },
      () => { stop(); resolve(null); },
    );
  });
}

/**
 * A fresh ID token for the signed-in customer, or null.
 *
 * Carried by every authenticated `fetch` in the browser. It is the STRONGER
 * proof and is preferred wherever it exists — but its absence no longer means
 * signed out: see `authedFetch`.
 */
export async function idToken(force = false): Promise<string | null> {
  const user = await waitForUser();
  if (!user) return null;
  try {
    return await user.getIdToken(force);
  } catch {
    return null;
  }
}

/** The signed-in customer's uid once known, or null. */
export async function currentUid(): Promise<string | null> {
  return (await waitForUser())?.uid ?? null;
}

/**
 * AN AUTHENTICATED REQUEST, WITHOUT DEMANDING THE CLIENT SDK BE AWAKE.
 *
 * ── THE FAILURE THIS EXISTS FOR ──────────────────────────────────────────
 * The rooms authenticate with the httpOnly session cookie; the routes
 * authenticated with a Bearer token from the Firebase client SDK. Those two
 * lapse independently — the token after an hour, refreshed only while a page
 * holding the SDK is alive, the cookie after fourteen days — and every caller
 * did this:
 *
 *     const token = await idToken();
 *     if (!token) { setError('Your session has expired.'); return; }
 *
 * So a customer reached a room that had just rendered their car, their visit
 * and their price, tapped its one control, and was told they were signed out.
 * They were not. Observed on the scope screen, where the coverages drew and
 * the estimate beside them refused to price.
 *
 * ── WHAT THIS DOES INSTEAD ───────────────────────────────────────────────
 * Attaches the token when there IS one, and otherwise sends the request
 * anyway: it is same-origin, so the cookie rides along and the route accepts
 * it (`lib/server/session.callerOf`, guarded against cross-site by
 * `lib/os/origin`). Only a 401 from the server means signed out — which is the
 * only thing that ever actually did.
 */
export async function authedFetch(
  input: string, init: RequestInit = {}, forceFresh = false,
): Promise<Response> {
  const token = await idToken(forceFresh);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  /* `same-origin` is the default, and stated so the cookie's presence is a
     decision rather than an accident of the fetch spec. */
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
