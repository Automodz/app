'use client';
/**
 * The door.
 *
 * Shared by both applications: a customer signs in here and lands in their
 * garage; staff sign in here and land in the studio OS. `app/admin/layout.tsx`
 * redirects every unauthenticated visitor to this route, so it must keep
 * working for admin to be usable at all.
 *
 * THE AUTH LOGIC IS UNCHANGED from `reference/customer-old/app/auth/login`:
 * Google sign-in, profile bootstrap, blocked-account sign-out, employee-role
 * linking, referral capture and redemption, the safe-redirect rule, the
 * already-signed-in short circuit, and every one of the five error branches.
 * The one addition is the httpOnly session cookie, which the server-rendered
 * rooms need and the old client-only rooms did not.
 *
 * Only the presentation is new: the old page's shape — mark, one sentence of
 * welcome, one control, the address, the way back — rendered in the design
 * system instead of Studio White's CSS variables.
 */
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { MotionConfig } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { COMPANY } from '@/lib/company';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { claimReferral } from '@/lib/services/referrals';
import { useAppStore } from '@/lib/store';
import Wordmark from '@/components/ui/Wordmark';
import { Button, Text, Loading, OfflineNote, useOnline } from '@/components/system';
import { color, space, INSET, type as typeScale, TARGET_MIN } from '@/design';
import { isInAppBrowser, currentUserAgent } from '@/lib/browser';

/**
 * Only ever return to an internal customer path — never an attacker's URL, and
 * never the operations application. The old rule was `startsWith('/app')`, which
 * did both jobs at once because every customer room lived under `/app`. The
 * rooms are at the root now, so the second job is stated explicitly: a customer
 * who was bounced off an `/admin` address must not be handed back to it.
 */
const safeDest = (redirect: string | null): string | null =>
  redirect
  && redirect.startsWith('/')
  && !redirect.startsWith('//')
  && !redirect.startsWith('/admin')
    ? redirect
    : null;

/**
 * MINT THE COOKIE THE SERVER ROOMS READ.
 *
 * The client SDK keeps its tokens in browser storage, which a server component
 * cannot see. Every customer room renders on the SERVER and reads this cookie;
 * without it a customer who has just signed in is served the signed-out
 * landing. So this is the one thing that has to be true before the door is
 * allowed to close behind anybody.
 *
 * `'unavailable'` is a 503 — the server has no Firebase Admin credentials, so
 * the studio is misconfigured rather than the customer being unwelcome.
 * `'refused'` is anything else, including a token the server would not take.
 */
type SessionResult = 'ok' | 'unavailable' | 'refused';

async function openServerSession(): Promise<SessionResult> {
  const current = auth?.currentUser;
  if (!current) return 'refused';
  let idToken: string;
  try {
    idToken = await current.getIdToken();
  } catch {
    return 'refused';
  }
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }).catch(() => null);
  if (res?.ok) return 'ok';
  return res?.status === 503 ? 'unavailable' : 'refused';
}

/** The door while the search params resolve — a state, not an absence (§19.1). */
function Door() {
  return (
    <main
      style={{
        minHeight: '100svh',
        background: color.paper,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Loading caption="Opening the studio" />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Door />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const { user, authLoading, setUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* §22.2 — the one reader of the connection. This surface used to consult
     `navigator.onLine` on its own. */
  const online = useOnline();

  /* THE DOOR IS LEFT EXACTLY ONCE. Two paths can decide it is time to go —
     a sign-in that just succeeded, and an arrival that was already signed in —
     and both are async now, so without this they can both fire. */
  const leaving = useRef(false);
  /* While a manual sign-in is in flight, the already-signed-in effect stands
     down. See the comment on that effect for why this is the whole bug. */
  const signingIn = useRef(false);

  const dest = safeDest(params.get('redirect'));

  // staff land in the studio OS; everyone else in the customer experience
  const homeFor = (role?: string) =>
    role === 'admin' || role === 'employee' ? '/admin' : (dest ?? '/');

  /**
   * LEAVE THE DOOR WITH A FULL PAGE LOAD.
   *
   * `router.replace` is a SOFT navigation: Next serves the destination from
   * the client Router Cache, which already holds the signed-out `/` payload
   * fetched before the customer clicked in. So the server was never asked
   * again, never saw the session cookie that had just been minted, and the
   * customer landed back on the public landing page looking signed out.
   *
   * `router.refresh()` is not the fix either — it clears the cache for the
   * CURRENT route, and the current route here is `/auth/login`, not the
   * destination. Signing in is a once-per-session event and a document load is
   * what actually guarantees the server re-renders with the new cookie.
   *
   * `dest` is already sanitised by `safeDest`, so this cannot be pointed
   * off-site.
   */
  const enter = useCallback((href: string) => {
    if (leaving.current) return;
    leaving.current = true;
    window.location.replace(href);
  }, []);

  /**
   * ALREADY SIGNED IN? NEVER SHOW THE DOOR TWICE — BUT NEVER LEAVE WITHOUT A
   * SERVER SESSION EITHER.
   *
   * This effect used to navigate the moment `user` appeared in the store, and
   * that is what broke signing in. `onAuthStateChanged` fires INSIDE
   * `signInWithPopup`, so `AuthProvider` reaches `setUser` several round trips
   * before `handleGoogle` reaches `POST /api/session`. This effect then
   * replaced the document while the cookie was still being minted — the
   * request died with the page, the server saw no cookie, and `/` answered
   * with the public landing. Measured against the emulator: `setUser` at
   * +2.3s, the session POST at +13.3s.
   *
   * Before the rooms moved to the server there was no cookie to lose, so the
   * same early redirect was simply a fast path. It is not one any more.
   *
   * Two things fix it, and both are needed. `signingIn` keeps this effect out
   * of the way of a sign-in that is already handling its own session, and for
   * every other arrival — a returning customer whose Firebase session is still
   * on disk but whose cookie has expired — the cookie is minted HERE before
   * the navigation, which is what stops that customer bouncing between the
   * landing and the door forever.
   */
  useEffect(() => {
    if (authLoading || !user || signingIn.current || leaving.current) return;
    let cancelled = false;
    void (async () => {
      const href = homeFor(user.role);
      /* No Firebase session behind the store user means the development auth
         shim put it there (`AuthProvider`), and there is no token to exchange.
         Staff land in `/admin`, which renders in the browser and reads no
         cookie, so neither is kept waiting on one. */
      const needsCookie = Boolean(auth?.currentUser) && href !== '/admin';
      if (needsCookie && (await openServerSession()) !== 'ok') {
        /* The session could not be opened, so entering would only land on the
           signed-out landing. Say so and stay at the door. */
        if (cancelled) return;
        setError('We could not open your studio. Please sign in again.');
        await signOut(auth).catch(() => {});
        setUser(null);
        return;
      }
      if (!cancelled) enter(href);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // capture an incoming referral code (?ref=CODE) before sign-in
  useEffect(() => {
    const ref = params.get('ref');
    if (ref) stashReferralCode(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    /* The note below already says it; refusing here stops a sign-in that
       cannot succeed from spending thirty seconds failing. */
    if (!online) return;
    setLoading(true);
    setError('');
    /* Claim the entry BEFORE the popup, because `onAuthStateChanged` fires
       inside it and the effect above would otherwise be racing this function
       from the moment the credential lands. */
    signingIn.current = true;

    try {
      const result = await signInWithGoogle();
      const firebaseUser = result.user;
      let profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);

      if (!profile) {
        await signOut(auth);
        setError('The studio could not open your account. Please try again.');
        return;
      }

      profile = await linkEmployeeRole(profile);

      /* HAND THE SERVER A SESSION IT CAN READ, BEFORE ANYTHING ELSE.
         Awaited, and awaited ahead of `setUser`, so nothing downstream can
         navigate out of this page while the exchange is still in the air. */
      const session = await openServerSession();

      if (session !== 'ok') {
        /* 503 means the server has no Firebase Admin credentials — the studio
           is misconfigured, not the customer. Anything else means the token
           was refused. Both leave the customer signed out; only the wording
           differs, and it differs so that whoever is on call can tell them
           apart from a screenshot. */
        await signOut(auth);
        setUser(null);
        setError(session === 'unavailable'
          ? 'The studio is not reachable right now. Please try again shortly.'
          : 'We signed you in, but could not open your studio. Please try again.');
        return;
      }

      setUser(profile);

      // redeem a referral the customer arrived with - best-effort, never blocks entry
      if (profile.role !== 'admin' && profile.role !== 'employee') {
        void claimReferral().catch(() => {});
      }

      enter(homeFor(profile.role));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // they simply changed their mind - not an error
      } else if (code === 'auth/popup-blocked') {
        /* Inside Instagram's or Facebook's webview there is no pop-up setting
           to change, so the old advice was an instruction the customer could
           not follow. Say the thing that actually works. */
        setError(isInAppBrowser(currentUserAgent())
          ? 'Open this page in Safari or Chrome to sign in — this app’s built-in browser can’t.'
          : 'Allow pop-ups for AutoModz, then try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('That didn’t reach Google — check your connection and try again.');
      } else {
        setError('That did not go through. Please try again.');
      }
    } finally {
      /* Only released on a failure — on success the document is on its way out
         and re-arming the effect would give it a second navigation to make. */
      if (!leaving.current) signingIn.current = false;
      setLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '100svh',
          background: color.paper,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${space.rest}px)`,
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${INSET}px)`,
          paddingInline: INSET,
        }}
      >
        {/* the ambient light the door develops out of */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '14%',
            left: '50%',
            width: 'min(120vw, 620px)',
            height: '46%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 62%)',
          }}
        />

        <span style={{ position: 'relative' }}>
          <Wordmark height={13} variant="white" />
        </span>

        <main
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            paddingBlock: space.rest,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'block',
              fontFamily: typeScale.display.family,
              fontWeight: 700,
              fontSize: 'clamp(40px, 13vw, 72px)',
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              color: color.ink,
            }}
          >
            Your studio
          </span>
          <Text
            role="body"
            tone="ink2"
            style={{ marginTop: INSET, maxWidth: 380, marginInline: 'auto' }}
          >
            Where your car lives — its care, its protection, its story.
          </Text>

          <div style={{ marginTop: space.rest, maxWidth: 340, marginInline: 'auto' }}>
            <Button
              tier="primary"
              onClick={handleGoogle}
              loading={loading}
              disabled={!online}
              full
            >
              Continue with Google
            </Button>
            {/* §22.2 — the one offline note, said in line. This was a sixth
                hand-written copy, reading `navigator.onLine` directly. */}
            <OfflineNote inline caption="You’re offline — reconnect to sign in." />

            {error ? (
              <Text role="body" tone="ink2" style={{ marginTop: space.line }} aria-live="polite">
                {error}
              </Text>
            ) : (
              <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
                One tap — no password to remember.
              </Text>
            )}
          </div>
        </main>

        <footer style={{ position: 'relative', textAlign: 'center' }}>
          <Text role="data" tone="ink3">{COMPANY.address}</Text>
          <div style={{ marginTop: space.breath }}>
            <Link
              href="/"
              style={{
                fontFamily: typeScale.body.family,
                fontSize: typeScale.body.size,
                fontWeight: 520,
                color: color.ink2,
                textDecoration: 'none',
                display: 'inline-block',
                minHeight: TARGET_MIN,
                lineHeight: `${TARGET_MIN}px`,
              }}
            >
              Back to AutoModz
            </Link>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
