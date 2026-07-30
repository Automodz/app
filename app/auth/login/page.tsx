'use client';
/**
 * The door.
 *
 * Shared by both applications: a customer signs in here and lands in the
 * garage; staff sign in here and land in the studio OS. `app/admin/layout.tsx`
 * redirects every unauthenticated visitor to this route, so it must keep
 * working for admin to be usable at all.
 *
 * The AUTH LOGIC below is unchanged from the previous implementation - Google
 * sign-in, profile bootstrap, employee-role linking, referral capture, and the
 * safe-redirect rule. Only the presentation was removed with the rest of the
 * customer UI. It is deliberately unstyled: the rebuild will dress it.
 */
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { claimReferral } from '@/lib/services/referrals';
import { useAppStore } from '@/lib/store';

/** Only ever return to an internal path - never an attacker's URL. */
const safeDest = (redirect: string | null): string | null =>
  redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : null;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
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
    <main>
      <h1>AutoModz</h1>
      <button type="button" onClick={handleGoogle} disabled={loading}>
        {loading ? 'Signing in…' : 'Continue with Google'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
