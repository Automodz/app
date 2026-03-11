'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Shield, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { signInWithGoogle, adminLogin, signInDemo } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';

const Particle = ({ delay, x, size }: { delay: number; x: string; size: number }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{ width: size, height: size, left: x, bottom: '-10px',
      background: `radial-gradient(circle, rgba(255,107,0,0.7) 0%, rgba(255,69,0,0.2) 60%, transparent 100%)` }}
    animate={{ y: [0, -700], opacity: [0, 0.8, 0.6, 0], scale: [0.3, 1, 0.8, 0] }}
    transition={{ duration: 6 + Math.random() * 4, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading]     = useState(false);
  const [showAdmin, setShowAdmin]         = useState(false);
  const [adminEmail, setAdminEmail]       = useState('hello.automodz@gmail.com');
  const [adminPwd, setAdminPwd]           = useState('');
  const [showPwd, setShowPwd]             = useState(false);
  const [adminLoading, setAdminLoading]   = useState(false);
  const [mounted, setMounted]             = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
  const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome to AutoModz!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed') && !msg.includes('cancelled-popup-request'))
        toast.error('Sign in failed. Try again.');
    } finally { setGoogleLoading(false); }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const demoUser = await signInDemo();
      sessionStorage.setItem('demo-user', JSON.stringify(demoUser));
      setUser(demoUser);
      toast.success('Demo loaded — explore freely!');
      router.push('/dashboard');
    } catch { toast.error('Demo failed'); }
    finally { setDemoLoading(false); }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPwd) return;
    setAdminLoading(true);
    try {
      await adminLogin(adminEmail, adminPwd);
      toast.success('Admin access granted');
      router.push('/admin');
    } catch { toast.error('Invalid credentials'); }
    finally { setAdminLoading(false); }
  };

  const particles = mounted ? [
    { delay: 0, x: '10%', size: 4 }, { delay: 1.5, x: '25%', size: 3 },
    { delay: 0.8, x: '40%', size: 5 }, { delay: 2.2, x: '55%', size: 3 },
    { delay: 0.4, x: '70%', size: 4 }, { delay: 1.8, x: '85%', size: 3 },
    { delay: 3.0, x: '15%', size: 6 }, { delay: 2.6, x: '60%', size: 4 },
    { delay: 1.2, x: '90%', size: 3 }, { delay: 0.2, x: '45%', size: 5 },
  ] : [];

  return (
    <div className="min-h-screen bg-hero overflow-hidden relative flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      {mounted && (
        <motion.div
          className="absolute inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,107,0,0.45), transparent)' }}
          animate={{ y: ['-100vh', '100vh'] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {particles.map((p, i) => <Particle key={i} {...p} />)}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,69,0,0.12) 0%, transparent 70%)', filter: 'blur(48px)' }} />
      <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
        ref={cardRef} onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
      >
        {/* Logo */}
        <motion.div className="text-center mb-8" initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
          <motion.div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #FF4500, #FF7A35)', boxShadow: '0 8px 48px rgba(255,69,0,0.50), inset 0 1px 0 rgba(255,255,255,0.20)' }}
            whileHover={{ scale:1.07, rotate:3 }} transition={{ type:'spring', stiffness:300 }}
          >
            <span className="font-display font-800 text-4xl text-white">A</span>
          </motion.div>
          <h1 className="font-display font-800 text-4xl text-white tracking-wide">AUTOMODZ</h1>
          <p className="font-body text-sm mt-1.5" style={{ color:'var(--muted)' }}>Premium Car Detailing · Maninagar, Ahmedabad</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showAdmin ? (
            <motion.div key="customer"
              initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-24 }} transition={{ duration:0.25 }}
              style={{ perspective: 1200 }}
            >
              <motion.div
                className="rounded-3xl overflow-hidden"
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(48px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                  border: '1px solid var(--border-2)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                  rotateX, rotateY,
                }}
              >
                <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,107,0,0.6), transparent)' }} />
                <div className="p-7">
                  <h2 className="font-display font-800 text-2xl text-white tracking-wide mb-1">SIGN IN</h2>
                  <p className="font-body text-sm mb-7" style={{ color:'var(--muted)' }}>Book, track and manage your services</p>

                  <motion.button onClick={handleGoogle} disabled={googleLoading||demoLoading} whileTap={{ scale:0.97 }}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 mb-3 font-body font-600 text-sm transition-all"
                    style={{ background:'var(--bg-4)', border:'1px solid var(--border-2)', color:'var(--fg)', boxShadow:'0 2px 16px rgba(0,0,0,0.3)' }}>
                    {googleLoading
                      ? <Loader2 size={18} className="animate-spin" style={{ color:'var(--plasma-hi)' }}/>
                      : <svg width="18" height="18" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>}
                    {googleLoading ? 'Signing in...' : 'Continue with Google'}
                  </motion.button>

                  <motion.button onClick={handleDemo} disabled={googleLoading||demoLoading} whileTap={{ scale:0.97 }}
                    className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 font-body font-600 text-sm relative overflow-hidden"
                    style={{ background:'rgba(255,69,0,0.08)', border:'1px solid rgba(255,107,0,0.25)', color:'var(--plasma-hi)' }}>
                    {demoLoading ? <Loader2 size={18} className="animate-spin"/> : <Zap size={16} fill="currentColor"/>}
                    {demoLoading ? 'Loading demo...' : 'Try Demo Account'}
                  </motion.button>

                  <p className="text-center font-body text-xs mt-4" style={{ color:'var(--muted)', opacity:0.55 }}>
                    Demo · No sign-up · 4 vehicles · 8 bookings pre-loaded
                  </p>
                  <div className="mt-6 pt-5" style={{ borderTop:'1px solid var(--border)' }}>
                    <button onClick={() => setShowAdmin(true)}
                      className="w-full flex items-center justify-center gap-2 font-body text-xs"
                      style={{ color:'var(--muted)' }}>
                      <Shield size={11}/> Staff / Admin portal
                    </button>
                  </div>
                </div>
                <div className="h-px" style={{ background:'linear-gradient(90deg, transparent, rgba(255,107,0,0.3), transparent)' }} />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="admin"
              initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-24 }} transition={{ duration:0.25 }}>
              <div className="rounded-3xl overflow-hidden"
                style={{ background:'var(--glass-bg)', backdropFilter:'blur(48px)', WebkitBackdropFilter:'blur(48px)', border:'1px solid var(--border-2)', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
                <div className="h-px" style={{ background:'linear-gradient(90deg, transparent, rgba(255,69,0,0.5), transparent)' }} />
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{ background:'rgba(255,69,0,0.12)', border:'1px solid rgba(255,107,0,0.25)' }}>
                      <Shield size={18} style={{ color:'var(--plasma-hi)' }}/>
                    </div>
                    <div>
                      <h2 className="font-display font-800 text-lg text-white tracking-wide">ADMIN PORTAL</h2>
                      <p className="font-body text-xs" style={{ color:'var(--muted)' }}>hello.automodz@gmail.com</p>
                    </div>
                  </div>
                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                      placeholder="Admin email" className="input" required/>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} value={adminPwd}
                        onChange={e => setAdminPwd(e.target.value)} placeholder="Password" className="input pr-12" required/>
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color:'var(--muted)' }}>
                        {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>
                    <motion.button type="submit" disabled={adminLoading} whileTap={{ scale:0.97 }}
                      className="btn btn-primary w-full py-3.5 text-sm rounded-2xl">
                      {adminLoading ? <Loader2 size={16} className="animate-spin"/> : 'ACCESS ADMIN'}
                    </motion.button>
                  </form>
                  <button onClick={() => setShowAdmin(false)}
                    className="w-full text-center font-body text-xs mt-5" style={{ color:'var(--muted)' }}>
                    ← Back to customer sign in
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
