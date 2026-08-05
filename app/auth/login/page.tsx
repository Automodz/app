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
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const params = useSearchParams();
  const { user, authLoading, setUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* §22.2 — the one reader of the connection. This surface used to consult
     `navigator.onLine` on its own. */
  const online = useOnline();

  const dest = safeDest(params.get('redirect'));

  // staff land in the studio OS; everyone else in the customer experience
  const homeFor = (role?: string) =>
    role === 'admin' || role === 'employee' ? '/admin' : (dest ?? '/');

  // already signed in? never show the door twice
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(homeFor(user.role));
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
      setUser(profile);

      /* HAND THE SERVER A SESSION IT CAN READ.
         The client SDK keeps its tokens in browser storage, which a server
         component cannot see — so the customer rooms, which now render on the
         server, would show "behind a sign-in" to someone who had just signed
         in. This exchanges the fresh ID token for an httpOnly session cookie.
         Awaited, not fired-and-forgotten: the redirect below must not race it. */
      try {
        const idToken = await firebaseUser.getIdToken();
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        /* The client session still works; the server rooms will ask again. */
      }
      // redeem a referral the customer arrived with - best-effort, never blocks entry
      if (profile.role !== 'admin' && profile.role !== 'employee') {
        void claimReferral().catch(() => {});
      }
      router.replace(homeFor(profile.role));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // they simply changed their mind - not an error
      } else if (code === 'auth/popup-blocked') {
        setError('Allow pop-ups for AutoModz, then try again.');
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
