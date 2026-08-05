/**
 * The one permitted spinner (design system §13): inline, currentColor, and
 * only ever inside a pressed Action. Reduced motion leaves a static ring.
 */
export default function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="working"
      className="st-spin"
      style={{
        display: 'inline-block', width: size, height: size,
        border: '1.5px solid currentColor', borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
    />
  );
}
