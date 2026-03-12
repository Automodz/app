'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Shield, Zap } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, updateUserProfile } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const DEMO_USER = {
  uid:         'demo-user-001',
  name:        'Demo Driver',
  email:       'demo@automodz.in',
  phone:       '+91 98765 43210',
  role:        'demo' as const,
  photoURL:    undefined,
  createdAt:   Timestamp.now(),
  memberSince: Timestamp.now(),
};

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAuthLoading } = useAppStore();

  const [tab, setTab]                       = useState<'user' | 'admin'>('user');
  const [showPass, setShowPass]             = useState(false);
  const [loading, setLoading]               = useState(false);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [form, setForm]                     = useState({ email: '', password: '' });

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // ── Google sign-in (works for both customers and admin) ───────────────
const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result       = await signInWithPopup(auth, new GoogleAuthProvider());
      const firebaseUser = result.user;
      const adminEmail   = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'hello.automodz@gmail.com').toLowerCase();
      const isAdminEmail = firebaseUser.email?.toLowerCase() === adminEmail;

      let profile = await getUserProfile(firebaseUser.uid);

      if (!profile) {
        // New user — must use setDoc (updateDoc fails on non-existent documents)
        const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const newProfile = {
          uid:       firebaseUser.uid,
          name:      firebaseUser.displayName || 'Driver',
          email:     firebaseUser.email || '',
          phone:     firebaseUser.phoneNumber || '',
          photoURL:  firebaseUser.photoURL || '',
          role:      (isAdminEmail ? 'admin' : 'customer') as 'admin' | 'customer',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
        profile = await getUserProfile(firebaseUser.uid);
      }

      if (!profile) {
        await signOut(auth);
        toast.error('Failed to create account. Please try again.');
        return;
      }

      setUser(profile);

      if (profile.role === 'admin') {
        toast.success('Admin access granted.');
        router.replace('/admin');
      } else {
        toast.success(`Welcome back, ${profile.name.split(' ')[0]}!`);
        router.replace('/dashboard');
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email/password sign-in ─────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      toast.error('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result  = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      const profile = await getUserProfile(result.user.uid);

      if (!profile) {
        await signOut(auth);
        toast.error('Account not found. Contact support.');
        return;
      }

      // ── Admin role verification ────────────────────────────────────────
      if (tab === 'admin') {
        if (profile.role !== 'admin') {
          await signOut(auth);
          toast.error('Access denied. Not an admin account.');
          return;
        }
        setUser(profile);
        toast.success('Admin access granted.');
        router.replace('/admin');
        return;
      }

      // Regular user — block admins from user dashboard
      if (profile.role === 'admin') {
        await signOut(auth);
        toast.error('Use the Admin tab to sign in.');
        return;
      }

      setUser(profile);
      toast.success(`Welcome back, ${profile.name.split(' ')[0]}!`);
      router.replace('/dashboard');
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found':     'No account found with this email.',
        'auth/wrong-password':     'Incorrect password.',
        'auth/invalid-email':      'Invalid email address.',
        'auth/too-many-requests':  'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      toast.error(msg[err.code] || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Demo login ─────────────────────────────────────────────────────────
  const handleDemo = () => {
    sessionStorage.setItem('demo-user', JSON.stringify(DEMO_USER));
    setUser(DEMO_USER);
    setAuthLoading(false);
    toast.success('Demo mode activated!');
    router.replace('/dashboard');
  };

  const busy = loading || googleLoading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg-hero)' }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="plasma-orb w-96 h-96 -top-24 -left-24 animate-breathe"
          style={{ background: 'rgba(255,69,0,0.06)' }} />
        <div className="plasma-orb w-80 h-80 -bottom-16 -right-16 animate-breathe"
          style={{ background: 'rgba(255,69,0,0.04)', animationDelay: '1.5s' }} />
        <div className="absolute inset-0 bg-grid opacity-[0.02]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 animate-ember-pulse"
            style={{ background: 'linear-gradient(135deg, #FF4500, #FF6622)', boxShadow: '0 8px 32px rgba(255,69,0,0.4)' }}>
            <span style={{ fontSize: '28px' }}>⚡</span>
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
            AUTOMODZ
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            Premium Car Detailing Studio
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-2)', backdropFilter: 'blur(24px)' }}>

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden mb-6"
            style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
            {(['user', 'admin'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background:    tab === t ? 'var(--ember)' : 'transparent',
                  fontFamily:    'var(--font-mono)',
                  fontSize:      '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         tab === t ? 'white' : 'var(--steel)',
                  fontWeight:    tab === t ? 700 : 400,
                  boxShadow:     tab === t ? '0 2px 12px rgba(255,69,0,0.3)' : 'none',
                }}>
                {t === 'admin' ? <Shield size={11} /> : <Zap size={11} />}
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder={tab === 'admin' ? 'admin@automodz.in' : 'you@example.com'}
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
                : tab === 'admin' ? 'ADMIN SIGN IN' : 'SIGN IN'}
            </motion.button>
          </form>

          {/* Google sign-in — shown on both tabs. Demo only on user tab. */}
          <AnimatePresence>
            <motion.div
              key={tab}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">

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
                {tab === 'admin' ? 'SIGN IN WITH GOOGLE' : 'CONTINUE WITH GOOGLE'}
              </motion.button>

              {tab === 'user' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDemo}
                  disabled={busy}
                  className="w-full rounded-xl py-3 flex items-center justify-center gap-2 transition-all"
                  style={{
                    background:    'rgba(255,69,0,0.06)',
                    border:        '1px solid rgba(255,69,0,0.15)',
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '10px',
                    letterSpacing: '0.14em',
                    color:         'var(--ember)',
                  }}>
                  <Zap size={12} />
                  EXPLORE DEMO
                </motion.button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', textAlign: 'center', marginTop: '20px' }}>
          📍 Bhairavnath Rd, Maninagar, Ahmedabad
        </p>
      </motion.div>
    </div>
  );
}