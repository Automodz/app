'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Phone, Car, CalendarDays } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatTime, getStatusColor, getStatusLabel, getCategoryIcon } from '@/lib/utils';
import type { Booking } from '@/lib/types';

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9);
const CAT_COLORS: Record<string, string> = {
  PPF: '#FF6B00', Ceramic: '#60A5FA', Washing: '#34D399', Coating: '#A78BFA',
};

export default function AdminSchedulePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'bookings'),
      where('scheduledDate', '==', selectedDate),
      orderBy('scheduledTime', 'asc')
    );
    getDocs(q).then(snap => {
      setBookings(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
          .filter(b => b.status !== 'cancelled')
      );
      setLoading(false);
    });
  }, [selectedDate]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const displayDate = new Date(selectedDate + 'T12:00:00');
  const byHour = (h: number) => bookings.filter(b => parseInt(b.scheduledTime?.split(':')[0] || '0') === h);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">SCHEDULE</h1>
        <p className="text-muted text-sm font-body flex items-center gap-2">
          {displayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-body">Today</span>}
        </p>
      </div>

      {/* 7-day date strip */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scroll pb-1">
        {days.map(d => {
          const dt = new Date(d + 'T12:00:00');
          const isSelected = d === selectedDate;
          return (
            <button key={d} onClick={() => setSelectedDate(d)}
              className={`flex-shrink-0 w-14 rounded-2xl p-2.5 flex flex-col items-center gap-1 transition-all border ${
                isSelected ? 'bg-orange-500 border-transparent' : 'card'
              }`}>
              <span className={`text-[10px] font-body ${isSelected ? 'text-white/70' : 'text-muted'}`}>
                {dt.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className={`font-display font-900 text-xl leading-none ${isSelected ? 'text-white' : 'text-foreground'}`}>
                {dt.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={28} className="text-orange-400" />
          </div>
          <p className="font-display font-800 text-lg text-foreground">No bookings</p>
          <p className="text-muted text-sm font-body mt-1">Nothing scheduled for this day</p>
        </div>
      ) : (
        <div>
          {/* Timeline */}
          {HOURS.map(hour => {
            const slots = byHour(hour);
            return (
              <div key={hour} className={`flex gap-4 ${slots.length ? 'py-2' : 'py-1.5 opacity-20'}`}>
                <div className="w-10 shrink-0 text-right pt-2">
                  <span className="text-[11px] font-body text-muted">{hour}:00</span>
                </div>
                <div className="flex-1">
                  {slots.length === 0 ? (
                    <div className="flex items-center h-7">
                      <div className="w-full h-px" style={{ background: 'var(--border)' }} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((b, i) => {
                        const accent = CAT_COLORS[b.serviceCategory] || '#FF6B00';
                        return (
                          <motion.div key={b.id}
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="card rounded-2xl p-3 flex items-center gap-3"
                            style={{ borderLeft: `3px solid ${accent}` }}>
                            <div className="text-lg w-8 text-center shrink-0">{getCategoryIcon(b.serviceCategory)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-body text-sm font-600 text-foreground">{b.userName}</span>
                                <span className={`badge ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
                              </div>
                              <div className="text-xs font-body text-muted mt-0.5 flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1"><Clock size={9} />{formatTime(b.scheduledTime)}</span>
                                <span className="flex items-center gap-1"><Car size={9} />{b.vehicleName}</span>
                                <span style={{ color: accent }}>{b.serviceName}</span>
                              </div>
                            </div>
                            <a href={`tel:+91${b.userPhone}`}
                              className="w-9 h-9 rounded-xl glass flex items-center justify-center shrink-0">
                              <Phone size={13} className="text-muted" />
                            </a>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Day summary */}
          <div className="mt-6 card rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Total Jobs', val: bookings.length, color: 'text-foreground' },
                { label: 'In Progress', val: bookings.filter(b => b.status === 'in_progress').length, color: 'text-orange-400' },
                { label: 'Completed', val: bookings.filter(b => b.status === 'completed').length, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label}>
                  <div className={`font-display font-900 text-2xl ${s.color}`}>{s.val}</div>
                  <div className="text-muted text-xs font-body">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
