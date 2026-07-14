import { ReactNode } from 'react';
import CountUp from './CountUp';

/**
 * Dashboard stat tile: mono label, metallic gradient value (counts up when
 * `value` is numeric), optional icon + delta line.
 */
export default function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  icon,
  sub,
  className = '',
}: {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="data-label">{label}</span>
        {icon && <span style={{ color: 'var(--faint)' }}>{icon}</span>}
      </div>
      <div className="font-display font-700 text-2xl mt-2 text-ember">
        {typeof value === 'number'
          ? <CountUp end={value} prefix={prefix} suffix={suffix} />
          : `${prefix}${value}${suffix}`}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}
