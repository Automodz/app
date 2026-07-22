'use client';
/**
 * Photography rows (design system §7.6): protection bands (21:9),
 * memory photos (≤4:3), chapter heroes (3:2). Caption below by default;
 * over-scrim title only for the band variant.
 */
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { Emphasis, Body, Whisper } from './text';
import { plateSurface } from './IdentityPlate';

type Ratio = 'band' | 'memory' | 'hero';
const ASPECT: Record<Ratio, string> = { band: '21 / 9', memory: '4 / 3', hero: '3 / 2' };

interface PhotoBandProps {
  src?: string;
  alt: string;
  ratio?: Ratio;
  overTitle?: string;      // band variant: title over scrim
  overCaption?: string;
  overBadge?: ReactNode;   // band variant: a status chip, top-right over the photo
  caption?: string;        // below-image caption
  whisper?: string;
  onTap?: () => void;
}

export default function PhotoBand({
  src, alt, ratio = 'memory', overTitle, overCaption, overBadge, caption, whisper, onTap,
}: PhotoBandProps) {
  const [loaded, setLoaded] = useState(false);
  const body = (
    <>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: ASPECT[ratio],
        borderRadius: 'var(--st-r-sheet)', overflow: 'hidden',
        // photography sits on stage; a photo-less frame uses the shared plate material
        ...(src ? { background: 'var(--st-stage)' } : plateSurface),
      }}>
        {src && (
          <>
            <Image src={src} alt={alt} fill
              className={`st-img${loaded ? ' is-loaded' : ''}`}
              onLoad={() => setLoaded(true)}
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 720px) 100vw, 640px" loading="lazy" />
            {overBadge && (
              <div style={{ position: 'absolute', top: 16, right: 16 }}>{overBadge}</div>
            )}
            {overTitle && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '48px 24px 16px',
                background: 'linear-gradient(transparent, var(--st-scrim-strong))',
              }}>
                <Emphasis tone="over" as="p">{overTitle}</Emphasis>
                {overCaption && <Body tone="over-2" style={{ fontSize: 14 }}>{overCaption}</Body>}
              </div>
            )}
          </>
        )}
        {!src && overTitle && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 24px' }}>
            <Emphasis as="p">{overTitle}</Emphasis>
            {overCaption && <Body tone="ink-2" style={{ fontSize: 14 }}>{overCaption}</Body>}
          </div>
        )}
      </div>
      {caption && <Body style={{ marginTop: 12 }}>{caption}</Body>}
      {whisper && <Whisper style={{ marginTop: 4 }}>{whisper}</Whisper>}
    </>
  );

  if (!onTap) return <div>{body}</div>;
  return (
    <button onClick={onTap} className="st-tap" style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    }}>
      {body}
    </button>
  );
}
