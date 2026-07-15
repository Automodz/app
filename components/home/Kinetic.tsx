'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRM } from './useRM';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/*
 * Reveals are driven by IntersectionObserver + CSS transitions rather than a
 * JS animation library. This is deliberate: it is impossible for content to be
 * stranded hidden — an in-view element always resolves to its shown state, the
 * transition is GPU-only (opacity/transform), and reduced-motion users skip
 * straight to visible with no motion. Framer is reserved for enhancements
 * (magnetic, parallax) where a no-op degrades gracefully.
 */
function useInView<T extends HTMLElement>(reduced: boolean) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);
  return { ref, shown };
}

/**
 * MaskLines — each line rides in an overflow-clip band and rises into view.
 * The signature headline reveal. Pass an array of nodes (one per line).
 */
export function MaskLines({
  lines,
  className = '',
  style,
  delay = 0,
  stagger = 0.09,
}: {
  lines: ReactNode[];
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  stagger?: number;
}) {
  const reduced = useRM();
  const { ref, shown } = useInView<HTMLSpanElement>(reduced);
  return (
    <span ref={ref} className={className} style={{ display: 'block', ...style }}>
      {lines.map((line, i) => (
        <span key={i} style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em' }}>
          <span
            style={{
              display: 'block',
              willChange: 'transform',
              transform: shown ? 'translateY(0)' : 'translateY(110%)',
              transition: reduced ? 'none' : `transform 0.9s ${EASE} ${delay + i * stagger}s`,
            }}
          >
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * WordStagger — words fade+rise in sequence as the block scrolls in, so the
 * statement "reads" itself. Real spaces preserved for accessibility/selection.
 */
export function WordStagger({
  text,
  className = '',
  style,
  highlight = [],
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  highlight?: number[];
}) {
  const reduced = useRM();
  const { ref, shown } = useInView<HTMLParagraphElement>(reduced);
  const words = text.split(' ');
  return (
    <p ref={ref} className={className} style={style}>
      {words.map((w, i) => (
        <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          <span
            style={{
              display: 'inline-block',
              color: highlight.includes(i) ? 'var(--fg)' : undefined,
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0)' : 'translateY(0.4em)',
              transition: reduced ? 'none' : `opacity 0.6s ${EASE} ${i * 0.03}s, transform 0.6s ${EASE} ${i * 0.03}s`,
            }}
          >
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

/** Rise — content-first block reveal (opacity + translate on view). */
export function Rise({
  children,
  className = '',
  style,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  y?: number;
}) {
  const reduced = useRM();
  const { ref, shown } = useInView<HTMLDivElement>(reduced);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: reduced ? 'none' : `opacity 0.8s ${EASE} ${delay}s, transform 0.8s ${EASE} ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
