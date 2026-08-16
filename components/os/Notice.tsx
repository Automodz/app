'use client';
/**
 * THE DOORWAY THAT CLOSES BEHIND ITSELF.
 *
 * Source: docs/AUTOMODZ-OS.md §17.1, §17.3, §20.3, §21.3
 *
 * §17.1 - "the car is the inbox". There is no notification list in this
 * product and this is not one: a thing the studio said that the customer has
 * not seen appears as ONE mark on the car it is about, and the mark opens the
 * object rather than a message.
 *
 * ── WHY IT HAD TO BECOME A COMPONENT ─────────────────────────────────────
 * It was a plain `<Link>`, and the model has always carried the notification's
 * own id beside it with the comment "so consuming the doorway can mark exactly
 * it read". Nothing consumed it. `markNotificationRead` had no caller anywhere
 * in the product, so `read` was never written on the customer's side and the
 * dot on a car stayed lit for ever - through opening the visit, reading what
 * the studio said, and the work being finished. A mark that never clears
 * teaches a customer to ignore every mark.
 *
 * ── SEEN MEANS OPENED, AND THE WRITE MUST NOT DELAY THAT ─────────────────
 * The navigation is the point; marking it read is bookkeeping. So the request
 * is fired and NOT awaited, with `keepalive` so it survives the page being
 * torn down by the navigation it races. §20.3 - if it fails, nothing is said
 * and the mark simply stays: a dot that lingers is a smaller fault than a
 * doorway that hesitates, and the next open tries again.
 */
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export interface NoticeProps {
  /** The notification's own id - what gets marked, and exactly it. */
  id: string;
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Marks one notification read. Never awaited, never surfaced.
 *
 * `keepalive` is what makes this work at all: the click navigates, the page
 * unloads, and an ordinary fetch would be cancelled with it. Same-origin, so
 * the session cookie identifies the caller and no token has to be minted on a
 * path that is about to disappear.
 */
export function markSeen(id: string): void {
  try {
    void fetch('/api/notify/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* A browser without `keepalive`, or offline. The mark stays lit and the
       next open tries again, which is the honest outcome either way. */
  }
}

export function Notice({ id, href, children, className, style }: NoticeProps) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => markSeen(id)}
    >
      {children}
    </Link>
  );
}
