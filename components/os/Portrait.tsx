'use client';
/**
 * The vehicle hero (design system §7.1). Full-bleed, bottom scrim, name +
 * truth stacked bottom-left. Photographed / typographic states.
 */
import Image from 'next/image';
import type { ReactNode } from 'react';
import { DisplayLarge, Data } from './text';
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
  return (
    <div style={{
      position: 'relative', minHeight, width: '100%', overflow: 'hidden',
      background: 'var(--st-stage)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      {photo ? (
        <>
          <Image
            src={photo} alt={`Your ${name}`} fill priority
            style={{ objectFit: 'cover' }}
            sizes="100vw"
          />
          {/* status-bar legibility */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 64,
            background: 'linear-gradient(rgba(12,13,14,0.24), transparent)',
          }} />
          {/* bottom scrim — max 55%, lower 30% */}
          <div aria-hidden style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(transparent, rgba(12,13,14,0.55))',
          }} />
        </>
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <DisplayLarge tone="over" style={{ textAlign: 'center', padding: '0 24px' }}>{name}</DisplayLarge>
          {plate && <Data tone="over-2" style={{ fontSize: 16 }}>{plate}</Data>}
        </div>
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
            <TruthLine text={truth} onPhoto />
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
