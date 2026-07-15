'use client';
import Image from 'next/image';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRM } from './useRM';
import { ArrowUpRight } from 'lucide-react';
import { SERVICE_SHOWCASE } from '@/lib/stockImages';
import { formatCurrency } from '@/lib/utils';
import { Rise } from './Kinetic';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function ParallaxImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRM();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-9%', '9%']);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div className="absolute inset-[-10%_0]" style={{ y: reduced ? 0 : y }}>
        <Image src={src} alt={alt} fill priority={priority} sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
      </motion.div>
    </div>
  );
}

/**
 * The Craft. Four disciplines as alternating editorial rows — an oversized
 * photographic panel married to a typographic panel. The image drifts under
 * parallax; hovering draws a chrome underline under the name and slides the
 * booking arrow. `prices` overrides the static "from" with the live Firestore
 * minimum per category; it falls back gracefully so a row is never empty.
 */
export default function CraftGallery({ prices }: { prices: Record<string, number> }) {
  const router = useRouter();

  return (
    <section id="craft" className="relative max-w-[1240px] mx-auto px-5 sm:px-8 pb-[10vh]">
      <div className="mb-14 sm:mb-20">
        <Rise>
          <p className="font-mono mb-4" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
            [ 02 ] — THE CRAFT
          </p>
        </Rise>
        <Rise delay={0.05}>
          <h2 className="font-display" style={{ fontSize: 'clamp(30px, 5.4vw, 60px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em', color: 'var(--fg)', maxWidth: 760 }}>
            Four disciplines. One obsession with the surface.
          </h2>
        </Rise>
      </div>

      <div className="space-y-6 sm:space-y-9">
        {SERVICE_SHOWCASE.map((s, i) => {
          const from = prices[s.cat] ?? s.from;
          const flip = i % 2 === 1;
          return (
            <motion.article
              key={s.cat}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-12% 0px' }}
              transition={{ duration: 0.85, ease: EASE }}
              onClick={() => router.push('/auth/login')}
              className="group grid md:grid-cols-2 rounded-[26px] overflow-hidden cursor-pointer"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {/* photographic panel */}
              <div
                className={`relative h-[280px] sm:h-[360px] md:h-[440px] overflow-hidden ${flip ? 'md:order-2' : ''}`}
              >
                <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]">
                  <ParallaxImage src={s.img} alt={`${s.name} — ${s.line}`} priority={i === 0} />
                </div>
                <span
                  className="absolute top-5 left-5 font-hero"
                  style={{ fontSize: 'clamp(40px,7vw,72px)', fontWeight: 800, lineHeight: 1, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              {/* typographic panel */}
              <div className={`relative flex flex-col justify-center p-7 sm:p-10 md:p-14 ${flip ? 'md:order-1' : ''}`}>
                <span className="font-mono mb-4" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)' }}>
                  {s.cat.toUpperCase()}
                </span>
                <h3 className="font-display inline-block" style={{ fontSize: 'clamp(24px, 3.4vw, 40px)', fontWeight: 800, lineHeight: 1.03, letterSpacing: '-0.015em', color: 'var(--fg)' }}>
                  <span className="relative inline">
                    {s.name}
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100"
                      style={{ background: 'var(--accent)' }}
                    />
                  </span>
                </h3>
                <p className="font-body mt-4" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 400 }}>
                  {s.line}
                </p>
                <div className="mt-8 flex items-center justify-between">
                  <span className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '0.08em' }}>FROM </span>
                    {formatCurrency(from)}
                  </span>
                  <span
                    className="inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 group-hover:bg-[var(--accent)]"
                    style={{ border: '1px solid var(--border-strong)', color: 'var(--fg)' }}
                  >
                    <ArrowUpRight size={18} className="transition-all duration-300 group-hover:text-[var(--on-accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
