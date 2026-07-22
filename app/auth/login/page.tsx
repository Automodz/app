'use client';
/**
 * The door (Studio White).
 *
 * The first frame of the customer product, so it renders in the customer's
 * own language: paper, the text primitives, the one Action, one sentence of
 * welcome. Authentication itself is unchanged - only the experience around it.
 */
import { useState, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { COMPANY } from '@/lib/company';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import Action from '@/components/os/Action';
import { Display, Body, Data, Whisper } from '@/components/os/text';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Capture an incoming referral code (?ref=CODE) before sign-in
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) stashReferralCode(ref);
  }, []);

  // ── Google sign-in - the only way in ──────────────────────────────────
  const handleGoogle = async () => {
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

      if (profile.role === 'admin' || profile.role === 'employee') {
        router.replace('/admin');
      } else {
        router.replace('/app');
      }
    } catch (err: unknown) {
      const authError = err as { code?: string };
      if (authError.code !== 'auth/popup-closed-by-user') {
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
          minHeight: '100vh', background: 'var(--st-paper)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'space-between', overflowX: 'clip',
          padding: 'calc(env(safe-area-inset-top) + var(--st-rest)) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-inset))',
        }}
      >
        <Whisper tone="ink-2" style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>
          AUTOMODZ
        </Whisper>

        <main style={{ width: '100%', maxWidth: 420, padding: 'var(--st-rest) 0' }}>
          <Display style={{ fontSize: 'clamp(26px, 7vw, 32px)' }}>Welcome to the studio.</Display>
          <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }}>
            This is where your car lives - its care, its protection, its story.
          </Body>

          <div style={{ marginTop: 'var(--st-rest)' }}>
            <Action variant="primary" onClick={handleGoogle} loading={loading}>
              Continue with Google
            </Action>
            {error
              ? <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }} aria-live="polite">{error}</Body>
              : <Whisper style={{ marginTop: 'var(--st-line)' }}>One tap - no password to remember.</Whisper>}
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
