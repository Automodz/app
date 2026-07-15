'use client';
import { useRouter } from 'next/navigation';
import { MaskLines, Rise } from './Kinetic';
import SlideToAction from '@/components/ui/SlideToAction';

/**
 * The ask. A single centred statement and the signature slide-to-book control
 * — a deliberate, tactile commitment that outperforms a flat button on intent.
 * Keyboard-accessible via the underlying control; a plain link backs it up.
 */
export default function BookCTA() {
  const router = useRouter();
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
      {/* faint studio wash */}
      <div aria-hidden className="absolute inset-0 bg-mesh opacity-70" />
      <div className="relative max-w-[1240px] mx-auto px-5 sm:px-8 py-[18vh] text-center">
        <Rise>
          <p className="font-mono mb-8" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
            [ 05 ] — BOOK
          </p>
        </Rise>

        <h2 className="font-hero mx-auto" style={{ fontSize: 'clamp(34px, 7vw, 84px)', fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.03em', color: 'var(--fg)', maxWidth: 900 }}>
          <MaskLines
            lines={[
              <>Give your car the</>,
              <span key="e" className="text-ember">studio treatment.</span>,
            ]}
          />
        </h2>

        <Rise delay={0.15}>
          <div className="mt-12 mx-auto" style={{ maxWidth: 380 }}>
            <SlideToAction label="Slide to book" onComplete={() => router.push('/auth/login')} />
            <button
              onClick={() => router.push('/auth/login')}
              className="font-mono mt-5 mx-auto block transition-colors hover:text-[var(--fg)]"
              style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)' }}
            >
              OR OPEN THE BOOKING APP →
            </button>
          </div>
        </Rise>
      </div>
    </section>
  );
}
