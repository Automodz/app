'use client';
import CountUp from '@/components/ui/CountUp';
import { Rise } from './Kinetic';

const STATS = [
  { end: 5, suffix: ' min', label: 'AVERAGE TIME TO BOOK' },
  { end: 100, suffix: '%', label: 'STAGES PHOTOGRAPHED' },
  { end: 9, suffix: 'H', label: 'CERAMIC HARDNESS' },
  { end: 7, suffix: ' days', label: 'OPEN EVERY WEEK' },
];

// Descriptive of what the studio details — not an endorsement claim.
const MARQUES = ['Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Range Rover', 'Jaguar', 'Lexus', 'Volvo', 'Mini', 'Toyota'];

/**
 * Proof. Structural metrics that are true by design (no invented review
 * counts), each counting up as it enters view, over a quiet marque marquee.
 * Establishes competence and breadth right before the closing ask.
 */
export default function Proof() {
  return (
    <section className="relative max-w-[1240px] mx-auto px-5 sm:px-8 py-[14vh]">
      <Rise>
        <p className="font-mono mb-12" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
          [ 04 ] — THE MEASURE
        </p>
      </Rise>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-6">
        {STATS.map((s, i) => (
          <Rise key={s.label} delay={0.06 * i}>
            <div style={{ borderTop: '1px solid var(--border-2)', paddingTop: 20 }}>
              <div className="font-hero" style={{ fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
                <CountUp end={s.end} suffix={s.suffix} />
              </div>
              <div className="font-mono mt-4" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)' }}>
                {s.label}
              </div>
            </div>
          </Rise>
        ))}
      </div>

      {/* marque marquee */}
      <div className="mt-[12vh]">
        <Rise>
          <p className="font-mono mb-8 text-center" style={{ fontSize: 10.5, letterSpacing: '0.2em', color: 'var(--faint)' }}>
            AT HOME WITH EVERY MARQUE
          </p>
        </Rise>
        <div className="marquee relative" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
          <div className="marquee-track flex items-center gap-14">
            {[...MARQUES, ...MARQUES].map((m, i) => (
              <span key={i} className="font-display whitespace-nowrap" style={{ fontSize: 'clamp(20px, 3vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--faint)' }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
