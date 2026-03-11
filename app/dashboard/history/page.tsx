'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calendar, Clock, CheckCircle2, Circle, RefreshCw, XCircle, Truck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import { cancelBooking } from '@/lib/firebaseService';
import { formatCurrency, getStatusColor, getStatusLabel, formatDate, formatTime, getCategoryIcon, getStatusStep, canCancelBooking } from '@/lib/utils';
import type { Booking } from '@/lib/types';

const FILTERS = ['All', 'Upcoming', 'Active', 'Completed', 'Cancelled'];
const TIMELINE = ['pending','confirmed','vehicle_received','in_progress','quality_check','ready_for_delivery','completed'];

export default function HistoryPage() {
  const router  = useRouter();
  const { bookings, cancelBookingInStore, user } = useAppStore();
  const [filter, setFilter]   = useState('All');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isDemo = user?.role === 'demo';

  const filtered = bookings.filter(b => {
    if (filter === 'All') return true;
    if (filter === 'Upcoming') return ['pending','confirmed'].includes(b.status);
    if (filter === 'Active') return ['vehicle_received','in_progress','quality_check','ready_for_delivery'].includes(b.status);
    if (filter === 'Completed') return b.status === 'completed';
    if (filter === 'Cancelled') return b.status === 'cancelled';
    return true;
  });

  const handleCancel = async () => {
    if (!selected) return;
    setCancelling(true);
    try {
      if (!isDemo) await cancelBooking(selected.id);
      cancelBookingInStore(selected.id);
      toast.success('Booking cancelled');
      setSelected(null); setShowConfirm(false);
    } catch { toast.error('Cancellation failed. Try again.'); }
    finally { setCancelling(false); }
  };

  const currentStep = selected ? getStatusStep(selected.status) : -1;
  const cancelAllowed = selected ? canCancelBooking(selected.scheduledDate, selected.scheduledTime) : false;

  const stagger = { container: { animate: { transition: { staggerChildren: 0.055 } } }, item: { initial: { opacity:0, y:14 }, animate: { opacity:1, y:0, transition: { duration:0.38, ease:[0.22,1,0.36,1] } } } };

  return (
    <div className="min-h-screen bg-mesh">
      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <motion.button whileTap={{ scale:0.88 }} onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
            <ChevronLeft size={16} style={{ color:'var(--fg)' }} />
          </motion.button>
          <div>
            <h1 className="font-display font-800 text-xl text-white tracking-wide">SERVICE HISTORY</h1>
            <p className="font-body text-xs" style={{ color:'var(--muted)' }}>{bookings.length} booking{bookings.length!==1?'s':''}</p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scroll">
          {FILTERS.map(f => (
            <motion.button key={f} whileTap={{ scale:0.92 }} onClick={() => setFilter(f)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl font-display font-700 text-xs tracking-wider uppercase transition-all"
              style={{
                background: filter===f ? 'var(--plasma)' : 'var(--bg-4)',
                color: filter===f ? 'white' : 'var(--muted)',
                boxShadow: filter===f ? '0 3px 14px rgba(255,69,0,0.40)' : 'none',
              }}>
              {f}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:'rgba(255,69,0,0.10)' }}>
              <Calendar size={36} style={{ color:'var(--plasma-hi)' }} />
            </div>
            <h2 className="font-display font-800 text-2xl text-white tracking-wide mb-2">NO BOOKINGS</h2>
            <p className="font-body text-sm mb-8" style={{ color:'var(--muted)' }}>Your service history will appear here</p>
            <button onClick={() => router.push('/dashboard/booking')} className="btn btn-primary text-sm">BOOK A SERVICE</button>
          </div>
        ) : (
          <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-3">
            {filtered.map(b => (
              <motion.button key={b.id} variants={stagger.item} onClick={() => setSelected(b)} whileTap={{ scale:0.98 }}
                className="w-full card rounded-2xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background:'rgba(255,69,0,0.10)' }}>
                    {getCategoryIcon(b.serviceCategory)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-display font-700 text-sm text-white tracking-wide leading-tight">{b.serviceName}</p>
                      <span className={`status-badge ${getStatusColor(b.status)} shrink-0`}>{getStatusLabel(b.status)}</span>
                    </div>
                    <p className="font-body text-xs truncate" style={{ color:'var(--muted)' }}>{b.vehicleName} · {b.vehicleRegNo}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 font-body text-xs" style={{ color:'var(--dust)' }}>
                        <Calendar size={9}/> {formatDate(b.scheduledDate)}
                      </span>
                      <span className="flex items-center gap-1 font-body text-xs" style={{ color:'var(--dust)' }}>
                        <Clock size={9}/> {formatTime(b.scheduledTime)}
                      </span>
                      {b.pickupDropRequired && <Truck size={9} style={{ color:'var(--plasma-hi)' }}/>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-display font-700 text-sm text-white">{formatCurrency(b.totalAmount)}</p>
                    <p className={`font-body text-xs mt-0.5 ${b.paymentStatus==='verified'?'text-emerald-400':'text-yellow-400'}`}>
                      {b.paymentStatus==='verified'?'✓ Paid':'⏳ Pending'}
                    </p>
                  </div>
                </div>
                {!['completed','cancelled'].includes(b.status) && (
                  <div className="mt-3 pt-3" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="flex items-center gap-1">
                      {TIMELINE.slice(0,6).map((_,idx) => (
                        <div key={idx} className="flex-1 h-1 rounded-full transition-colors"
                          style={{ background: idx<=getStatusStep(b.status)?'var(--plasma)':'var(--border-2)' }} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Detail Sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setSelected(null); setShowConfirm(false); }}
              className="fixed inset-0 z-40" style={{ background:'rgba(0,0,0,0.80)', backdropFilter:'blur(8px)' }} />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', damping:30, stiffness:320 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto max-h-[92vh]"
              style={{ background:'var(--bg-3)', borderTop:'1px solid var(--border)' }}>
              <div className="p-5">
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background:'var(--border-2)' }}/>

                {/* Cancel confirm */}
                <AnimatePresence>
                  {showConfirm && (
                    <motion.div initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.94 }}
                      className="rounded-2xl p-5 mb-4 text-center"
                      style={{ background:'rgba(255,59,92,0.08)', border:'1px solid rgba(255,59,92,0.20)' }}>
                      <AlertTriangle size={28} style={{ color:'var(--signal-red)' }} className="mx-auto mb-3"/>
                      <p className="font-display font-800 text-base text-white tracking-wide mb-1">CANCEL BOOKING?</p>
                      <p className="font-body text-xs mb-4" style={{ color:'var(--muted)' }}>This cannot be undone. Your slot will be released.</p>
                      <div className="flex gap-3">
                        <button onClick={() => setShowConfirm(false)} className="btn btn-ghost flex-1 rounded-xl py-3 text-sm">Keep It</button>
                        <button onClick={handleCancel} disabled={cancelling}
                          className="flex-1 rounded-xl py-3 font-display font-800 tracking-wider text-sm flex items-center justify-center gap-2"
                          style={{ background:'rgba(255,59,92,0.15)', border:'1px solid rgba(255,59,92,0.30)', color:'#FF6680' }}>
                          {cancelling ? <div className="w-4 h-4 ring" /> : <><XCircle size={14}/> Yes, Cancel</>}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-display font-800 text-xl text-white tracking-wide">{selected.serviceName}</h2>
                    <p className="font-body text-sm mt-0.5" style={{ color:'var(--muted)' }}>{selected.vehicleName} · {selected.vehicleRegNo}</p>
                  </div>
                  <span className={`status-badge ${getStatusColor(selected.status)}`}>{getStatusLabel(selected.status)}</span>
                </div>

                {/* Progress timeline */}
                {selected.status !== 'cancelled' && (
                  <div className="card rounded-2xl p-4 mb-4">
                    <p className="font-mono text-xs tracking-[0.12em] uppercase mb-4" style={{ color:'var(--dust)' }}>Service Progress</p>
                    <div className="space-y-3">
                      {TIMELINE.map((s,idx) => {
                        const done = idx<=currentStep, isCur = idx===currentStep;
                        return (
                          <div key={s} className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-5 shrink-0">
                              {done
                                ? <CheckCircle2 size={18} style={{ color: isCur?'var(--plasma-hi)':'rgba(255,107,0,0.40)' }}/>
                                : <Circle size={18} style={{ color:'var(--border-2)' }}/>}
                              {idx < TIMELINE.length-1 && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-3 mt-0.5 transition-colors"
                                  style={{ background: idx<currentStep?'rgba(255,107,0,0.35)':'var(--border)' }}/>
                              )}
                            </div>
                            <span className="font-body text-sm transition-colors"
                              style={{ color: done ? isCur?'var(--fg)':'var(--fg-3)' : 'var(--dust)', fontWeight: isCur?500:400 }}>
                              {getStatusLabel(s)}
                              {isCur && <span className="ml-2 font-body text-xs" style={{ color:'var(--plasma-hi)' }}>← current</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="card rounded-2xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l:'Date',       v:formatDate(selected.scheduledDate) },
                      { l:'Time',       v:formatTime(selected.scheduledTime) },
                      { l:'Amount',     v:formatCurrency(selected.totalAmount) },
                      { l:'Payment',    v:selected.paymentMethod==='upi'?'UPI':'Cash' },
                      { l:'Booking ID', v:selected.id.slice(0,8).toUpperCase() },
                      { l:'Reg No',     v:selected.vehicleRegNo },
                    ].map(r => (
                      <div key={r.l}>
                        <p className="font-body text-xs" style={{ color:'var(--muted)' }}>{r.l}</p>
                        <p className="font-body text-sm font-500 text-white mt-0.5">{r.v}</p>
                      </div>
                    ))}
                  </div>
                  {selected.pickupDropRequired && (
                    <div className="mt-3 pt-3 flex items-center gap-2 font-body text-xs"
                      style={{ borderTop:'1px solid var(--border)', color:'var(--plasma-hi)' }}>
                      <Truck size={12}/> Pickup & drop (+{formatCurrency(selected.pickupDropFee||100)})
                    </div>
                  )}
                  {selected.transactionId && (
                    <div className="mt-2 font-body text-xs" style={{ color:'var(--muted)' }}>
                      UPI Txn: <span className="text-white font-mono">{selected.transactionId}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {selected.status === 'completed' && (
                    <motion.button whileTap={{ scale:0.97 }}
                      onClick={() => { setSelected(null); router.push(`/dashboard/booking?vehicleId=${selected.vehicleId}&serviceId=${selected.serviceId}`); }}
                      className="btn btn-primary w-full py-3.5 text-sm rounded-2xl flex items-center justify-center gap-2">
                      <RefreshCw size={15}/> BOOK AGAIN
                    </motion.button>
                  )}
                  {['pending','confirmed'].includes(selected.status) && !showConfirm && (
                    cancelAllowed ? (
                      <motion.button whileTap={{ scale:0.97 }}
                        onClick={() => setShowConfirm(true)}
                        className="w-full rounded-2xl py-3.5 font-display font-800 tracking-wider text-sm flex items-center justify-center gap-2 transition-colors"
                        style={{ border:'1px solid rgba(255,59,92,0.25)', background:'rgba(255,59,92,0.06)', color:'#FF6680' }}>
                        <XCircle size={15}/> CANCEL BOOKING
                      </motion.button>
                    ) : (
                      <div className="rounded-2xl p-3 text-center font-body text-xs"
                        style={{ background:'rgba(255,59,92,0.06)', border:'1px solid rgba(255,59,92,0.15)', color:'#FF6680' }}>
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
