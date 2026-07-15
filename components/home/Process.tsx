'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRM } from './useRM';
import { Rise } from './Kinetic';

const STAGES = [
  { k: 'Intake', d: 'Every panel is inspected under calibrated light and photographed. Nothing starts before you approve the scope.' },
  { k: 'Correction', d: 'Swirls and defects are machine-polished out in stages until the paint reads glass-flat.' },
  { k: 'Protection', d: 'PPF or ceramic is applied in a filtered bay — cured, measured, and logged.' },
  { k: 'Reveal', d: 'Final inspection, a full photo set, and your car handed back deeper than delivery day.' },
];

/**
 * The Process. A vertical rail that fills to your scroll position while the
 * four stages resolve in sequence — mirroring the live, photographed pipeline
 * customers watch from the app. The fill is a single GPU scaleY spring; each
 * stage is content-first. Under reduced motion the rail is simply full.
 */
export default function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRM();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 65%', 'end 60%'] });
  const fill = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <section className="relative" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-[14vh]">
        <div className="mb-16">
          <Rise>
            <p className="font-mono mb-4" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
              [ 03 ] — THE PROCESS
            </p>
          </Rise>
          <Rise delay={0.05}>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--fg)', maxWidth: 680 }}>
              Four stages. Watched live, from your phone.
            </h2>
          </Rise>
        </div>

        <div ref={ref} className="relative pl-10 sm:pl-16">
          {/* rail track */}
          <div className="absolute left-[10px] sm:left-4 top-2 bottom-2 w-px" style={{ background: 'var(--border-2)' }}>
            {/* rail fill */}
            <motion.div
              className="absolute top-0 left-0 w-full origin-top"
              style={{ height: '100%', background: 'var(--accent)', scaleY: reduced ? 1 : fill }}
            />
          </div>

          <div className="space-y-14 sm:space-y-20">
            {STAGES.map((s, i) => (
              <Rise key={s.k} delay={0.04 * i}>
                <div className="relative">
                  {/* node */}
                  <span
                    className="absolute -left-[38px] sm:-left-[54px] top-1.5 flex items-center justify-center w-[18px] h-[18px] rounded-full"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border-strong)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  </span>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono" style={{ fontSize: 12, color: 'var(--faint)' }}>0{i + 1}</span>
                    <h3 className="font-display" style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
                      {s.k}
                    </h3>
                  </div>
                  <p className="font-body mt-3 pl-8" style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--muted)', maxWidth: 520 }}>
                    {s.d}
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
