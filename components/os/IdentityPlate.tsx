/**
 * The identity plate (design system §7.1, photo-absent state).
 *
 * Most cars have no photograph, so the photo-less rendering is the *default*
 * state, not a fallback — it is designed to the same bar as photography:
 * a gallery-toned material, one hairline, the car's own words, the plate in
 * its own glyphs, and the studio's mark held quiet underneath.
 *
 * Created once, reused by Portrait, PhotoBand, the empty garage and (later)
 * onboarding. `plateSurface` is the shared material for any photo-less frame.
 */
import type { CSSProperties } from 'react';
import { DisplayLarge, Display, Emphasis, Whisper } from './text';

/** The shared photo-less material: gallery ground, one hairline, no graphics. */
export const plateSurface: CSSProperties = {
  background: 'var(--st-gallery)',
  boxShadow: 'inset 0 0 0 1px var(--st-hairline)',
};

interface IdentityPlateProps {
  /** The car as the owner says it: "Mercedes-AMG C 43". */
  name: string;
  registration?: string;
  /**
   * `portrait` fills a hero · `band` sits inside an existing framed ratio ·
   * `row` is the in-flow line that names the car a surface is acting on.
   */
  variant?: 'portrait' | 'band' | 'row';
  style?: CSSProperties;
}

/**
 * The owner writes one name ("Mercedes-AMG C 43"); the marque is its first
 * word and the model is the rest. A single-word name stays whole — the plate
 * never invents a marque it wasn't given.
 */
function split(name: string): { marque?: string; model: string } {
  const trimmed = name.trim();
  const cut = trimmed.indexOf(' ');
  if (cut < 1) return { model: trimmed };
  return { marque: trimmed.slice(0, cut), model: trimmed.slice(cut + 1) };
}

/** The plate's own glyphs — the one place ALL-CAPS is allowed with the wordmark. */
function Registration({ value, style }: { value: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        background: 'var(--st-linen)',
        borderRadius: 'var(--st-r-chip)',
        padding: '6px 12px', whiteSpace: 'nowrap',
        fontFamily: 'var(--st-data)', fontWeight: 400, fontSize: 14, lineHeight: 1.45,
        letterSpacing: '0.06em', color: 'var(--st-ink-2)',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {value}
    </span>
  );
}

export default function IdentityPlate({
  name, registration, variant = 'portrait', style,
}: IdentityPlateProps) {
  const { marque, model } = split(name);
  const hero = variant === 'portrait';
  const row = variant === 'row';
  const Model = hero ? DisplayLarge : Display;

  if (row) {
    return (
      <div
        style={{
          ...plateSurface,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--st-gap)',
          borderRadius: 'var(--st-r-card)', padding: 'var(--st-gap)',
          ...style,
        }}
      >
        <span style={{ minWidth: 0 }}>
          {marque && <Whisper tone="ink-3">{marque}</Whisper>}
          <Emphasis as="p">{model}</Emphasis>
        </span>
        {registration && <Registration value={registration} />}
      </div>
    );
  }

  return (
    <div
      style={{
        ...plateSurface,
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: hero ? 'var(--st-inset)' : 'var(--st-gap)',
        textAlign: 'center',
        ...style,
      }}
    >
      {marque && (
        <Whisper tone="ink-3" style={{ marginBottom: 'var(--st-line)' }}>{marque}</Whisper>
      )}
      <Model
        as="p"
        style={{
          // holds its line from 320 to 1440 without ever clipping the name
          fontSize: hero ? 'clamp(30px, 8vw, 44px)' : 'clamp(20px, 5vw, 32px)',
          maxWidth: hero ? 640 : 480,
        }}
      >
        {model}
      </Model>
      {registration && (
        <Registration
          value={registration}
          style={{ marginTop: hero ? 'var(--st-inset)' : 'var(--st-line)' }}
        />
      )}
      {hero && (
        <Whisper
          tone="ink-3"
          style={{
            position: 'absolute', left: 0, right: 0,
            bottom: 'calc(env(safe-area-inset-bottom) + var(--st-rest))',
            fontFamily: 'var(--st-display)', letterSpacing: '0.08em',
          }}
        >
          AUTOMODZ
        </Whisper>
      )}
    </div>
  );
}
