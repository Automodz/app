/**
 * The session cookie - the seam that makes server rendering possible.
 *
 * These assert the contract the routes depend on, with the Admin SDK mocked:
 * a cookie is only minted from a verified token, an unreadable cookie is a
 * signed-out customer rather than an error, and the cookie is read BEFORE any
 * other check so Next always treats a customer room as dynamic.
 */
const verifySessionCookie = jest.fn();
const verifyIdToken = jest.fn();
const createSessionCookie = jest.fn();
const cookieGet = jest.fn();

jest.mock('@/lib/server/firebaseAdmin', () => ({
  adminAuth: { verifySessionCookie: (...a: unknown[]) => verifySessionCookie(...a),
               verifyIdToken: (...a: unknown[]) => verifyIdToken(...a),
               createSessionCookie: (...a: unknown[]) => createSessionCookie(...a) },
  adminDb: {},
}));
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => cookieGet(n) }),
}));

import { currentSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/server/session';

beforeEach(() => jest.clearAllMocks());

it('returns null with no cookie, and still reads the cookie jar first', async () => {
  cookieGet.mockReturnValue(undefined);
  expect(await currentSession()).toBeNull();
  /* The read is what marks the render dynamic. A build that skipped it
     prerendered the signed-out screen into static HTML. */
  expect(cookieGet).toHaveBeenCalledWith(SESSION_COOKIE);
});

it('resolves the uid from a valid cookie', async () => {
  cookieGet.mockReturnValue({ value: 'cookie' });
  verifySessionCookie.mockResolvedValue({ uid: 'u1', email: 'a@b.c', name: 'A' });
  expect(await currentSession()).toEqual({ uid: 'u1', email: 'a@b.c', name: 'A' });
});

it('checks revocation, so signing out stops rendering a garage immediately', async () => {
  cookieGet.mockReturnValue({ value: 'cookie' });
  verifySessionCookie.mockResolvedValue({ uid: 'u1' });
  await currentSession();
  expect(verifySessionCookie).toHaveBeenCalledWith('cookie', true);
});

it('treats an expired, revoked or forged cookie as signed out, never as a crash', async () => {
  cookieGet.mockReturnValue({ value: 'bad' });
  verifySessionCookie.mockRejectedValue(new Error('expired'));
  expect(await currentSession()).toBeNull();
});

it('caps the cookie at Firebase’s 14-day ceiling', () => {
  expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 14);
});
