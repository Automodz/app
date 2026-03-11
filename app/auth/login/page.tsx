'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, Zap, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, createUserProfile } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const DEMO_USER = {
  uid:         'demo-user-001',
  name:        'Demo Driver',
  email:       'demo@automodz.com',
  phone:       '+91 98765 43210',
  role:        'demo' as const,
  photoURL:    null,
  createdAt:   new Date().toISOString(),
  memberSince: new Date().toISOString(),
};

export default function LoginPage() {
  const router   = useRouter();
  const setUser  = useAppStore(s => s.setUser);

  const [mode, setMode]           = useState<'user' | 'admin'>('user');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  // ── Google sign-in (regular users) ───────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result  = await signInWithPopup(auth, new GoogleAuthProvider());
      const fbUser  = result.user;
      let profile   = await getUserProfile(fbUser.uid);

      if (!profile) {
        profile = await createUserProfile({
          uid:      fbUser.uid,
          name:     fbUser.displayName || 'Driver',
          email:    fbUser.email || '',
          phone:    fbUser.phoneNumber || '',
          photoURL: fbUser.photoURL || null,
          role:     fbUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ? 'admin' : 'user',
        });
      }

      setUser(profile);
      router.replace(profile.role === 'admin' ? '/dashboard/admin' : '/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Admin email/password login ────────────────────────────────────────
  const handleAdminLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = result.user;

      // Verify Firestore role BEFORE granting access
      const profile = await getUserProfile(fbUser.uid);

      if (!profile || profile.role !== 'admin') {
        // Not an admin — sign out immediately and reject
        await signOut(auth);
        toast.error('Access denied. Admin credentials required.');
        return;
      }

      setUser(profile);
      toast.success('Welcome back, Admin');
      router.replace('/dashboard/admin');
    } catch (err: any) {
      // Map Firebase error codes to readable messages
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Try again later.');
      } else {
        toast.error(err?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Demo mode ─────────────────────────────────────────────────────────
  const handleDemo = () => {
    sessionStorage.setItem('demo-user', JSON.stringify(DEMO_USER));
    setUser(DEMO_USER);
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-nebula bg-hex">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="plasma-orb w-96 h-96 -top-32 -left-32 animate-breathe"
          style={{ background: 'rgba(255,69,0,0.06)' }} />
        <div className="plasma-orb w-80 h-80 -bottom-24 -right-24 animate-breathe"
          style={{ background: 'rgba(255,69,0,0.04)', animationDelay: '1.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 animate-ember-pulse"
            style={{ background: 'linear-gradient(135deg, rgba(255,69,0,0.15), rgba(255,69,0,0.05))', border: '1px solid rgba(255,69,0,0.25)' }}
          >
            <span style={{ fontSize: '36px' }}>🔥</span>
          </motion.div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--chrome)', letterSpacing: '0.08em' }}>
            AUTOMODZ
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', color: 'var(--faint)', marginTop: '4px' }}>
            PREMIUM DETAILING STUDIO
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
          {(['user', 'admin'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              style={{
                background:    mode === m ? 'var(--ember)' : 'transparent',
                boxShadow:     mode === m ? '0 2px 12px rgba(255,69,0,0.35)' : 'none',
                fontFamily:    'var(--font-mono)',
                fontSize:      '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         mode === m ? 'white' : 'var(--steel)',
              }}>
              {m === 'admin' ? <Shield size={11} /> : <Zap size={11} />}
              {m}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-3xl p-6" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-2)', backdropFilter: 'blur(24px)' }}>
          <AnimatePresence mode="wait">

            {/* User mode — Google */}
            {mode === 'user' && (
              <motion.div key="user"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-3">
                <div className="text-center mb-4">
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', color: 'var(--chrome)' }}>
                    Welcome Back
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                    Sign in to manage your bookings
                  </p>
                </div>

                <button onClick={handleGoogle} disabled={loading}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all"
                  style={{
                    background: 'var(--dark)',
                    border:     '1px solid var(--border-2)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize:   '13px',
                    letterSpacing: '0.06em',
                    color:      loading ? 'var(--faint)' : 'var(--chrome)',
                  }}>
                  {loading
                    ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ember)' }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>}
                  {loading ? 'SIGNING IN...' : 'CONTINUE WITH GOOGLE'}
                </button>

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--faint)', letterSpacing: '0.12em' }}>OR</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>

                <button onClick={handleDemo} disabled={loading}
                  className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"
                  style={{
                    background:    'rgba(255,69,0,0.07)',
                    border:        '1px solid rgba(255,69,0,0.18)',
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '10px',
                    letterSpacing: '0.14em',
                    color:         'var(--ember)',
                  }}>
                  <Zap size={12} />
                  TRY DEMO MODE
                </button>
              </motion.div>
            )}

            {/* Admin mode — email/password */}
            {mode === 'admin' && (
              <motion.div key="admin"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                className="space-y-3">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl mb-3"
                    style={{ background: 'rgba(255,69,0,0.10)', border: '1px solid rgba(255,69,0,0.20)' }}>
                    <Shield size={18} style={{ color: 'var(--ember)' }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', color: 'var(--chrome)' }}>
                    Admin Access
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                    Restricted to authorised personnel
                  </p>
                </div>

                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: '6px' }}>
                    EMAIL
                  </p>
                  <input
                    type="email"
                    placeholder="admin@automodz.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                    className="input"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: '6px' }}>
                    PASSWORD
                  </p>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                      className="input pr-12"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--steel)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button onClick={handleAdminLogin} disabled={loading || !email || !password}
                  className="btn-ember w-full rounded-xl py-4 flex items-center justify-center gap-2 mt-2">
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> VERIFYING...</>
                    : <><span>ACCESS PANEL</span><ChevronRight size={16} /></>}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
          By signing in you agree to our terms of service.
          <br />Your data is stored securely with Firebase.
        </p>
      </motion.div>
    </div>
  );
}