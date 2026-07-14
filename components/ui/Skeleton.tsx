/**
 * Shimmer placeholder. Compose rows with `lines`, or size one block with
 * className (e.g. "h-24 w-full"). Reserves space - no content jumping.
 */
export default function Skeleton({
  lines = 1,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  if (lines === 1) {
    return (
      <div
        className={`shimmer rounded-xl ${className || 'h-4 w-full'}`}
        style={{ background: 'var(--fog)' }}
        aria-hidden
      />
    );
  }
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`shimmer rounded-xl h-4 ${className}`}
          style={{ background: 'var(--fog)', width: i === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  );
}
