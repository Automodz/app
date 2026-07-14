import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, app } from '../firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const pushSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window &&
  'serviceWorker' in navigator && !!VAPID_KEY;

/**
 * Ask permission and register this device for push.
 * Token saved at users/{uid}/fcmTokens/{token} so the server can fan out.
 */
export const enablePush = async (uid: string): Promise<boolean> => {
  if (!pushSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return false;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return false;

    await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 120),
    });
    try { localStorage.setItem('automodz-push-token', token); } catch {}
    return true;
  } catch (e) {
    console.error('push enable failed', e);
    return false;
  }
};

export const disablePush = async (uid: string) => {
  try {
    const token = localStorage.getItem('automodz-push-token');
    if (token) {
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
      localStorage.removeItem('automodz-push-token');
    }
  } catch {}
};

export const pushEnabled = () => {
  try {
    return Notification.permission === 'granted' && !!localStorage.getItem('automodz-push-token');
  } catch { return false; }
};

/** Fire a push to a user via the server (admin session required). Fire-and-forget. */
export const sendPushToUser = async (data: {
  userId: string; title: string; body: string; url?: string;
}) => {
  try {
    const { auth } = await import('../firebase');
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error('push send failed', e);
  }
};
