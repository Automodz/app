'use client';
import Image from 'next/image';
import { CSSProperties } from 'react';

/**
 * Cinematic photographic surface: a next/image under a graphite→transparent
 * scrim so headline text stays legible. `scrim` picks the gradient direction.
 * Use for the homepage hero, service cards, garage/vehicle cards.
 */
export default function HeroMedia({
  src,
  alt,
  priority = false,
  scrim = 'bottom',
  rounded = 0,
  overlay,
  className = '',
  style,
  children,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  scrim?: 'bottom' | 'top' | 'left' | 'full' | 'none';
  rounded?: number;
  overlay?: string;          // extra tint layered above the scrim
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}) {
  // Scrims are built from --void (porcelain in light, near-black in dark) so
  // the photographic overlay adapts to the active theme automatically.
  const v = (a: number) => `color-mix(in srgb, var(--void) ${a}%, transparent)`;
  const scrims: Record<string, string> = {
    bottom: `linear-gradient(to top, ${v(100)} 2%, ${v(55)} 34%, transparent 72%)`,
    top: `linear-gradient(to bottom, ${v(100)} 0%, transparent 55%)`,
    left: `linear-gradient(to right, ${v(100)} 2%, ${v(52)} 40%, transparent 78%)`,
    full: `linear-gradient(to top, ${v(100)} 0%, ${v(48)} 45%, ${v(26)} 100%)`,
    none: 'transparent',
  };
  return (
    <div
      className={`relative overflow-hidden w-full h-full ${className}`}
      style={{ borderRadius: rounded, ...style }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
        style={{ transform: 'scale(1.02)' }}
      />
      <div className="absolute inset-0" style={{ background: scrims[scrim] }} />
      {overlay && <div className="absolute inset-0" style={{ background: overlay }} />}
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}
