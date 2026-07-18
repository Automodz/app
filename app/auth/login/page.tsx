'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';
import toast from 'react-hot-toast';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();

  const [googleLoading, setGoogleLoading] = useState(false);

  // Capture an incoming referral code (?ref=CODE) before sign-in
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) stashReferralCode(ref);
  }, []);

  // ── Google sign-in - the only way in ──────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      const firebaseUser = result.user;
      let profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);

      if (!profile) {
        await signOut(auth);
        toast.error('Could not sign you in. Please try again.');
        return;
      }

      profile = await linkEmployeeRole(profile);
      setUser(profile);

      if (profile.role === 'admin') {
        router.replace('/admin');
      } else if (profile.role === 'employee') {
        toast.success(`Welcome, ${profile.name.split(' ')[0]}!`);
        router.replace('/admin');
      } else {
        toast.success(`Welcome back, ${profile.name.split(' ')[0]}!`);
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const authError = err as { code?: string };
      if (authError.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-mesh safe-page"
      style={{ overflowX: 'clip', paddingBottom: 'max(var(--sab), 48px)' }}>

      {/* Back to home */}
      <Link href="/"
        className="fixed z-20 inline-flex items-center gap-1.5 font-mono tap-target"
        style={{
          top: 'calc(var(--sat) + 16px)', left: 'calc(var(--sal) + 16px)',
          fontSize: 11, letterSpacing: '0.08em', color: 'var(--fg-dim)',
          border: '1px solid var(--border-2)', borderRadius: 10,
          padding: '8px 14px', background: 'var(--glass)', backdropFilter: 'blur(12px)',
        }}>
        <ArrowLeft size={14} /> HOME
      </Link>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="plasma-orb w-96 h-96 -top-24 -left-24 animate-breathe"
          style={{ background: 'var(--accent-mist)' }} />
        <div className="plasma-orb w-80 h-80 -bottom-16 -right-16 animate-breathe"
          style={{ background: 'var(--ember-trace)', animationDelay: '1.5s' }} />
        <div className="absolute inset-0 bg-grid opacity-[0.02]" />
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-col items-center text-center mb-8">
          <Wordmark height={30} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '14px' }}>
            Premium Car Detailing Studio
          </p>
        </motion.div>

        {/* Card */}
        <div className="glass-strong rounded-3xl p-6 text-center">
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '19px', color: 'var(--fg)' }}>
            Sign in
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', lineHeight: 1.6, color: 'var(--muted)', marginTop: '8px', marginBottom: '22px' }}>
            One tap with Google - no passwords to remember.
          </p>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all"
            style={{
              background:    'var(--dark)',
              border:        '1px solid var(--border-2)',
              fontFamily:    'var(--font-display)',
              fontWeight:    600,
              fontSize:      '13px',
              letterSpacing: '0.06em',
              color:         'var(--fg-dim)',
            }}>
            {googleLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>}
            CONTINUE WITH GOOGLE
          </motion.button>
        </div>

        <p className="inline-flex items-center justify-center gap-1.5 w-full" style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', textAlign: 'center', marginTop: '20px' }}>
          <MapPin size={12} /> Bhairavnath Rd, Maninagar, Ahmedabad
        </p>
      </motion.div>
    </div>
  );
}
