'use client';
/**
 * The door (Studio White).
 *
 * The first frame of the customer product, so it renders in the customer's
 * own language: paper, the text primitives, the one Action, one sentence of
 * welcome. Authentication itself is unchanged - only the experience around it.
 *
 * It also closes the auth loop: a customer who arrives already signed in is
 * sent straight in (never shown the door twice), and a customer sent here from
 * a guarded deep link is returned to exactly where they were headed.
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
import { StudioLoading } from '@/components/os/StudioBoot';
import Action from '@/components/os/Action';
import { Body, Data, Whisper } from '@/components/os/text';

/** Only ever return to an internal customer path - never an attacker's URL. */
const safeDest = (redirect: string | null): string | null =>
  redirect && redirect.startsWith('/app') && !redirect.startsWith('//') ? redirect : null;

export default function LoginPage() {
  return (
    <Suspense fallback={<StudioLoading />}>
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

  const dest = safeDest(params.get('redirect'));

  // where a signed-in customer belongs - a deep link if they were sent here
  // from one, otherwise their garage; staff always land in the studio OS
  const homeFor = (role?: string) =>
    role === 'admin' || role === 'employee' ? '/admin' : (dest ?? '/app');

  // already signed in? never show the door twice - go straight in
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(homeFor(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Capture an incoming referral code (?ref=CODE) before sign-in
  useEffect(() => {
    const ref = params.get('ref');
    if (ref) stashReferralCode(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Google sign-in - the only way in ──────────────────────────────────
  const handleGoogle = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You’re offline — reconnect to sign in.');
      return;
    }
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
      // redeem a referral the customer arrived with (?ref=CODE stashed above) -
      // best-effort so it never blocks entry; the promo is created server-side
      if (profile.role !== 'admin' && profile.role !== 'employee') {
        void claimReferral().catch(() => {});
      }
      router.replace(homeFor(profile.role));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      // the customer cancelling the Google window is not an error
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // stay silent - they simply changed their mind
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
        className="studio"
        style={{
          position: 'relative', overflow: 'hidden',
          minHeight: '100svh',
          background: 'radial-gradient(130% 78% at 50% 24%, var(--st-paper) 0%, var(--st-gallery) 58%, var(--st-linen) 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(env(safe-area-inset-top) + var(--st-rest)) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-inset))',
        }}
      >
        {/* ambient light the door develops out of */}
        <div aria-hidden className="st-bloom" style={{
          position: 'absolute', top: '14%', left: '50%', width: 'min(120vw, 620px)', height: '46%',
          transform: 'translateX(-50%)', pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 62%)',
          mixBlendMode: 'soft-light',
        }} />

        <span style={{
          position: 'relative', fontFamily: 'var(--st-display)', fontWeight: 500, fontSize: 12,
          letterSpacing: '0.4em', paddingLeft: '0.4em', textTransform: 'uppercase', color: 'var(--st-ink-3)',
        }}>
          AUTOMODZ
        </span>

        <main className="st-overture-monument" style={{ position: 'relative', width: '100%', maxWidth: 460, padding: 'var(--st-rest) 0', textAlign: 'center' }}>
          <span className="st-chrome st-chrome-sweep" style={{
            display: 'block', fontFamily: 'var(--st-display)', fontWeight: 700,
            fontSize: 'clamp(40px, 13vw, 72px)', lineHeight: 0.98, letterSpacing: '-0.03em',
          }}>
            Your studio
          </span>
          <Body tone="ink-2" style={{ marginTop: 'var(--st-inset)', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Where your car lives — its care, its protection, its story.
          </Body>

          <div style={{ marginTop: 'var(--st-rest)', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            <Action variant="primary" onClick={handleGoogle} loading={loading}>
              Continue with Google
            </Action>
            {error
              ? <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }} aria-live="polite">{error}</Body>
              : <Whisper style={{ marginTop: 'var(--st-line)' }}>One tap — no password to remember.</Whisper>}
          </div>
        </main>

        <footer style={{ textAlign: 'center' }}>
          <Data tone="ink-3" as="p">{COMPANY.address}</Data>
          <div style={{ marginTop: 'var(--st-breath)' }}>
            <Link href="/" style={{
              fontFamily: 'var(--st-text)', fontWeight: 520, fontSize: 16,
              color: 'var(--st-ink-2)', textDecoration: 'none',
              display: 'inline-block', minHeight: 44, lineHeight: '44px',
            }}>
              Back to AutoModz
            </Link>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
