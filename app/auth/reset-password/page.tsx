'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { resetPassword } from '@/lib/firebaseService';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch { toast.error('Email not found. Please check and try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center px-4 relative overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-sm">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors text-sm font-body mb-8">
          <ArrowLeft size={16} /> Back to Login
        </Link>
        <div className="glass rounded-3xl p-8 orange-border-glow">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 size={48} className="text-orange-500 mx-auto mb-4" />
              <h2 className="font-display font-900 text-2xl text-foreground tracking-wide mb-2">CHECK YOUR EMAIL</h2>
              <p className="text-muted text-sm font-body mb-6">We sent a password reset link to<br /><strong className="text-foreground">{email}</strong></p>
              <Link href="/auth/login" className="btn-primary w-full flex items-center justify-center font-display font-800 tracking-widest text-sm">BACK TO LOGIN</Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="font-display font-900 text-2xl gradient-text">A</span>
                </div>
                <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">RESET PASSWORD</h1>
                <p className="text-muted text-sm font-body mt-2">Enter your email to receive a reset link</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="text-xs text-muted font-body tracking-widest uppercase mb-2 block">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" className="input-dark" required />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 font-display font-800 text-sm tracking-widest">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'SEND RESET LINK'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
