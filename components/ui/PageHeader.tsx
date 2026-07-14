'use client';
import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Standard page header: optional back button, metallic gradient title,
 * subtitle, and a right-side actions slot.
 */
export default function PageHeader({
  title,
  subtitle,
  back = false,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={`flex items-start justify-between gap-3 mb-6 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="btn-ghost !p-2.5 !rounded-full shrink-0"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-display font-700 text-2xl leading-tight text-ember truncate">{title}</h1>
          {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
