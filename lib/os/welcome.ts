/**
 * The welcome flag (P2D1 §C10) - onboarding happens once.
 *
 * A garage with a car in it is the real proof; this covers the customer who
 * skipped the car and would otherwise be walked through it again.
 */
const SEEN = 'automodz-welcomed';

export function markWelcomed() {
  try { localStorage.setItem(SEEN, '1'); } catch { /* private mode - the garage still proves it */ }
}

export function hasBeenWelcomed(): boolean {
  try { return localStorage.getItem(SEEN) === '1'; } catch { return true; }
}
