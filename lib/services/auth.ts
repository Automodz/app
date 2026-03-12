import {
  signInWithPopup, signOut, signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, googleProvider } from '../firebase';
import type { User } from '../types';

export const adminLogin = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const fu = result.user;
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'hello.automodz@gmail.com';
  const role = fu.email?.toLowerCase() === adminEmail.toLowerCase() ? 'admin' : 'customer';
  const userRef = doc(db, 'users', fu.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: fu.uid, name: fu.displayName || '', email: fu.email || '',
      phone: fu.phoneNumber || '', photoURL: fu.photoURL || '', role,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      name: fu.displayName || snap.data().name,
      photoURL: fu.photoURL || snap.data().photoURL || '',
      updatedAt: serverTimestamp(),
    });
  }
  return result;
};

export const signInDemo = async (): Promise<User> => ({
  uid: 'demo-user', name: 'Arjun Mehta', email: 'arjun.demo@automodz.in',
  phone: '9876543210', photoURL: '', role: 'demo',
});

export const logoutUser = () => signOut(auth);

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

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);