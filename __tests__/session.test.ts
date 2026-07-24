import {
  migrate, emptySession, SessionManager, SESSION_VERSION, SESSION_KEY, STALE_AFTER_MS,
} from '@/lib/os/session';

describe('session migration', () => {
  it('an absent or unreadable session becomes a clean one', () => {
    expect(migrate(undefined).version).toBe(SESSION_VERSION);
    expect(migrate(null).uid).toBeNull();
    expect(migrate('nonsense').selectedVehicleId).toBeNull();
    expect(migrate(42).navStack).toEqual([]);
  });

  it('an unversioned payload is discarded rather than guessed at', () => {
    const s = migrate({ selectedVehicleId: 'car-1', lastRoute: '/app/chapter/x' });
    expect(s.selectedVehicleId).toBeNull();
    expect(s.lastRoute).toBeNull();
  });

  it('a session from a FUTURE version is discarded, not misread', () => {
    const s = migrate({ version: SESSION_VERSION + 1, selectedVehicleId: 'car-9' });
    expect(s.version).toBe(SESSION_VERSION);
    expect(s.selectedVehicleId).toBeNull();
  });

  it('carries a current session through intact', () => {
    const src = {
      ...emptySession(),
      uid: 'u1', selectedVehicleId: 'car-1', lastRoute: '/app/visit/v1',
      navStack: ['/app', '/app/visit/v1'], onboardingCompleted: true,
      drafts: { carForm: { name: 'M340i' } },
      ui: { theme: 'dark' as const, scrollPositions: { '/app': 320 } },
      lastSyncedAt: 1700000000000,
    };
    const s = migrate(src);
    expect(s.uid).toBe('u1');
    expect(s.selectedVehicleId).toBe('car-1');
    expect(s.navStack).toEqual(['/app', '/app/visit/v1']);
    expect(s.onboardingCompleted).toBe(true);
    expect(s.drafts).toEqual({ carForm: { name: 'M340i' } });
    expect(s.ui.theme).toBe('dark');
    expect(s.ui.scrollPositions['/app']).toBe(320);
  });

  it('fills gaps a partial payload leaves, without dropping what it has', () => {
    const s = migrate({ version: SESSION_VERSION, selectedVehicleId: 'car-2' });
    expect(s.selectedVehicleId).toBe('car-2');
    expect(s.ui.theme).toBe('light');       // defaulted
    expect(s.ui.scrollPositions).toEqual({}); // defaulted
    expect(s.drafts).toEqual({});
  });

  it('never persists a business object shape by accident', () => {
    const s = migrate({ version: SESSION_VERSION });
    expect(Object.keys(s).sort()).toEqual([
      'drafts', 'lastRoute', 'lastSyncedAt', 'navStack', 'onboardingCompleted',
      'selectedVehicleId', 'ui', 'uid', 'version',
    ].sort());
  });
});

describe('cache expiry', () => {
  it('a never-synced session is stale', () => {
    expect(SessionManager.isStale(emptySession())).toBe(true);
  });
  it('goes stale only past the window', () => {
    const now = 1_700_000_000_000;
    const fresh = { ...emptySession(), lastSyncedAt: now - 1000 };
    const old = { ...emptySession(), lastSyncedAt: now - STALE_AFTER_MS - 1 };
    expect(SessionManager.isStale(fresh, now)).toBe(false);
    expect(SessionManager.isStale(old, now)).toBe(true);
  });
  it('markSynced stamps the moment', () => {
    const s = SessionManager.markSynced(emptySession());
    expect(SessionManager.isStale(s)).toBe(false);
  });
});

describe('SessionManager storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through disk', () => {
    const s = { ...emptySession(), uid: 'u1', selectedVehicleId: 'car-1' };
    SessionManager.save(s);
    expect(SessionManager.restore().selectedVehicleId).toBe('car-1');
  });

  it('clear leaves nothing behind', () => {
    SessionManager.save({ ...emptySession(), uid: 'u1', selectedVehicleId: 'car-1' });
    SessionManager.clear();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(SessionManager.restore().selectedVehicleId).toBeNull();
  });

  it('upgrades a customer from the pre-SessionManager store, then removes it', () => {
    localStorage.setItem('automodz-v5', JSON.stringify({
      state: { theme: 'dark', selectedVehicleId: 'car-7', lastRoute: '/app/chapter/c1', user: { uid: 'u9' }, vehicles: [{ id: 'car-7' }] },
      version: 0,
    }));
    const s = SessionManager.restore();
    expect(s.ui.theme).toBe('dark');
    expect(s.selectedVehicleId).toBe('car-7');
    expect(s.lastRoute).toBe('/app/chapter/c1');
    // the business objects did NOT come across
    expect(JSON.stringify(s)).not.toContain('vehicles');
    expect(localStorage.getItem('automodz-v5')).toBeNull();
  });
});
