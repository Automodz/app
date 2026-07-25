/**
 * THE SESSION MANAGER.
 *
 * One owner for everything session-shaped. Nothing else reads or writes the
 * session store, and no business object ever enters it.
 *
 * What belongs here: who is signed in (by uid only), where they were, what they
 * had open, what they had half-typed, and their interface preferences. What
 * does NOT belong here: users, vehicles, bookings, jobs, invoices, Firestore
 * Timestamps - anything that has a server-side source of truth. Those are
 * served by Firestore's own persistent cache (see lib/firebase.ts), which
 * handles freshness, invalidation and offline for us. Two copies of a business
 * object is one copy too many.
 *
 * The payload is versioned and migrated on read, so shipping a new shape can
 * never strand an existing customer with an unreadable session.
 */

export const SESSION_KEY = 'automodz-session';
export const SESSION_VERSION = 5;

/** Cached reads older than this are refreshed silently on the next launch. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

export type ThemeName = 'light' | 'dark';

export interface SessionState {
  version: number;
  /** who the session belongs to - never the profile, only the id */
  uid: string | null;
  /** the car they were last looking at */
  selectedVehicleId: string | null;
  /** the customer surface they last had open */
  lastRoute: string | null;
  /** how they arrived there, so Back stays truthful */
  navStack: string[];
  /** the welcome has been met (previously a separate flag) */
  onboardingCompleted: boolean;
  /** half-finished input, keyed by form - never lost to a reload */
  drafts: Record<string, unknown>;
  /** interface state that should survive a launch */
  ui: {
    theme: ThemeName;
    /** scroll offset per route */
    scrollPositions: Record<string, number>;
  };
  /** when the server was last known to agree with us */
  lastSyncedAt: number | null;
}

export const emptySession = (): SessionState => ({
  version: SESSION_VERSION,
  uid: null,
  selectedVehicleId: null,
  lastRoute: null,
  navStack: [],
  onboardingCompleted: false,
  drafts: {},
  ui: { theme: 'dark', scrollPositions: {} },
  lastSyncedAt: null,
});

/* ── migrations ──────────────────────────────────────────────────────────
   Each step upgrades one version to the next. A session from an unknown or
   unreadable shape is discarded rather than guessed at - losing a scroll
   position is nothing; booting a customer into a broken app is not. */

type LegacyZustand = { state?: { theme?: ThemeName; selectedVehicleId?: string | null; lastRoute?: string | null } };

/** The pre-SessionManager store persisted its whole zustand slice under v5. */
function fromLegacyZustand(raw: string): SessionState | null {
  try {
    const parsed = JSON.parse(raw) as LegacyZustand;
    if (!parsed?.state) return null;
    const s = emptySession();
    if (parsed.state.theme === 'dark' || parsed.state.theme === 'light') s.ui.theme = parsed.state.theme;
    s.selectedVehicleId = parsed.state.selectedVehicleId ?? null;
    s.lastRoute = parsed.state.lastRoute ?? null;
    return s;
  } catch { return null; }
}

export function migrate(input: unknown): SessionState {
  const base = emptySession();
  if (!input || typeof input !== 'object') return base;
  const s = input as Partial<SessionState>;

  // unversioned or newer-than-us: start clean rather than misread it
  if (typeof s.version !== 'number' || s.version > SESSION_VERSION) return base;

  // v5 is current; older versions would be stepped up here as they appear
  return {
    ...base,
    ...s,
    version: SESSION_VERSION,
    ui: { ...base.ui, ...(s.ui ?? {}) },
    drafts: { ...(s.drafts ?? {}) },
    navStack: Array.isArray(s.navStack) ? s.navStack : [],
  };
}

/* ── storage ─────────────────────────────────────────────────────────────
   localStorage, read and written synchronously. Synchronous matters: an async
   restore races every write that happens before it lands. */

const readRaw = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const SessionManager = {
  /** Read the session off disk, migrating whatever shape is there. */
  restore(): SessionState {
    if (typeof window === 'undefined') return emptySession();

    const raw = readRaw(SESSION_KEY);
    if (raw) {
      try { return migrate(JSON.parse(raw)); } catch { return emptySession(); }
    }

    // first launch after the upgrade: carry the old store's preferences over
    const legacyRaw = readRaw('automodz-v5');
    if (legacyRaw) {
      const migrated = fromLegacyZustand(legacyRaw);
      if (migrated) {
        SessionManager.save(migrated);
        try { localStorage.removeItem('automodz-v5'); } catch { /* nothing to clean */ }
        return migrated;
      }
    }
    return emptySession();
  },

  save(state: SessionState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...state, version: SESSION_VERSION }));
    } catch { /* storage full or denied - the session simply won't outlive the tab */ }
  },

  /** Sign-out, expiry, or a different account: nothing of the last customer stays. */
  clear(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* already gone */ }
  },

  /** Stamp a successful server read. */
  markSynced(state: SessionState): SessionState {
    return { ...state, lastSyncedAt: Date.now() };
  },

  /** True when the cached view is old enough to refresh quietly behind the UI. */
  isStale(state: SessionState, now = Date.now()): boolean {
    return state.lastSyncedAt === null || now - state.lastSyncedAt > STALE_AFTER_MS;
  },
};
