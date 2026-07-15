'use client';
import { WordStagger, Rise } from './Kinetic';

/**
 * Philosophy beat. One conviction, delivered as a word-by-word reveal so the
 * visitor effectively reads it aloud in their head — the pace does the
 * persuading. Establishes standard-of-care before any price is shown.
 */
export default function Manifesto() {
  return (
    <section className="relative max-w-[1240px] mx-auto px-5 sm:px-8 py-[16vh] sm:py-[22vh]">
      <Rise>
        <p className="font-mono mb-8" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--faint)' }}>
          [ 01 ] — THE STANDARD
        </p>
      </Rise>

      <WordStagger
        text="No car leaves the studio until it looks better than the day it was delivered. That is the whole job."
        className="font-hero"
        style={{
          fontSize: 'clamp(26px, 4.6vw, 58px)',
          fontWeight: 700,
          lineHeight: 1.14,
          letterSpacing: '-0.02em',
          color: 'var(--muted)',
          maxWidth: 1040,
        }}
        highlight={[0, 1, 2, 3, 4, 5, 6, 15, 16, 17, 18, 19, 20]}
      />
    </section>
  );
}
