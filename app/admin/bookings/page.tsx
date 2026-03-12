'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Phone, MessageCircle, Loader2,
  CheckCircle2, Shield, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAllBookings, updateBookingStatusWithNotification, verifyPayment,
} from '@/lib/firebaseService';
import {
  formatCurrency, getStatusColor, getStatusLabel,
  formatDate, formatTime, getCategoryIcon,
} from '@/lib/utils';
import type { Booking, BookingStatus } from '@/lib/types';

const STATUSES: BookingStatus[] = [
  'pending', 'confirmed', 'vehicle_received',
  'in_progress', 'quality_check', 'ready_for_delivery',
  'completed', 'cancelled',
];

// WhatsApp message for status updates
const statusWhatsApp = (b: Booking, status: BookingStatus) => {
  const msgs: Partial<Record<BookingStatus, string>> = {
    confirmed:          `Booking confirmed for ${b.serviceName} on ${formatDate(b.scheduledDate)} at ${formatTime(b.scheduledTime)}.`,
    vehicle_received:   `We've received your ${b.vehicleName}. Work begins shortly.`,
    in_progress:        `Your ${b.vehicleName} is now being serviced — ${b.serviceName}.`,
    quality_check:      `Final quality check underway. Almost ready!`,
    ready_for_delivery: `Your ${b.vehicleName} is ready for pickup at AutoModz, Maninagar!`,
    completed:          `${b.serviceName} completed on your ${b.vehicleName}. Thank you!`,
    cancelled:          `Your booking for ${b.serviceName} has been cancelled. Contact us for rescheduling.`,
  };
  const body = msgs[status];
  if (!body) return null;
  const phone = b.userPhone.startsWith('91') ? b.userPhone : '91' + b.userPhone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`*AutoModz Update*\n\nDear ${b.userName},\n\n${body}\n\nAutoModz, Bhairavnath Rd, Maninagar, Ahmedabad`)}`;
};

export default function AdminBookingsPage() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected]     = useState<Booking | null>(null);
  const [updating, setUpdating]     = useState(false);
  const [verifying, setVerifying]   = useState(false);

  useEffect(() => {
    getAllBookings().then(b => { setBookings(b); setLoading(false); });
  }, []);

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.userName.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
      b.serviceName.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicleRegNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusUpdate = async (bookingId: string, status: BookingStatus) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    setUpdating(true);
    try {
      await updateBookingStatusWithNotification(
        {
          id: booking.id,
          userId: booking.userId,
          vehicleId: booking.vehicleId,
          vehicleName: booking.vehicleName,
          vehicleRegNo: booking.vehicleRegNo,
          serviceId: booking.serviceId,
          serviceName: booking.serviceName,
          serviceCategory: booking.serviceCategory,
          serviceBasePrice: booking.serviceBasePrice,
          serviceDurationMinutes: booking.serviceDurationMinutes,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        },
        status,
      );
      // update local state
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
      if (selected?.id === bookingId) setSelected(prev => prev ? { ...prev, status } : null);
      toast.success(`Status → ${getStatusLabel(status)}`);

      // open WhatsApp for key milestones
      if (['confirmed', 'ready_for_delivery', 'completed', 'cancelled'].includes(status)) {
        const waUrl = statusWhatsApp({ ...booking, status }, status);
        if (waUrl) setTimeout(() => window.open(waUrl, '_blank'), 400);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!selected) return;
    setVerifying(true);
    try {
      await verifyPayment(selected.id);
      setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, paymentStatus: 'verified' } : b));
      setSelected(prev => prev ? { ...prev, paymentStatus: 'verified' } : null);
      toast.success('Payment verified');
    } catch {
      toast.error('Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  };

  // pending payment count for badge
  const pendingPayments = bookings.filter(b => b.paymentStatus === 'pending' && b.status !== 'cancelled').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">BOOKINGS</h1>
          <p className="text-muted text-sm font-body">
            {filtered.length} of {bookings.length} total
            {pendingPayments > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-display"
                style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.25)' }}>
                {pendingPayments} unpaid
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, vehicle, service..."
            className="input-dark pl-9 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-dark text-sm w-auto pr-8 appearance-none cursor-pointer min-w-[130px]">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
        </select>
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted font-body">No bookings found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.button key={b.id} onClick={() => setSelected(b)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.99 }}
              className="w-full card-dark text-left hover:border-orange-500/10 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getCategoryIcon(b.serviceCategory)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-body text-sm text-foreground font-600">{b.userName}</div>
                      <div className="text-muted text-xs font-body truncate">{b.serviceName} • {b.vehicleName}</div>
                    </div>
                    <span className={`status-badge text-xs shrink-0 ${getStatusColor(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs font-body" style={{ color: 'var(--muted)' }}>
                    <span>{formatDate(b.scheduledDate)} {formatTime(b.scheduledTime)}</span>
                    <span>{formatCurrency(b.totalAmount)}</span>
                    <span className={b.paymentStatus === 'verified' ? 'text-emerald-400' : 'text-yellow-400'}>
                      {b.paymentStatus === 'verified' ? '✓ Paid' : '⏳ Unpaid'}
                    </span>
                    {b.usedMembershipWash && (
                      <span style={{ color: '#A78BFA', fontSize: '10px' }}>⚡ Membership</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Booking detail sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)} className="fixed inset-0 bg-black/70 z-40" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-main-2 border-l border-theme z-50 overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-900 text-lg text-foreground tracking-wide">BOOKING DETAIL</h2>
                  <button onClick={() => setSelected(null)}
                    className="w-8 h-8 glass rounded-full flex items-center justify-center">
                    <X size={14} className="text-foreground" />
                  </button>
                </div>

                {/* Booking info grid */}
                <div className="glass rounded-2xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { l: 'Customer',    v: selected.userName },
                      { l: 'Phone',       v: selected.userPhone },
                      { l: 'Vehicle',     v: `${selected.vehicleName} (${selected.vehicleRegNo})` },
                      { l: 'Service',     v: selected.serviceName },
                      { l: 'Date',        v: formatDate(selected.scheduledDate) },
                      { l: 'Time',        v: formatTime(selected.scheduledTime) },
                      { l: 'Amount',      v: formatCurrency(selected.totalAmount) },
                      { l: 'Payment',     v: selected.paymentMethod.toUpperCase() },
                      { l: 'Pickup/Drop', v: selected.pickupDropRequired ? 'Yes' : 'No' },
                    ].map(item => (
                      <div key={item.l}>
                        <div className="text-muted text-xs font-body">{item.l}</div>
                        <div className="text-foreground text-sm font-body font-500 mt-0.5 break-words">{item.v}</div>
                      </div>
                    ))}
                    {selected.transactionId && (
                      <div className="col-span-2">
                        <div className="text-muted text-xs font-body">UPI Transaction ID</div>
                        <div className="text-foreground text-sm font-body font-500 mt-0.5 break-all">{selected.transactionId}</div>
                      </div>
                    )}
                    {selected.usedMembershipWash && (
                      <div className="col-span-2">
                        <div className="rounded-lg px-3 py-2 flex items-center gap-2"
                          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                          <Zap size={12} style={{ color: '#A78BFA', flexShrink: 0 }} />
                          <span className="text-xs font-body" style={{ color: '#A78BFA' }}>
                            Membership wash used — service covered by plan
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Payment verification ── */}
                <div className="glass rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted text-xs font-body tracking-widest uppercase mb-1">Payment Status</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-body font-600 ${selected.paymentStatus === 'verified' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {selected.paymentStatus === 'verified' ? '✓ Verified' : '⏳ Pending'}
                        </span>
                        {selected.paymentMethod === 'upi' && selected.transactionId && (
                          <span className="text-xs text-muted font-body">UPI</span>
                        )}
                        {selected.paymentMethod === 'cash' && (
                          <span className="text-xs text-muted font-body">Cash</span>
                        )}
                        {selected.usedMembershipWash && selected.totalAmount === 0 && (
                          <span className="text-xs font-body" style={{ color: '#A78BFA' }}>Membership</span>
                        )}
                      </div>
                    </div>
                    {selected.paymentStatus !== 'verified' && (
                      <button
                        onClick={handleVerifyPayment}
                        disabled={verifying}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-700 tracking-wide transition-all"
                        style={{
                          background: verifying ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.15)',
                          border: '1px solid rgba(34,197,94,0.3)',
                          color: '#22C55E',
                        }}>
                        {verifying
                          ? <Loader2 size={13} className="animate-spin" />
                          : <CheckCircle2 size={13} />}
                        {verifying ? 'Verifying...' : 'Verify'}
                      </button>
                    )}
                    {selected.paymentStatus === 'verified' && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <Shield size={12} style={{ color: '#22C55E' }} />
                        <span className="text-xs font-body" style={{ color: '#22C55E' }}>Confirmed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Update status ── */}
                <div className="mb-4">
                  <div className="text-muted text-xs font-body mb-2 tracking-widest uppercase">Update Status</div>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUSES.filter(s => s !== 'cancelled').map(s => (
                      <button key={s} onClick={() => handleStatusUpdate(selected.id, s)}
                        disabled={updating || selected.status === s}
                        className={`py-2 px-3 rounded-xl text-xs font-body transition-all border ${
                          selected.status === s
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'glass border-theme text-muted hover:border-white/15'
                        }`}>
                        {updating && selected.status === s
                          ? <Loader2 size={10} className="animate-spin mx-auto" />
                          : getStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Actions ── */}
                <div className="space-y-2">
                  <a href={`https://wa.me/${selected.userPhone.startsWith('91') ? selected.userPhone : '91' + selected.userPhone}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full btn-primary justify-center font-display font-800 tracking-widest text-xs">
                    <MessageCircle size={14} /> WHATSAPP CUSTOMER
                  </a>
                  <a href={`tel:+91${selected.userPhone}`}
                    className="flex items-center gap-2 w-full btn-secondary justify-center font-body text-sm">
                    <Phone size={14} /> Call Customer
                  </a>
                  <button onClick={() => handleStatusUpdate(selected.id, 'cancelled')}
                    disabled={updating || selected.status === 'cancelled'}
                    className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-body hover:bg-red-500/5 transition-colors disabled:opacity-40">
                    Cancel Booking
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
