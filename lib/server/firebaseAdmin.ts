import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

/**
 * The local suite accepts any caller, so it needs no service account. This is
 * what makes the server read path and the visit pipeline verifiable at all -
 * without it, exercising them required production credentials on a developer's
 * machine, which is why neither had ever been run.
 *
 * Gated on the emulator host AND on not being a production build, so a deployed
 * instance can never fall into credential-free mode.
 */
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST
  && process.env.NODE_ENV !== 'production';

const isConfigured = emulated || !!(projectId && clientEmail && privateKey);

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : emulated
      ? initializeApp({ projectId: projectId || 'automodz-local' })
      : isConfigured
        ? initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          })
        : null;

export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminDb = adminApp ? getFirestore(adminApp) : null;

export function assertAdminConfigured() {
  if (!isConfigured || !adminAuth || !adminDb) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.');
  }
}

