'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { linkEmployeeRole } from '@/lib/services/auth';
import { getUserProfile, stashReferralCode, resetPassword, ensureUserProfile, signInWithGoogle } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAuthLoading } = useAppStore();

  const [showPass, setShowPass]             = useState(false);
  const [loading, setLoading]               = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [form, setForm]                     = useState({ email: '', password: '' });

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Capture an incoming referral code (?ref=CODE) before sign-in
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) stashReferralCode(ref);
  }, []);

  // ── Google sign-in ─────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      const firebaseUser = result.user;
      let profile = await getUserProfile(firebaseUser.uid) ?? await ensureUserProfile(firebaseUser);

      if (!profile) {
        await signOut(auth);
        toast.error('Failed to create account. Please try again.');
        return;
      }

      profile = await linkEmployeeRole(profile);
      setUser(profile);

      if (profile.role === 'admin') {
        router.replace('/admin');
      } else if (profile.role === 'employee') {
        toast.success(`Welcome, ${profile.name.split(' ')[0]}!`);
        router.replace('/store');
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

  // ── Email/password sign-in - routes by role after auth ─────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      toast.error('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result  = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      let profile = await getUserProfile(result.user.uid);
      if (!profile) {
        profile = await ensureUserProfile(result.user);
      }

      if (!profile) {
        await signOut(auth);
        toast.error('Account not found. Contact support.');
        return;
      }

      profile = await linkEmployeeRole(profile);
      setUser(profile);

      if (profile.role === 'admin') {
        router.replace('/admin');
        return;
      }
      if (profile.role === 'employee') {
        toast.success(`Welcome, ${profile.name.split(' ')[0]}!`);
        router.replace('/store');
        return;
      }

      toast.success(`Welcome back, ${profile.name.split(' ')[0]}!`);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg: Record<string, string> = {
        'auth/user-not-found':     'No account found with this email.',
        'auth/wrong-password':     'Incorrect password.',
        'auth/invalid-email':      'Invalid email address.',
        'auth/too-many-requests':  'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      const authError = err as { code?: string };
      toast.error(msg[authError.code ?? ''] || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-mesh"
      style={{ overflowX: 'clip' }}>

      {/* Back to home */}
      <Link href="/"
        className="fixed top-5 left-5 z-20 inline-flex items-center gap-1.5 font-mono"
        style={{
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
        <div className="glass-strong rounded-3xl p-6">

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={field('email')}
                className="input mt-1.5"
                disabled={busy}
              />
            </div>

            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={field('password')}
                  className="input pr-12"
                  disabled={busy}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
                  style={{ color: 'var(--steel)' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={busy}
              className="btn-ember w-full rounded-xl py-3.5 mt-1">
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> SIGNING IN...</>
                : 'SIGN IN'}
            </motion.button>

            <button type="button"
              onClick={async () => {
                const email = form.email.trim();
                if (!email) { toast.error('Enter your email above first'); return; }
                try {
                  await resetPassword(email);
                  toast.success(`Reset link sent to ${email}`);
                } catch {
                  toast.error('Could not send reset email - check the address');
                }
              }}
              className="w-full text-center mt-3"
              style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'underline' }}>
              Forgot password?
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border-2)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--faint)' }}>OR</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-2)' }} />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogle}
            disabled={busy}
            className="w-full rounded-xl py-3.5 flex items-center justify-center gap-2 mb-3 transition-all"
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

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', textAlign: 'center', marginTop: '20px' }}>
          📍 Bhairavnath Rd, Maninagar, Ahmedabad
        </p>
      </motion.div>
    </div>
  );
}
