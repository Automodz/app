'use client';
/**
 * "YOU'RE OFFLINE."
 *
 * Source: docs/AUTOMODZ-OS.md §20.3, §21.7
 *
 * §20.3 - ours or theirs. Everything already on the page was rendered on the
 * server and is still true; only what happens NEXT is affected. So this says
 * exactly that and nothing more alarming, and it never claims the studio has
 * failed.
 *
 * §21.7 - announced politely, because the customer did not act to cause it.
 * `role="status"` with `aria-live="polite"` means a screen reader is told when
 * the connection goes AND when it returns - the note unmounts on reconnect, so
 * recovery is silent rather than announced as another event.
 *
 * THE ONLY OFFLINE IMPLEMENTATION IN THE PRODUCT (§22.2). It began as Home's
 * own markup, was extracted when the marketplace needed it, and absorbed five
 * more copies that had grown inside the sheets - `BookingFlow`, `ManageVisit`,
 * `AccountSettings` and `ClubFlow` each carried their own `useOnline()` plus a
 * hand-written `<Text aria-live>`, with four different sentences between them.
 *
 * TWO PLACEMENTS, ONE COMPONENT. A room wears it as a rule across the top; a
 * sheet says it in line, beside the control it affects. That is a difference
 * of position, not of behaviour, so it is a prop rather than a second
 * component - which is exactly how the four sentences drifted apart before.
 */
import { color, space, column, HAIRLINE } from '@/design';
import { Text } from './Text';
import { useOnline } from './useOnline';

export interface OfflineNoteProps {
  /**
   * What is affected here, when the plain sentence is not enough. A room can
   * still be read offline; a form inside it cannot be sent.
   */
  caption?: string;
  /**
   * Sit in the flow of a sheet rather than ruling across a room. No border, no
   * background, no full-bleed column - the layer already provides those.
   */
  inline?: boolean;
}

export function OfflineNote({ caption, inline = false }: OfflineNoteProps) {
  const online = useOnline();

  /* Nothing at all when connected - not a hidden element, which would still
     sit in the accessibility tree and still be read. */
  if (online) return null;

  const line = (
    <Text role={inline ? 'body' : 'data'} tone="ink2">
      {caption ?? 'You’re offline. This is the last we knew.'}
    </Text>
  );

  if (inline) {
    return (
      <div role="status" aria-live="polite" style={{ marginTop: space.line }}>
        {line}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...column,
        paddingBlock: space.line,
        background: color.surface,
        borderBottom: `${HAIRLINE}px solid ${color.edge}`,
      }}
    >
      {line}
    </div>
  );
}
