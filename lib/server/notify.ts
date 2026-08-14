import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebaseAdmin';
import { COMPANY } from '@/lib/company';

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
      data: { url: url ?? '/admin' },
      webpush: {
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
        fcmOptions: { link: url ?? '/admin' },
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

/**
 * WhatsApp to the studio's own number.
 *
 * Off unless `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set - the
 * route it mirrors says the same. Lives here rather than beside the booking
 * notifier because the marketplace tells the studio through the same channel,
 * and a second copy would be a second number to keep in step. It calls Meta directly rather than looping
 * back through `/api/whatsapp/send`, because a server calling its own HTTP
 * endpoint depends on knowing its own public origin, which is exactly the sort
 * of thing that works in development and fails on the first deploy.
 */
export async function whatsAppToStudio(message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  const to = `91${COMPANY.phone.replace(/\D/g, '').slice(-10)}`;
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });
  return res.ok;
}
