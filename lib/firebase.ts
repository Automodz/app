import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Images live on Cloudinary (see lib/services/storage.ts) - Firebase Storage
// is intentionally not used (requires a billing card on new projects).
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Every Firebase call in this app runs in the browser (inside effects), never
// during SSR/prerender. Without the public env vars, getAuth() throws
// `auth/invalid-api-key` at import time and aborts the whole `next build`
// while statically generating pages. Guard it so a missing key surfaces at
// runtime (where the vars are always present) instead of failing the build.
export const auth = firebaseConfig.apiKey
  ? getAuth(app)
  : (undefined as unknown as ReturnType<typeof getAuth>);

/* The session survives closing the app. This is Firebase's default, but it is
   stated explicitly because it is a product promise, not an implementation
   detail: a customer signs in once and is only ever asked again if they sign
   out, the token is revoked, or the account is disabled. (Safari/PWA storage
   quirks have silently downgraded the default before.) */
if (auth && typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    /* private mode with storage denied - the session lasts the tab, and the
       customer is told nothing they cannot act on */
  });
}
export const db   = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export { app };
