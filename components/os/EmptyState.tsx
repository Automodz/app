/**
 * An empty state is either silence (render nothing) or a single invitation
 * (design system §12). This is the invitation - one sentence, one optional
 * quiet action. Never an illustration, never a "nothing here yet" card.
 */
import { Body } from './text';
import Action from './Action';

export default function EmptyState({
  line, actionLabel, onAction,
}: {
  line: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div>
      <Body tone="ink-2" style={{ fontSize: 19 }}>{line}</Body>
      {actionLabel && onAction && (
        <div style={{ marginTop: 'var(--st-line)' }}>
          <Action variant="forward" onClick={onAction}>{actionLabel}</Action>
        </div>
      )}
    </div>
  );
}
