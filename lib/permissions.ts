/**
 * Permission matrix — the single code definition of who may do what.
 * Consumed by the staff shell (app/admin/layout.tsx) and anywhere else a
 * role decision is made. There are exactly four ways a human uses the staff
 * side; the customer app is a separate surface with its own auth.
 *
 *   owner/admin (role 'admin')
 *     Everything: Studio + Office, business settings, pricing, overrides
 *     (unpaid-delivery override, assignee edits, shift reopen).
 *   technician (role 'employee', personal session)
 *     Studio only. No finance, no reports, no pricing, no Office routes —
 *     the shell hard-redirects them to the Studio Board.
 *   kiosk (PIN unlock riding the owner's admin session on the shared tablet)
 *     Studio actions attributed to the unlocked employee (actor =
 *     kioskEmployee everywhere). Auto-relocks to /store after inactivity.
 *     Business gates that check role still see 'admin' hardware but
 *     operational gates (e.g. delivery-with-balance) treat it as staff.
 *   customer (role 'customer')
 *     Never enters /admin or /store; the shell bounces them to login.
 */

export type StaffRole = 'admin' | 'employee';

/**
 * Studio-floor route prefixes technicians may use. Everything else under
 * /admin is Office and requires an admin session. Unlisted /admin routes
 * reached from the floor (job/booking/vehicle detail, walk-in intake)
 * count as Studio.
 */
export const STUDIO_PREFIXES = [
  '/admin/schedule', '/admin/bookings', '/admin/attendance', '/admin/gallery',
  '/admin/walkin', '/admin/jobs', '/admin/vehicles',
] as const;

export const isStudioPath = (path: string): boolean =>
  path === '/admin' ||
  STUDIO_PREFIXES.some(pre => path === pre || path.startsWith(pre + '/'));

/** May this staff role open this /admin path? */
export const canAccessAdminPath = (role: StaffRole, path: string): boolean =>
  role === 'admin' || isStudioPath(path);
