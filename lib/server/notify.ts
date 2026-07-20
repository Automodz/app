import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebaseAdmin';

/** Web-push to one user's registered devices (best-effort, prunes dead tokens). */
export const pushToUser = async (userId: string, title: string, body: string, url?: string) => {
  try {
    const tokensSnap = await adminDb!.collection('users').doc(userId).collection('fcmTokens').get();
    const tokens = tokensSnap.docs.map(d => d.id);
    if (tokens.length === 0) return 0;
    const messaging = getMessaging(getApps()[0]);
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { url: url ?? '/app' },
      webpush: {
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
        fcmOptions: { link: url ?? '/app' },
      },
    });
    await Promise.all(res.responses.map((r, i) => {
      const code = (r.error as { code?: string } | undefined)?.code ?? '';
      if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))) {
        return adminDb!.collection('users').doc(userId).collection('fcmTokens').doc(tokens[i]).delete();
      }
      return Promise.resolve();
    }));
    return res.successCount;
  } catch {
    return 0;
  }
};

/**
 * Ops notification to every admin: in-app doc + web push + send log.
 * Idempotent per kind+dedupeKey - safe to fire from client-triggered routes.
 */
export const notifyAdmins = async (
  kind: string, title: string, body: string,
  opts?: { url?: string; dedupeKey?: string },
) => {
  const dedupe = opts?.dedupeKey ?? new Date().toISOString().slice(0, 10);
  const admins = await adminDb!.collection('users').where('role', '==', 'admin').get();
  let created = 0;
  for (const a of admins.docs) {
    const id = `ops_${a.id}_${kind}_${dedupe}`;
    const ref = adminDb!.collection('notifications').doc(id);
    if ((await ref.get()).exists) continue;
    await ref.set({
      userId: a.id, title, body, type: 'ops', read: false, createdAt: new Date(),
    });
    await pushToUser(a.id, title, body, opts?.url ?? '/admin');
    await adminDb!.collection('notificationLog').add({
      userId: a.id, kind, channel: 'in_app+push', title,
      date: new Date().toISOString().slice(0, 10), at: new Date(),
    });
    created++;
  }
  return created;
};
