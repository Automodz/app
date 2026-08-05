'use client';
/**
 * THE HERO MEDIA - the one image layer both the Glance and the Stay are cut from.
 *
 * It renders exactly one thing: the car, filling its frame (object-cover), under
 * the same cinematic grade - a vignette, then a floor the page rises out of. When
 * there is no photograph it shows the branded fallback the caller hands it (the
 * IdentityPlate monument), never a bare black box.
 *
 * It owns no layout of its own: it fills whatever positioned frame wraps it, so
 * Home and Visit decide the crop (the frame's height) while sharing the image,
 * the fallback and the scrim. The scrim's floor colour is the only thing that
 * changes per surface (paper on the Glance, stage on the Stay).
 */
import Image from 'next/image';
import type { ReactNode } from 'react';

export default function HeroMedia({
  photo, fallback, alt = '', priority, scrimTo = 'var(--st-paper)', vignette = true,
}: {
  /** the resolved hero photograph (see lib/os/hero → getHeroImage) */
  photo?: string;
  /** the branded stand-in shown when there is no photograph */
  fallback?: ReactNode;
  alt?: string;
  priority?: boolean;
  /** the colour the scrim settles into - the surface the hero sits on */
  scrimTo?: string;
  vignette?: boolean;
}) {
  return (
    <>
      {photo
        ? <Image src={photo} alt={alt} fill priority={priority} sizes="100vw" style={{ objectFit: 'cover' }} />
        : fallback}
      {/* the cinematic grade: a vignette that draws the eye to the car */}
      {vignette && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }} />
      )}
      {/* the floor the page rises out of - the hero never ends on a hard edge */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', pointerEvents: 'none',
        background: `linear-gradient(transparent, ${scrimTo} 92%)`,
      }} />
    </>
  );
}
