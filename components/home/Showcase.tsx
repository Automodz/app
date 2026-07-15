'use client';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import { STOCK } from '@/lib/stockImages';
import { Rise } from './Kinetic';

/**
 * Interactive proof. Let the visitor perform the reveal themselves — dragging
 * the correction into being converts far harder than any adjective. Uses the
 * shared BeforeAfterSlider. Placeholder pair; swap for a real studio job set.
 */
export default function Showcase() {
  return (
    <section className="relative max-w-[1240px] mx-auto px-5 sm:px-8 pb-[14vh]">
      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-16 items-center">
        <div>
          <Rise>
            <p className="font-mono mb-5" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
              THE DIFFERENCE
            </p>
          </Rise>
          <Rise delay={0.05}>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 4.4vw, 52px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em', color: 'var(--fg)', maxWidth: 440 }}>
              Drag it, and watch the depth return.
            </h2>
          </Rise>
          <Rise delay={0.1}>
            <p className="font-body mt-6" style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--muted)', maxWidth: 420 }}>
              Correction isn&apos;t a wash — it&apos;s optics. We flatten the paint
              until light stops scattering and starts reflecting.
            </p>
          </Rise>
        </div>

        <Rise delay={0.08}>
          <BeforeAfterSlider
            before={STOCK.coating}
            after={STOCK.ceramic}
            alt="Paint correction result"
            className="shadow-[var(--shadow-lg)]"
          />
        </Rise>
      </div>
    </section>
  );
}
