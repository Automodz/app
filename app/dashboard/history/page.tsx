'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Calendar, Clock, CheckCircle2, Circle,
  RefreshCw, XCircle, Truck, AlertTriangle, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import { cancelBooking, rescheduleBooking, getBookedSlotsForDate, fireOpsEvent, logActivity } from '@/lib/firebaseService';
import {
  formatCurrency, getStatusColor, getStatusLabel,
  formatDate, formatTime,
  getStatusStep, canCancelBooking,
  generateTimeSlots, getAvailableDates,
} from '@/lib/utils';
import type { Booking } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';

const FILTERS  = ['All', 'Upcoming', 'Active', 'Completed', 'Cancelled'];
const TIMELINE = ['pending', 'confirmed', 'vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery', 'completed'];

export default function HistoryPage() {
  const router  = useRouter();
  const { bookings, cancelBookingInStore, user } = useAppStore();

  const [filter, setFilter]       = useState('All');
  const [selected, setSelected]   = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedSlots, setReschedSlots] = useState<string[]>([]);
  const [reschedBusy, setReschedBusy] = useState(false);

  // Reset + load booked slots for the reschedule picker
  useEffect(() => { setReschedOpen(false); setReschedDate(''); setReschedTime(''); }, [selected?.id]);
  useEffect(() => {
    if (!reschedDate || !selected) return;
    getBookedSlotsForDate(reschedDate, selected.serviceCategory, selected.serviceDurationMinutes ?? 60)
      .then(setReschedSlots)
      .catch(() => setReschedSlots([]));
  }, [reschedDate, selected?.id]);

  const handleReschedule = async () => {
    if (!selected || !reschedDate || !reschedTime) return;
    setReschedBusy(true);
    try {
      await rescheduleBooking(selected.id, reschedDate, reschedTime);
      const { bookings: all, setBookings } = useAppStore.getState();
      setBookings(all.map(b => b.id === selected.id
        ? { ...b, scheduledDate: reschedDate, scheduledTime: reschedTime } : b));
      setSelected(prev => prev ? { ...prev, scheduledDate: reschedDate, scheduledTime: reschedTime } : null);
      setReschedOpen(false);
      toast.success(`Moved to ${formatDate(reschedDate)} · ${formatTime(reschedTime)}`);
    } catch {
      toast.error('Reschedule failed. Try again.');
    } finally {
      setReschedBusy(false);
    }
  };

  const filtered = bookings.filter(b => {
    if (filter === 'All')       return true;
    if (filter === 'Upcoming')  return ['pending', 'confirmed'].includes(b.status);
    if (filter === 'Active')    return ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'].includes(b.status);
    if (filter === 'Completed') return b.status === 'completed';
    if (filter === 'Cancelled') return b.status === 'cancelled';
    return true;
  });

  const handleCancel = async () => {
    if (!selected) return;
    setCancelling(true);
    try {
      await cancelBooking(selected.id);
      cancelBookingInStore(selected.id);
      // studio gets notified + the job timeline records it - fire-and-forget
      fireOpsEvent('booking_cancelled', selected.id);
      logActivity({
        type: 'cancelled', title: 'Cancelled by customer',
        bookingId: selected.id, customerId: selected.userId,
        actor: { id: selected.userId, name: user?.name || 'Customer' },
      });
      toast.success('Booking cancelled');
      setSelected(null);
      setShowConfirm(false);
    } catch {
      toast.error('Cancellation failed. Try again.');
    } finally {
      setCancelling(false);
    }
  };

  const closeSheet    = () => { setSelected(null); setShowConfirm(false); };
  const currentStep   = selected ? getStatusStep(selected.status) : -1;
  const cancelAllowed = selected ? canCancelBooking(selected.scheduledDate, selected.scheduledTime) : false;

  const mono10 = {
    fontFamily: 'var(--font-mono)', fontSize: '10px',
    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    color: 'var(--faint)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl card flex items-center justify-center">
            <ChevronLeft size={16} style={{ color: 'var(--pewter)' }} />
          </motion.button>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
              SERVICE HISTORY
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
              {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scroll pb-1">
          {FILTERS.map(f => (
            <motion.button key={f} whileTap={{ scale: 0.92 }} onClick={() => setFilter(f)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl transition-all"
              style={{
                background:    filter === f ? 'var(--ember)' : 'var(--cavern)',
                color:         filter === f ? 'var(--on-accent)' : 'var(--muted)',
                border:        `1px solid ${filter === f ? 'var(--ember)' : 'var(--border-2)'}`,
                fontFamily:    'var(--font-mono)',
                fontSize:      '10px',
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                boxShadow:     filter === f ? '0 3px 14px rgba(255,255,255,0.35)' : 'none',
              }}>
              {f}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'var(--smoke)' }}>
              <Calendar size={36} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              NO BOOKINGS
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
              Your service history will appear here
            </p>
            <button onClick={() => router.push('/dashboard/booking')} className="btn-ember rounded-xl px-8 py-3">
              BOOK A SERVICE
            </button>
          </div>
        ) : (
          <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.055 } } }}
            className="space-y-3">
            {filtered.map(b => (
              <motion.button
                key={b.id}
                variants={{ hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } } }}
                onClick={() => setSelected(b)}
                whileTap={{ scale: 0.98 }}
                className="w-full card rounded-2xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--smoke)', color: 'var(--chrome)' }}>
                    <ServiceIcon category={b.serviceCategory} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)', letterSpacing: '0.03em', lineHeight: 1.3 }}>
                        {b.serviceName}
                      </p>
                      <span className={`status-badge ${getStatusColor(b.status)} shrink-0`}>
                        {getStatusLabel(b.status)}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)' }} className="truncate">
                      {b.vehicleName} · {b.vehicleRegNo}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--steel)' }}>
                        <Calendar size={9} /> {formatDate(b.scheduledDate)}
                      </span>
                      <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--steel)' }}>
                        <Clock size={9} /> {formatTime(b.scheduledTime)}
                      </span>
                      {b.pickupDropRequired && <Truck size={9} style={{ color: 'var(--ember)' }} />}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>
                      {formatCurrency(b.totalAmount)}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', marginTop: '2px', color: b.paymentStatus === 'verified' ? 'var(--success)' : 'var(--warning)' }}>
                      <span className="inline-flex items-center gap-1">{b.paymentStatus === 'verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />} {b.paymentStatus === 'verified' ? 'Paid' : 'Pending'}</span>
                    </p>
                  </div>
                </div>

                {/* Progress bar for active bookings */}
                {!['completed', 'cancelled'].includes(b.status) && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-1">
                      {TIMELINE.slice(0, 6).map((_, idx) => (
                        <div key={idx} className="flex-1 h-1 rounded-full transition-colors"
                          style={{ background: idx <= getStatusStep(b.status) ? 'var(--ember)' : 'var(--border-2)' }} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Detail bottom sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeSheet}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }} />

            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto safe-sheet"
              style={{ background: 'var(--deep)', borderTop: '1px solid var(--border-2)' }}>
              <div className="p-5">
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border-2)' }} />

                {/* Cancel confirm */}
                <AnimatePresence>
                  {showConfirm && (
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      className="rounded-2xl p-5 mb-4 text-center"
                      style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
                      <AlertTriangle size={28} style={{ color: 'var(--signal-red)' }} className="mx-auto mb-3" />
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        CANCEL BOOKING?
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
                        This cannot be undone. Your slot will be released.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setShowConfirm(false)}
                          className="btn-ghost flex-1 rounded-xl py-3">
                          Keep It
                        </button>
                        <button onClick={handleCancel} disabled={cancelling}
                          className="flex-1 rounded-xl py-3 flex items-center justify-center gap-2 transition-all"
                          style={{
                            background: 'color-mix(in srgb, var(--danger) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                            color: 'var(--danger)', fontFamily: 'var(--font-display)', fontWeight: 800,
                            fontSize: '13px', letterSpacing: '0.08em',
                          }}>
                          {cancelling
                            ? <div className="w-4 h-4 loader-ring" />
                            : <><XCircle size={14} /> Yes, Cancel</>}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Booking header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.03em' }}>
                      {selected.serviceName}
                    </h2>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                      {selected.vehicleName} · {selected.vehicleRegNo}
                    </p>
                  </div>
                  <span className={`status-badge ${getStatusColor(selected.status)}`}>
                    {getStatusLabel(selected.status)}
                  </span>
                </div>

                {/* Progress timeline */}
                {selected.status !== 'cancelled' && (
                  <div className="card rounded-2xl p-4 mb-4">
                    <p style={{ ...mono10, marginBottom: '16px' }}>Service Progress</p>
                    <div className="space-y-3">
                      {TIMELINE.map((s, idx) => {
                        const done  = idx <= currentStep;
                        const isCur = idx === currentStep;
                        return (
                          <div key={s} className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-5 shrink-0">
                              {done
                                ? <CheckCircle2 size={18} style={{ color: isCur ? 'var(--ember)' : 'var(--silver)' }} />
                                : <Circle size={18} style={{ color: 'var(--border-2)' }} />}
                              {idx < TIMELINE.length - 1 && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-3 mt-0.5"
                                  style={{ background: idx < currentStep ? 'var(--silver)' : 'var(--border)' }} />
                              )}
                            </div>
                            <span style={{
                              fontFamily: 'var(--font-body)', fontSize: '13px',
                              color: done ? (isCur ? 'var(--fg)' : 'var(--muted)') : 'var(--steel)',
                              fontWeight: isCur ? 600 : 400,
                            }}>
                              {getStatusLabel(s)}
                              {isCur && (
                                <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ember)' }}>
                                  ← current
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Details grid */}
                <div className="card rounded-2xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      ['Date',       formatDate(selected.scheduledDate)],
                      ['Time',       formatTime(selected.scheduledTime)],
                      ['Amount',     formatCurrency(selected.totalAmount)],
                      ['Payment',    selected.paymentMethod === 'upi' ? 'UPI' : 'Cash'],
                      ['Booking ID', selected.id.slice(0, 8).toUpperCase()],
                      ['Reg No',     selected.vehicleRegNo],
                    ] as [string, string][]).map(([l, v]) => (
                      <div key={l}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--muted)' }}>{l}</p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--fg-dim)', marginTop: '2px' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {selected.pickupDropRequired && (
                    <div className="mt-3 pt-3 flex items-center gap-2"
                      style={{ borderTop: '1px solid var(--border)', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--ember)' }}>
                      <Truck size={12} />
                      {selected.pickupRequired !== undefined
                        ? [selected.pickupRequired && 'Pickup', selected.dropRequired && 'Drop'].filter(Boolean).join(' + ')
                        : 'Pickup & drop'} (+{formatCurrency(selected.pickupDropFee || 100)})
                    </div>
                  )}
                  {selected.transactionId && (
                    <div className="mt-2" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)' }}>
                      UPI Txn: <span style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{selected.transactionId}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pb-6">
                  {selected.status === 'completed' && (
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        closeSheet();
                        router.push(`/dashboard/booking?vehicleId=${selected.vehicleId}&serviceId=${selected.serviceId}`);
                      }}
                      className="btn-ember w-full py-3.5 rounded-2xl flex items-center justify-center gap-2">
                      <RefreshCw size={15} /> BOOK AGAIN
                    </motion.button>
                  )}

                  {/* Reschedule - same 4h rule as cancel */}
                  {['pending', 'confirmed'].includes(selected.status) && !showConfirm && cancelAllowed && (
                    <div>
                      {!reschedOpen ? (
                        <motion.button whileTap={{ scale: 0.97 }}
                          onClick={() => setReschedOpen(true)}
                          className="btn-ghost w-full py-3.5 rounded-2xl flex items-center justify-center gap-2">
                          <CalendarClock size={15} /> RESCHEDULE
                        </motion.button>
                      ) : (
                        <motion.div initial={false} animate={{ opacity: 1, height: 'auto' }}
                          className="card rounded-2xl p-4 overflow-hidden">
                          <p style={{ ...mono10, marginBottom: '10px' }}>Pick a new date</p>
                          <div className="flex gap-2 overflow-x-auto no-scroll pb-2">
                            {getAvailableDates().map(d => {
                              const dt = new Date(d + 'T12:00:00');
                              const sel = reschedDate === d;
                              return (
                                <button key={d} onClick={() => { setReschedDate(d); setReschedTime(''); }}
                                  className="flex-shrink-0 w-14 rounded-xl p-2 flex flex-col items-center gap-0.5"
                                  style={{
                                    background: sel ? 'var(--ember)' : 'var(--dark)',
                                    border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                                  }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)' }}>
                                    {dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: sel ? 'var(--on-accent)' : 'var(--chrome)', lineHeight: 1 }}>
                                    {dt.getDate()}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {reschedDate && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              {generateTimeSlots(selected.serviceDurationMinutes ?? 60).map(t => {
                                const sel = reschedTime === t;
                                const taken = reschedSlots.includes(t) || (reschedDate === selected.scheduledDate && t === selected.scheduledTime);
                                return (
                                  <button key={t} disabled={taken} onClick={() => setReschedTime(t)}
                                    className="rounded-xl py-2.5"
                                    style={{
                                      background: sel ? 'var(--ember)' : 'var(--dark)',
                                      border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                                      fontFamily: 'var(--font-body)', fontSize: '12px',
                                      color: sel ? 'var(--on-accent)' : taken ? 'var(--faint)' : 'var(--pewter)',
                                      opacity: taken ? 0.4 : 1,
                                      textDecoration: taken ? 'line-through' : 'none',
                                    }}>
                                    {formatTime(t)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => setReschedOpen(false)} className="btn-ghost flex-1 py-3 text-xs">Back</button>
                            <button onClick={handleReschedule} disabled={!reschedDate || !reschedTime || reschedBusy}
                              className="btn-ember flex-1 py-3 text-xs">
                              {reschedBusy ? 'Moving…' : 'Confirm New Slot'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {['pending', 'confirmed'].includes(selected.status) && !showConfirm && !reschedOpen && (
                    cancelAllowed ? (
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => setShowConfirm(true)}
                        className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-colors"
                        style={{
                          border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)',
                          color: 'var(--danger)', fontFamily: 'var(--font-display)', fontWeight: 800,
                          fontSize: '13px', letterSpacing: '0.08em',
                        }}>
                        <XCircle size={15} /> CANCEL BOOKING
                      </motion.button>
                    ) : (
                      <div className="rounded-2xl p-3 text-center"
                        style={{ background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--danger)' }}>
                        ⏰ Cancellations only allowed 4+ hours before the appointment
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}