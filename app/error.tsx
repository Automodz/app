'use client';
import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';

/** Branded crash screen - recoverable, never a stack trace in the user's face. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center safe-page"
      style={{ background: '#08090b', paddingBottom: 'max(var(--sab), 24px)' }}>
      <Wordmark height={22} variant="white" />
      <p className="font-mono mt-8" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)' }}>
        SOMETHING WENT WRONG
      </p>
      <h1 className="font-hero mt-3" style={{ fontSize: 'clamp(28px, 7vw, 44px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
        A hiccup, not a crash.
      </h1>
      <p className="font-body mt-3 max-w-xs" style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
        Give it another try - your data is safe.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <button onClick={reset}
          className="inline-flex items-center justify-center px-7 rounded-2xl font-display tap-target"
          style={{ minHeight: 48, fontSize: 14.5, fontWeight: 700, background: '#fff', color: '#0b0c0e' }}>
          Try again
        </button>
        <Link href="/"
          className="inline-flex items-center justify-center px-6 rounded-2xl font-display tap-target"
          style={{ minHeight: 48, fontSize: 14.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.16)' }}>
          Home
        </Link>
      </div>
    </div>
  );
}
