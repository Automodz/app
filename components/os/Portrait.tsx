'use client';
/**
 * The vehicle hero (design system §7.1). Full-bleed, bottom scrim, name +
 * truth stacked bottom-left. Photographed / typographic states.
 */
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { DisplayLarge } from './text';
import IdentityPlate from './IdentityPlate';
import TruthLine from './TruthLine';

interface PortraitProps {
  name: string;              // "Mercedes-AMG C 43"
  truth: string;
  photo?: string;            // customer/studio portrait URL
  plate?: string;            // shown only in typographic state
  minHeight?: string;        // default 92vh
  children?: ReactNode;      // overlay extras (avatar, page dots)
}

export default function Portrait({ name, truth, photo, plate, minHeight = '92vh', children }: PortraitProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{
      position: 'relative', minHeight, width: '100%', overflow: 'hidden',
      // stage is for photography only; without a photo the portrait is paper
      background: photo ? 'var(--st-stage)' : 'var(--st-gallery)',
      display: 'flex', alignItems: 'flex-end',
      // overlays (page dots) read their ink from the portrait's own rendering
      ['--st-portrait-fg' as string]: photo ? 'var(--st-over)' : 'var(--st-ink)',
      ['--st-portrait-fg-2' as string]: photo ? 'var(--st-over-2)' : 'var(--st-ink-3)',
    }}>
      {photo ? (
        <>
          <Image
            src={photo} alt={`Your ${name}`} fill priority
            className={`st-img${loaded ? ' is-loaded' : ''}`}
            onLoad={() => setLoaded(true)}
            style={{ objectFit: 'cover' }}
            sizes="100vw"
          />
          {/* status-bar legibility */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 64,
            background: 'linear-gradient(var(--st-scrim-soft), transparent)',
          }} />
          {/* bottom scrim - max 55%, lower 30% */}
          <div aria-hidden style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(transparent, var(--st-scrim-strong))',
          }} />
        </>
      ) : (
        <IdentityPlate name={name} registration={plate} variant="portrait" />
      )}

      <div style={{
        position: 'relative', zIndex: 1, width: '100%',
        padding: '0 24px calc(env(safe-area-inset-bottom) + 128px)',
      }}>
        {photo && (
          <>
            <DisplayLarge tone="over">{name}</DisplayLarge>
            <div style={{ height: 12 }} />
            <TruthLine text={truth} onPhoto />
          </>
        )}
        {!photo && (
          <div style={{ textAlign: 'center' }}>
            <TruthLine text={truth} />
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
