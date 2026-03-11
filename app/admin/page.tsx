'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, TrendingUp, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getAllBookings, getAdminStats } from '@/lib/firebaseService';
import { formatCurrency, getStatusColor, getStatusLabel, formatDate, getCategoryIcon } from '@/lib/utils';
import type { Booking } from '@/lib/types';

interface Stats {
  totalBookings: number;
  todayBookings: number;
  totalCustomers: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, bookings] = await Promise.all([
          getAdminStats(),
          getAllBookings(),
        ]);
        setStats(statsData);
        setRecentBookings(bookings.slice(0, 8));
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  const pendingBookings = recentBookings.filter(b => b.status === 'pending');

  const STAT_CARDS = stats ? [
    { label: "Today's Bookings", value: stats.todayBookings, icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Total Revenue', value: formatCurrency(stats.revenue), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
      ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">DASHBOARD</h1>
        <p className="text-muted text-sm font-body">Welcome back, {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Alerts */}
      {pendingBookings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 glass-orange rounded-xl p-3 flex items-center gap-3 border border-orange-500/20">
          <AlertCircle size={16} className="text-orange-500 shrink-0" />
          <span className="text-foreground text-sm font-body flex-1">
            {pendingBookings.length} booking{pendingBookings.length > 1 ? 's' : ''} waiting for confirmation
          </span>
          <Link href="/admin/bookings" className="text-orange-500 text-xs font-body hover:underline">View →</Link>
        </motion.div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-dark h-24 shimmer rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {STAT_CARDS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} className="card-dark">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div className={`font-display font-900 text-2xl ${s.color}`}>{s.value}</div>
              <div className="text-muted text-xs font-body mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent Bookings */}
      <div className="card-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-800 text-base text-foreground tracking-wide">RECENT BOOKINGS</h2>
          <Link href="/admin/bookings" className="text-orange-500 text-xs font-body hover:underline flex items-center gap-1">
            View All <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="text-center py-8 text-muted font-body text-sm">No bookings yet</div>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}>
                <Link href="/admin/bookings">
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/3 transition-colors border border-transparent hover:border-theme">
                    <span className="text-lg">{getCategoryIcon(b.serviceCategory)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm text-foreground font-500 truncate">{b.userName}</div>
                      <div className="text-muted text-xs font-body">{b.serviceName} • {formatDate(b.scheduledDate)}</div>
                    </div>
                    <div className="text-right">
                      <span className={`status-badge text-xs ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                      <div className="font-display font-700 text-xs text-foreground mt-1">{formatCurrency(b.totalAmount)}</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
