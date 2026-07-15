'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Phone, MessageCircle, Loader2,
  CheckCircle2, Shield, Zap, FileText, Clock,
} from 'lucide-react';
import ServiceIcon from '@/components/ui/ServiceIcon';
import toast from 'react-hot-toast';
import {
  getAllBookings, updateBookingStatusWithNotification, verifyPayment,
  createInvoiceForBooking, getInvoice, buildInvoiceWhatsAppLink, invoicePublicUrl,
  saveBookingAdminNotes, rescheduleBooking, writeNotification,
} from '@/lib/firebaseService';
import {
  formatCurrency, getStatusColor, getStatusLabel,
  formatDate, formatTime,
} from '@/lib/utils';
import type { Booking, BookingStatus } from '@/lib/types';
import ErrorState from '@/components/ui/ErrorState';

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
    in_progress:        `Your ${b.vehicleName} is now being serviced - ${b.serviceName}.`,
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
  const [loadError, setLoadError]   = useState(false);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected]     = useState<Booking | null>(null);
  const [updating, setUpdating]     = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [invoicing, setInvoicing]   = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    setNotesDraft(selected?.adminNotes ?? '');
    setReschedDate(selected?.scheduledDate ?? '');
    setReschedTime(selected?.scheduledTime ?? '');
  }, [selected?.id]);

  const handleReschedule = async () => {
    if (!selected || !reschedDate || !reschedTime) return;
    setRescheduling(true);
    try {
      await rescheduleBooking(selected.id, reschedDate, reschedTime);
      writeNotification(
        selected.userId, 'Booking rescheduled',
        `${selected.serviceName} moved to ${formatDate(reschedDate)} at ${formatTime(reschedTime)}.`,
        'booking_update', selected.id,
      ).catch(() => {});
      setBookings(prev => prev.map(b => b.id === selected.id
        ? { ...b, scheduledDate: reschedDate, scheduledTime: reschedTime } : b));
      setSelected(prev => prev ? { ...prev, scheduledDate: reschedDate, scheduledTime: reschedTime } : null);
      toast.success('Booking rescheduled');
    } catch { toast.error('Reschedule failed'); }
    setRescheduling(false);
  };

  const saveNotes = async () => {
    if (!selected) return;
    setNotesSaving(true);
    try {
      await saveBookingAdminNotes(selected.id, notesDraft.trim());
      setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, adminNotes: notesDraft.trim() } : b));
      setSelected(prev => prev ? { ...prev, adminNotes: notesDraft.trim() } : null);
      toast.success('Notes saved');
    } catch { toast.error('Could not save notes'); }
    setNotesSaving(false);
  };

  const handleGenerateInvoice = async () => {
    if (!selected) return;
    setInvoicing(true);
    try {
      const inv = selected.invoiceId
        ? await getInvoice(selected.invoiceId)
        : await createInvoiceForBooking(selected);
      if (!inv) throw new Error('missing invoice');
      if (!selected.invoiceId) {
        setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, invoiceId: inv.id } : b));
        setSelected(prev => prev ? { ...prev, invoiceId: inv.id } : null);
        toast.success(`Invoice ${inv.invoiceNumber} created`);
      }
      window.open(invoicePublicUrl(inv), '_blank');
      setTimeout(() => window.open(buildInvoiceWhatsAppLink(inv), '_blank'), 400);
    } catch {
      toast.error('Invoice failed');
    } finally {
      setInvoicing(false);
    }
  };

  const load = () => {
    setLoadError(false);
    setLoading(true);
    getAllBookings()
      .then(b => setBookings(b))
      .catch(e => { console.error('bookings load failed', e); setLoadError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

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
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-900 text-2xl text-foreground tracking-wide">BOOKINGS</h1>
          <p className="text-muted text-sm font-body">
            {filtered.length} of {bookings.length} total
            {pendingPayments > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-display"
                style={{ background: 'var(--smoke)', color: 'var(--chrome)', border: '1px solid var(--border-strong)' }}>
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
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted font-body">No bookings found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.button key={b.id} onClick={() => setSelected(b)}
              initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.99 }}
              className="w-full card-dark text-left hover:border-white/10 transition-all">
              <div className="flex items-start gap-3">
                <span className="grid place-items-center rounded-xl shrink-0"
                  style={{ width: 40, height: 40, background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--chrome)' }}>
                  <ServiceIcon category={b.serviceCategory} size={18} />
                </span>
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
                    <span className={`inline-flex items-center gap-1 ${b.paymentStatus === 'verified' ? 'text-emerald-400' : 'text-muted'}`}>
                      {b.paymentStatus === 'verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {b.paymentStatus === 'verified' ? 'Paid' : 'Unpaid'}
                    </span>
                    {b.usedMembershipWash && (
                      <span className="inline-flex items-center gap-1" style={{ color: 'var(--steel)', fontSize: '10px' }}><Zap size={11} /> Membership</span>
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
                      {
                        l: 'Pickup/Drop',
                        v: !selected.pickupDropRequired ? 'No'
                          : selected.pickupRequired !== undefined
                            ? [selected.pickupRequired && 'Pickup', selected.dropRequired && 'Drop'].filter(Boolean).join(' + ') || 'No'
                            : 'Yes (both)',
                      },
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
                          style={{ background: 'color-mix(in srgb, var(--ember) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--ember) 20%, transparent)' }}>
                          <Zap size={12} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                          <span className="text-xs font-body" style={{ color: 'var(--ember)' }}>
                            Membership wash used - service covered by plan
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selected.pickupDropRequired && selected.pickupAddress && (
                  <div className="glass rounded-2xl p-4 mb-4">
                    <p className="text-muted text-xs font-body tracking-widest uppercase mb-1">Pickup Address</p>
                    <p className="text-foreground text-sm font-body">{selected.pickupAddress}</p>
                  </div>
                )}

                {/* ── Reschedule ── */}
                {!['completed', 'cancelled'].includes(selected.status) && (
                  <div className="glass rounded-2xl p-4 mb-4">
                    <p className="text-muted text-xs font-body tracking-widest uppercase mb-2">Reschedule</p>
                    <div className="flex gap-2">
                      <input type="date" className="input text-sm flex-1" value={reschedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setReschedDate(e.target.value)} />
                      <input type="time" className="input text-sm w-32" value={reschedTime}
                        onChange={e => setReschedTime(e.target.value)} />
                    </div>
                    {(reschedDate !== selected.scheduledDate || reschedTime !== selected.scheduledTime) && (
                      <button onClick={handleReschedule} disabled={rescheduling || !reschedDate || !reschedTime}
                        className="btn-ember w-full py-2.5 mt-2 text-xs">
                        {rescheduling ? 'Moving…' : `Move to ${formatDate(reschedDate)} · ${formatTime(reschedTime)}`}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Internal notes ── */}
                <div className="glass rounded-2xl p-4 mb-4">
                  <p className="text-muted text-xs font-body tracking-widest uppercase mb-2">Internal Notes</p>
                  <textarea className="input text-sm" rows={2} value={notesDraft} maxLength={500}
                    onChange={e => setNotesDraft(e.target.value)}
                    placeholder="Only visible to staff - special requests, damage notes…" />
                  {notesDraft !== (selected.adminNotes ?? '') && (
                    <button onClick={saveNotes} disabled={notesSaving}
                      className="btn-ghost w-full py-2 mt-2 text-xs">
                      {notesSaving ? 'Saving…' : 'Save Notes'}
                    </button>
                  )}
                </div>

                {/* ── Payment verification ── */}
                <div className="glass rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted text-xs font-body tracking-widest uppercase mb-1">Payment Status</p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-body font-600 ${selected.paymentStatus === 'verified' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {selected.paymentStatus === 'verified' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          {selected.paymentStatus === 'verified' ? 'Verified' : 'Pending'}
                        </span>
                        {selected.paymentMethod === 'upi' && selected.transactionId && (
                          <span className="text-xs text-muted font-body">UPI</span>
                        )}
                        {selected.paymentMethod === 'cash' && (
                          <span className="text-xs text-muted font-body">Cash</span>
                        )}
                        {selected.usedMembershipWash && selected.totalAmount === 0 && (
                          <span className="text-xs font-body" style={{ color: 'var(--silver)' }}>Membership</span>
                        )}
                      </div>
                    </div>
                    {selected.paymentStatus !== 'verified' && (
                      <button
                        onClick={handleVerifyPayment}
                        disabled={verifying}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-700 tracking-wide transition-all"
                        style={{
                          background: verifying ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--success) 15%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
                          color: 'var(--success)',
                        }}>
                        {verifying
                          ? <Loader2 size={13} className="animate-spin" />
                          : <CheckCircle2 size={13} />}
                        {verifying ? 'Verifying...' : 'Verify'}
                      </button>
                    )}
                    {selected.paymentStatus === 'verified' && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)' }}>
                        <Shield size={12} style={{ color: 'var(--success)' }} />
                        <span className="text-xs font-body" style={{ color: 'var(--success)' }}>Confirmed</span>
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
                            ? 'bg-white/10 border-white/10 text-white'
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
                  {(selected.status === 'completed' || selected.invoiceId) && (
                    <button onClick={handleGenerateInvoice} disabled={invoicing}
                      className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-xs font-display font-700 tracking-widest transition-all"
                      style={{ background: 'var(--smoke)', border: '1px solid var(--border-strong)', color: 'var(--chrome)' }}>
                      {invoicing ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                      {selected.invoiceId ? 'OPEN INVOICE + WHATSAPP' : 'GENERATE INVOICE'}
                    </button>
                  )}
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
