'use client';
/**
 * THE MONOGRAM - the person, as a machined mark.
 * (Design Language §3 lighting · §9)
 *
 * EXTRACTED as the counterpart to `IdentityPlate`: that component is how the
 * product renders a CAR with no photograph, this is how it renders a PERSON
 * with no photograph. Both are lit objects rather than grey circles with a
 * letter in them, and pairing them makes the rule explicit - identity is
 * always a material, never a placeholder.
 *
 * It takes the environment's light the way every other object does: a specular
 * highlight from high-left, a graphite falloff, and one inset shadow at the
 * base so it reads as turned metal rather than a gradient.
 */
export interface MonogramProps {
  /** the name it takes its letter from */
  name?: string;
  /** the photograph, when there is one */
  photo?: string;
  size?: number;
}

export default function Monogram({ name, photo, size = 68 }: MonogramProps) {
  const letter = (name?.trim().charAt(0) || 'Y').toUpperCase();

  return (
    <span
      aria-hidden
      style={{
        position: 'relative', width: size, height: size, flex: '0 0 auto',
        borderRadius: 999, overflow: 'hidden',
        display: 'grid', placeItems: 'center',
        background: photo
          ? 'var(--st-gallery)'
          : 'radial-gradient(circle at 34% 28%, #ffffff 0%, #eef0f2 14%, #d3d7db 42%, #a3a8af 72%, #74797f 100%)',
        boxShadow: photo
          ? 'var(--st-raise), var(--st-edge)'
          : 'var(--st-raise), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -6px 14px rgba(20,22,25,0.28)',
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          fontFamily: 'var(--st-display)', fontWeight: 700,
          fontSize: Math.round(size * 0.44), color: '#1a1c1f',
          textShadow: '0 1px 0 rgba(255,255,255,0.5)',
        }}>
          {letter}
        </span>
      )}
    </span>
  );
}
