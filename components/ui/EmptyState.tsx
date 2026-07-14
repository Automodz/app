import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

/** Shared empty state - pairs with ErrorState for the loading/empty/error trio. */
export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  message,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card text-center py-14 px-6 ${className}`}>
      <div className="mx-auto mb-3 w-fit" style={{ color: 'var(--faint)' }}>
        {icon ?? <Inbox size={26} />}
      </div>
      <p className="font-display font-600 text-sm mb-1">{title}</p>
      {message && <p className="font-body text-sm mb-5" style={{ color: 'var(--muted)' }}>{message}</p>}
      {action}
    </div>
  );
}
