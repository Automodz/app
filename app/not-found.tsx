import Link from 'next/link';
import Wordmark from '@/components/ui/Wordmark';

/** Branded 404 — a dead link should never be a dead end. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center safe-page"
      style={{ background: '#08090b', paddingBottom: 'max(var(--sab), 24px)' }}>
      <Wordmark height={22} variant="white" />
      <p className="font-mono mt-8" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)' }}>
        404 · PAGE NOT FOUND
      </p>
      <h1 className="font-hero mt-3" style={{ fontSize: 'clamp(28px, 7vw, 44px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
        Wrong turn.
      </h1>
      <p className="font-body mt-3 max-w-xs" style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
        This page doesn&apos;t exist — but the studio does.
      </p>
      <Link href="/"
        className="mt-8 inline-flex items-center justify-center px-7 rounded-2xl font-display tap-target"
        style={{ minHeight: 48, fontSize: 14.5, fontWeight: 700, background: '#fff', color: '#0b0c0e' }}>
        Back to AutoModz
      </Link>
    </div>
  );
}
