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
 * THE DOOR IS A ROOM, NOT A FORM.
 *
 * It used to be a mark, a button and an address on flat paper — which read as
 * a utility screen in a product whose whole argument is that this is where
 * something valuable is kept. It is now the first room of the application and
 * behaves like one: the car is present, the glass is the same glass every
 * other room is made of, and signing in is a passage with three states rather
 * than a button that stops responding.
 *
 *   waiting      the studio, the invitation, and what is behind the door
 *   opening      the press was received and something is happening
 *   welcoming    it worked, they are named, and then they are carried inside
 *
 * The third state is not decoration. The cookie exists by then, so the beat is
 * spent on a fact rather than on a guess, and it is the only moment in the
 * product where a customer is told they arrived rather than left to infer it.
 */
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { COMPANY } from '@/lib/company';
import { MEDIA } from '@/lib/media';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { claimReferral } from '@/lib/services/referrals';
import { useAppStore } from '@/lib/store';
import Wordmark from '@/components/ui/Wordmark';
import { GoogleMark } from '@/components/auth/GoogleMark';
import { Passage } from '@/components/auth/Passage';
import { Text, Loading, OfflineNote, useOnline } from '@/components/system';
import {
  color, scrim, space, radius, INSET, type as typeScale,
  duration, curve, TARGET_MIN, HAIRLINE,
} from '@/design';
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

/**
 * The beat between "you are in" and being carried inside.
 *
 * Long enough to be read, short enough that nobody waits for it. It is spent
 * AFTER the cookie exists, so it costs a customer nothing they were not
 * already waiting for — the session is already open behind this screen.
 */
const WELCOME_BEAT = 1150;

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

/**
 * WHAT IS BEHIND THE DOOR.
 *
 * A customer who has never signed in has no idea what signing in gets them,
 * and "Continue with Google" does not tell them. Three lines, each naming a
 * thing they will actually find, is the difference between a gate and an
 * invitation — and it is the honest version of the argument the landing page
 * makes at length.
 */
const BEHIND_THE_DOOR = [
  ['Your car’s record', 'Every visit, kept in one place.'],
  ['What’s protected', 'Coating, film, and when cover ends.'],
  ['One-tap booking', 'We already know your car.'],
] as const;

function Login() {
  const params = useSearchParams();
  const { user, authLoading, setUser } = useAppStore();

  /**
   * THE PASSAGE, AS A STATE.
   *
   * `loading` was a boolean on a button, which is the smallest possible
   * account of what is happening: a popup opens on another origin, a profile
   * is read, a role is reconciled and a session is minted, and for all of that
   * the screen said nothing. Naming the phase lets the room answer instead of
   * the control.
   */
  const [phase, setPhase] = useState<'waiting' | 'opening' | 'welcoming'>('waiting');
  const [greeting, setGreeting] = useState('');
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
   *
   * THE CLAIM IS TAKEN SYNCHRONOUSLY EVEN WHEN THE MOVE IS DELAYED. The
   * welcome beat runs between deciding to go and going, and `handleGoogle`'s
   * `finally` runs inside that window — so if the claim waited for the
   * timeout, the guard effect would be re-armed mid-passage and would mint a
   * second session behind the welcome.
   */
  const enter = useCallback((href: string, after = 0) => {
    if (leaving.current) return;
    leaving.current = true;
    if (after > 0) window.setTimeout(() => window.location.replace(href), after);
    else window.location.replace(href);
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
    setPhase('opening');
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

      /* The session is open — so the welcome is a statement, not a hope. */
      setGreeting((profile.name ?? '').trim().split(/\s+/)[0] ?? '');
      setPhase('welcoming');
      enter(homeFor(profile.role), WELCOME_BEAT);
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
      if (!leaving.current) {
        signingIn.current = false;
        setPhase('waiting');
      }
    }
  };

  const passing = phase !== 'waiting';

  return (
    <MotionConfig reducedMotion="user">
      <main
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: '100svh',
          background: color.paper,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${space.gap}px)`,
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${space.gap}px)`,
          paddingInline: INSET,
        }}
      >
        {/* ── THE CAR ──────────────────────────────────────────────────────
            The subject of the whole product, present at the first address a
            customer sees. §11.5 — never a grey box: this screen used to be
            exactly that. It leans in slightly while the session opens, which
            is the room acknowledging the press at a scale a spinner cannot. */}
        <motion.div
          aria-hidden
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: passing ? 1.04 : 1, opacity: 1 }}
          transition={{
            opacity: { duration: duration.scene / 1000, ease: curve.ease },
            scale: { duration: duration.morph / 1000, ease: curve.ease },
          }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <Image
            src={MEDIA.surfaces.studio}
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 42%' }}
          />
          {/* §11.2 — the scrim floor is not a suggestion. Type sits on this,
              so the photograph is held down to where ink is unambiguous. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                `linear-gradient(to bottom,`
                + ` rgba(10,11,13,${scrim.photo + 0.12}) 0%,`
                + ` rgba(10,11,13,${scrim.photoFloor - 0.19}) 26%,`
                + ` rgba(10,11,13,${scrim.photoFloor - 0.13}) 54%,`
                + ` rgba(10,11,13,${scrim.photo + 0.32}) 100%)`,
            }}
          />
        </motion.div>

        <span style={{ position: 'relative', paddingBlock: space.breath }}>
          <Wordmark height={13} variant="white" />
        </span>

        {/* ── THE PANEL ────────────────────────────────────────────────────
            The same glass every other room is made of, so the door is visibly
            part of the application rather than a page in front of it. */}
        <section
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 420,
            borderRadius: radius.sheet,
            border: `${HAIRLINE}px solid rgba(255,255,255,0.14)`,
            background: 'rgba(14,15,18,0.52)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            padding: INSET,
            textAlign: 'center',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'waiting' ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: duration.move / 1000, ease: curve.ease }}
              >
                <h1
                  style={{
                    fontFamily: typeScale.display.family,
                    fontWeight: 700,
                    fontSize: 'clamp(34px, 10vw, 52px)',
                    lineHeight: 1.0,
                    letterSpacing: '-0.03em',
                    color: color.ink,
                    margin: 0,
                  }}
                >
                  Your studio
                </h1>
                <Text
                  role="body"
                  tone="ink2"
                  style={{ marginTop: space.line, marginInline: 'auto', maxWidth: 320 }}
                >
                  Where your car lives — its care, its protection, its story.
                </Text>

                {/* ── THE CONTROL ──────────────────────────────────────────
                    Google's mark, on Google's terms, in our material. A bare
                    word on a dark slab asked the customer to take on trust
                    that this was really Google; the mark is what makes it
                    obvious in the half-second before they commit. */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={!online}
                  style={{
                    marginTop: space.rest / 2,
                    width: '100%',
                    minHeight: TARGET_MIN + 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: space.line,
                    borderRadius: radius.pill,
                    border: 'none',
                    background: online ? color.ink : 'rgba(244,245,246,0.38)',
                    color: color.paper,
                    fontFamily: typeScale.body.family,
                    fontSize: 16,
                    fontWeight: 620,
                    letterSpacing: '-0.01em',
                    cursor: online ? 'pointer' : 'not-allowed',
                    transition: `transform ${duration.tick}ms ${'cubic-bezier(0.22,1,0.36,1)'}`,
                  }}
                >
                  <GoogleMark />
                  Continue with Google
                </button>
                {/* §22.2 — the one offline note, said in line. This was a sixth
                    hand-written copy, reading `navigator.onLine` directly. */}
                <OfflineNote inline caption="You’re offline — reconnect to sign in." />

                {error ? (
                  <Text
                    role="body"
                    tone="ink2"
                    style={{ marginTop: space.line }}
                    aria-live="polite"
                  >
                    {error}
                  </Text>
                ) : (
                  <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
                    One tap — no password to remember.
                  </Text>
                )}

                {/* ── WHAT IS BEHIND IT ────────────────────────────────── */}
                <div
                  style={{
                    marginTop: space.rest / 2,
                    paddingTop: space.gap,
                    borderTop: `${HAIRLINE}px solid rgba(255,255,255,0.10)`,
                    display: 'grid',
                    gap: space.line,
                    textAlign: 'left',
                  }}
                >
                  {BEHIND_THE_DOOR.map(([title, said]) => (
                    <div key={title} style={{ display: 'flex', gap: space.line, alignItems: 'baseline' }}>
                      <span
                        aria-hidden
                        style={{
                          width: 5,
                          height: 5,
                          flexShrink: 0,
                          borderRadius: radius.pill,
                          background: color.ink3,
                          transform: 'translateY(-2px)',
                        }}
                      />
                      <span>
                        <Text role="body" tone="ink" style={{ display: 'block', fontWeight: 600 }}>{title}</Text>
                        <Text role="whisper" tone="ink3" style={{ display: 'block' }}>{said}</Text>
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* ── THE PASSAGE ────────────────────────────────────────────
                 One surface for both moving states, so the panel does not
                 change size underneath the customer mid-sign-in. */
              <motion.div
                key="passing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: duration.move / 1000, ease: curve.ease }}
              >
                <Passage phase={phase} greeting={greeting} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── THE STUDIO ───────────────────────────────────────────────────
            The address was 9pt grey at the bottom of the screen — legally
            present, practically invisible. It is the studio's own name and
            street; it is what makes this a real place. And the way back is a
            control now, not a link in body type. */}
        <footer
          style={{
            position: 'relative',
            textAlign: 'center',
            display: 'grid',
            gap: space.line,
            justifyItems: 'center',
            paddingBlock: space.breath,
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: space.breath,
              minHeight: TARGET_MIN,
              paddingInline: space.gap,
              borderRadius: radius.pill,
              border: `${HAIRLINE}px solid rgba(255,255,255,0.16)`,
              fontFamily: typeScale.body.family,
              fontSize: 14,
              fontWeight: 560,
              color: color.ink2,
              textDecoration: 'none',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>←</span>
            Back to AutoModz
          </Link>
          <Text role="whisper" tone="ink3" style={{ maxWidth: 300 }}>
            {COMPANY.name} · {COMPANY.address}
          </Text>
        </footer>
      </main>
    </MotionConfig>
  );
}
