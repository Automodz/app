'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  // const { user, authLoading } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // If already logged in, send to dashboard
  //useEffect(() => {
  //  if (!authLoading && user) {
  //    router.replace('/dashboard');
  //  }
  //}, [user, authLoading, router]);

  // Particle ember effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      alpha: number; size: number; decay: number;
    }[] = [];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(Math.random() * 1.2 + 0.4),
        alpha: Math.random() * 0.6 + 0.1,
        size: Math.random() * 2.5 + 0.5,
        decay: Math.random() * 0.004 + 0.002,
      });
    }

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0 || p.y < -10) {
          particles[i] = {
            x: Math.random() * canvas.width,
            y: canvas.height + 10,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -(Math.random() * 1.2 + 0.4),
            alpha: Math.random() * 0.5 + 0.1,
            size: Math.random() * 2.5 + 0.5,
            decay: Math.random() * 0.004 + 0.002,
          };
          return;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${69 + Math.floor(Math.random() * 40)}, 0, ${p.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  const stagger = {
    container: { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } },
    item: { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } },
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--void, #05050a)' }}>

      {/* Ember particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      {/* Radial glow behind logo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,69,0,0.18) 0%, transparent 70%)',
          zIndex: 1,
        }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4">
        <div className="flex items-center gap-2">
          {/* Wordmark */}
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#fff',
          }}>
            AUTO<span style={{ color: 'var(--ember, #FF4500)' }}>MODZ</span>
          </span>
        </div>
        <Link href="/auth/login">
          <motion.button
            whileTap={{ scale: 0.94 }}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: 'var(--ember, #FF4500)',
              border: '1px solid rgba(255,69,0,0.35)',
              borderRadius: '8px',
              padding: '8px 16px',
              background: 'rgba(255,69,0,0.06)',
            }}>
            SIGN IN
          </motion.button>
        </Link>
      </header>

      {/* Hero */}
      <motion.main
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center"
        style={{ paddingBottom: '120px' }}>

        {/* Badge */}
        <motion.div variants={stagger.item}
          className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full"
          style={{
            background: 'rgba(255,69,0,0.08)',
            border: '1px solid rgba(255,69,0,0.2)',
          }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--ember, #FF4500)' }} />
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: 'var(--ember, #FF4500)',
          }}>
            PREMIUM AUTO DETAILING
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={stagger.item}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'clamp(38px, 10vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: '-0.02em',
            color: '#fff',
            marginBottom: '20px',
          }}>
          YOUR CAR.<br />
          <span style={{ color: 'var(--ember, #FF4500)' }}>PERFECTED.</span>
        </motion.h1>

        {/* Subline */}
        <motion.p variants={stagger.item}
          style={{
            fontFamily: 'var(--font-body, sans-serif)',
            fontSize: '15px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: '300px',
            marginBottom: '44px',
          }}>
          Book detailing, track your garage, and manage memberships — all in one place.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={stagger.item} className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/auth/login" className="w-full">
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="w-full py-4 rounded-2xl text-white font-semibold"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '13px',
                letterSpacing: '0.1em',
                background: 'linear-gradient(135deg, #FF4500, #FF6622)',
                boxShadow: '0 8px 32px rgba(255,69,0,0.40), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}>
              BOOK NOW
            </motion.button>
          </Link>

          <Link href="/auth/login?demo=1" className="w-full">
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="w-full py-4 rounded-2xl"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '13px',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
              }}>
              VIEW DEMO
            </motion.button>
          </Link>
        </motion.div>
      </motion.main>

      {/* Feature strip at bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.6 }}
        className="relative z-10 flex justify-around px-6 pb-12"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { num: '5min', label: 'BOOKING' },
          { num: '24/7', label: 'TRACKING' },
          { num: '100%', label: 'SATISFACTION' },
        ].map(({ num, label }) => (
          <div key={label} className="flex flex-col items-center pt-6 gap-1">
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
            }}>{num}</span>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '9px',
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.3)',
            }}>{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
