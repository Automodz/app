'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `end` once it renders. Renders the final
 * value immediately when reduced motion is preferred - never a gate.
 */
export default function CountUp({
  end,
  duration = 900,
  prefix = '',
  suffix = '',
}: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [val, setVal] = useState(end);
  const raf = useRef<number>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(end); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(end * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [end, duration]);

  const shown = Number.isInteger(end)
    ? Math.round(val).toLocaleString('en-IN')
    : val.toFixed(1);
  return <span>{prefix}{shown}{suffix}</span>;
}
