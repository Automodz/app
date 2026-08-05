import {
  signInWithPopup, type User as FirebaseAuthUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, googleProvider } from '../firebase';
import type { User } from '../types';

const getAdminEmail = () =>
  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() || 'hello.automodz@gmail.com';

const getRoleForEmail = (email?: string | null) =>
  email?.toLowerCase() === getAdminEmail() ? 'admin' : 'customer';

export const ensureUserProfile = async (firebaseUser: FirebaseAuthUser): Promise<User> => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);
  const role = getRoleForEmail(firebaseUser.email);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Driver',
      email: firebaseUser.email || '',
      phone: firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const fresh = await getDoc(userRef);
    return fresh.exists() ? (fresh.data() as User) : {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Driver',
      email: firebaseUser.email || '',
      phone: firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      role,
    };
  }

  const existing = snap.data() as User;
  const updates: Partial<User> = {};

  if (firebaseUser.displayName && firebaseUser.displayName !== existing.name) {
    updates.name = firebaseUser.displayName;
  }
  if (firebaseUser.photoURL && firebaseUser.photoURL !== existing.photoURL) {
    updates.photoURL = firebaseUser.photoURL;
  }
  // Never clobber the employee role here - it's granted/revoked by the
  // server-side link route (/api/employee/link), not derived from email.
  if (existing.role !== role && existing.role !== 'employee') {
    updates.role = role;
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() });
    return { ...existing, ...updates };
  }

  return existing;
};

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result;
};

/**
 * Reconcile the employee role via the admin-SDK link route. Returns the
 * profile with role/employeeId applied (promotion AND stale-role revocation).
 * Fails open: on any error the profile is returned unchanged.
 */
export const linkEmployeeRole = async (profile: User): Promise<User> => {
  if (profile.role === 'admin' || !auth.currentUser) return profile;
  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/employee/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return profile;
    const data = await res.json() as { role?: User['role']; employeeId?: string };
    if (data.role && data.role !== profile.role) {
      return { ...profile, role: data.role, employeeId: data.employeeId };
    }
    return profile;
  } catch {
    return profile;
  }
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
};

export const updateUserProfile = async (uid: string, data: Partial<User>) => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  } else {
    return setDoc(ref, { ...data, uid, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
  }
};

