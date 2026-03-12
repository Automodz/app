'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, Bell, Tag, Calendar } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { markNotificationRead } from '@/lib/firebaseService';
import type { Notification } from '@/lib/types';

const typeIcon = (type: string) => {
  if (type === 'booking_update') return Calendar;
  if (type === 'promotion') return Tag;
  return Bell;
};

const typeColor = (type: string) => {
  if (type === 'booking_update') return 'var(--ember)';
  if (type === 'promotion') return '#22C55E';
  return '#38BDF8';
};

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, setNotifications, setUnreadCount, user } = useAppStore();
  const isDemo = user?.role === 'demo';

  const markRead = async (n: Notification) => {
    if (n.read) return;
    if (!isDemo) {
      try { await markNotificationRead(n.id); } catch {}
    }
    const updated = notifications.map(x => x.id === n.id ? { ...x, read: true } : x);
    setNotifications(updated);
    setUnreadCount(updated.filter(x => !x.read).length);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl card flex items-center justify-center">
            <ChevronLeft size={16} style={{ color: 'var(--pewter)' }} />
          </motion.button>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
              NOTIFICATIONS
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
              {notifications.filter(n => !n.read).length} unread
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'rgba(255,69,0,0.10)' }}>
              <Bell size={28} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              ALL CLEAR
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)' }}>
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n, i) => {
              const Icon  = typeIcon(n.type);
              const color = typeColor(n.type);
              return (
                <motion.button
                  key={n.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => markRead(n)}
                  whileTap={{ scale: 0.98 }}
                  className="w-full card rounded-2xl p-4 text-left relative overflow-hidden"
                  style={{ opacity: n.read ? 0.6 : 1 }}>

                  {/* Unread dot */}
                  {!n.read && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full animate-breathe"
                      style={{ background: 'var(--ember)' }} />
                  )}

                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}18` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)', letterSpacing: '0.03em', lineHeight: 1.3, marginBottom: '4px' }}>
                        {n.title}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                        {n.body}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--steel)', marginTop: '6px' }}>
                        {n.createdAt?.toDate
                          ? n.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}