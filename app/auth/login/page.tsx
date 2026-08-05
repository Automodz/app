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
import { Suspense, useState, useEffect } from 'react';
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
import { trace, traceStart, traceRead, traceSubscribe, type TraceEntry } from '@/lib/authTrace';

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

  /* THE STAGE TRAIL, on screen. Temporary. The failure reproduces on iPhone
     Safari, where there is no console without tethering to a Mac — so the
     instrument has to be readable on the device it is measuring. */
  const [stages, setStages] = useState<TraceEntry[]>([]);
  useEffect(() => {
    setStages(traceRead());
    return traceSubscribe(setStages);
  }, []);

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
  const enter = (href: string) => { window.location.replace(href); };

  // already signed in? never show the door twice
  useEffect(() => {
    if (authLoading || !user) return;
    enter(homeFor(user.role));
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

    traceStart();
    trace(1, 'before signInWithPopup', currentUserAgent().slice(0, 60));

    /* STAGE 2 has no Firebase callback — the SDK does not announce that it
       opened a window. Wrapping `window.open` for the duration of the call is
       the only honest way to observe it, and it distinguishes "the popup never
       opened" (blocked) from "it opened and never came back". */
    const nativeOpen = window.open;
    let popupSeen = false;
    window.open = function patched(...args: Parameters<typeof window.open>) {
      if (!popupSeen) {
        popupSeen = true;
        trace(2, 'popup opened', String(args[0] ?? '(no url)').slice(0, 80));
      }
      return nativeOpen.apply(window, args);
    } as typeof window.open;

    try {
      const result = await signInWithGoogle();
      window.open = nativeOpen;
      if (!popupSeen) trace(2, 'popup NEVER opened via window.open');
      trace(3, 'popup resolved');

      const firebaseUser = result.user;
      trace(4, auth.currentUser ? 'currentUser exists' : 'currentUser MISSING',
        auth.currentUser
          ? `${auth.currentUser.uid} · ${auth.currentUser.email ?? 'no email'}`
          : undefined);
      let profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);

      if (!profile) {
        await signOut(auth);
        setError('The studio could not open your account. Please try again.');
        return;
      }

      profile = await linkEmployeeRole(profile);
      setUser(profile);

      /* HAND THE SERVER A SESSION IT CAN READ.
         The client SDK keeps its tokens in browser storage, which a server
         component cannot see — so the customer rooms, which now render on the
         server, would show "behind a sign-in" to someone who had just signed
         in. This exchanges the fresh ID token for an httpOnly session cookie.
         Awaited, not fired-and-forgotten: the redirect below must not race it. */
      /* NOT best-effort, and it used to be. Every room renders on the SERVER
         and reads this cookie; without it a customer who has just signed in is
         served the signed-out landing. Swallowing the failure meant the only
         symptom was being bounced back to the front page with no explanation,
         which is indistinguishable from "the sign-in didn't work". */
      const idToken = await firebaseUser.getIdToken();
      /* The claims are decoded, NOT verified — this is a diagnostic. `aud` is
         the value the server compares against its own project id. */
      try {
        const claims = JSON.parse(atob(idToken.split('.')[1])) as
          { iss?: string; aud?: string; sub?: string; exp?: number };
        trace(5, 'getIdToken succeeded',
          `aud=${claims.aud} iss=${claims.iss} sub=${claims.sub} exp=${claims.exp}`);
      } catch {
        trace(5, 'getIdToken succeeded, claims unreadable', `len=${idToken.length}`);
      }

      trace(6, 'POST /api/session started');
      const session = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }).catch(() => null);

      trace(7, 'response status', session ? String(session.status) : 'fetch threw / no response');

      /* STAGE 8 CANNOT BE OBSERVED DIRECTLY. The session cookie is httpOnly by
         design, so `document.cookie` will never contain it — its absence here
         proves the flag, not a missing cookie. What is recorded is whether the
         response that should have set it succeeded. */
      trace(8, 'cookie (httpOnly — not readable from JS)',
        `response ok=${session?.ok ?? false}; document.cookie has session=${
          document.cookie.includes('automodz') }`);

      if (!session?.ok) {
        /* 503 means the server has no Firebase Admin credentials — the studio
           is misconfigured, not the customer. 401 means the token was refused.
           Both leave the customer signed out; only the wording differs, and it
           differs so that whoever is on call can tell them apart from a
           screenshot. */
        await signOut(auth);
        setUser(null);
        setError(session?.status === 503
          ? 'The studio is not reachable right now. Please try again shortly.'
          : 'We signed you in, but could not open your studio. Please try again.');
        return;
      }

      // redeem a referral the customer arrived with - best-effort, never blocks entry
      if (profile.role !== 'admin' && profile.role !== 'employee') {
        void claimReferral().catch(() => {});
      }

      trace(9, 'navigating', homeFor(profile.role));
      enter(homeFor(profile.role));
    } catch (err: unknown) {
      window.open = nativeOpen;
      const code = (err as { code?: string }).code;
      /* The single most useful line in the whole trace. */
      trace(0, 'THREW', `${code ?? 'no-code'} · ${(err as Error)?.message ?? String(err)}`);
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

            {/* TEMPORARY DIAGNOSTIC — remove with lib/authTrace.ts once the
                failing stage is known. Rendered only after an attempt, so a
                customer who signs in normally never sees it. */}
            {stages.length > 0 ? (
              <div style={{
                marginTop: space.rest,
                padding: space.line,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(0,0,0,0.35)',
                textAlign: 'left',
                fontFamily: typeScale.data.family,
                fontSize: 11,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.72)',
                overflowWrap: 'anywhere',
              }}>
                {stages.map((e, i) => (
                  <div key={`${e.stage}-${i}`} style={{ marginBottom: 4 }}>
                    <strong style={{ color: e.stage === 0 ? '#ff8080' : '#fff' }}>
                      {e.stage === 0 ? '✕' : e.stage}
                    </strong>
                    {' '}{e.label}
                    {e.detail ? <span style={{ opacity: 0.7 }}> — {e.detail}</span> : null}
                    <span style={{ opacity: 0.45 }}> +{e.at}ms</span>
                  </div>
                ))}
              </div>
            ) : null}
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
