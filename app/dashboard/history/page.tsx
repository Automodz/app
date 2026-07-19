'use client';
/**
 * Care — every visit, past and present. The list is an index; tapping a
 * visit opens the Live Care tracker (/dashboard/care/[id]), which owns all
 * detail, actions and the live experience. No detail sheet lives here.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, CheckCircle2, Truck } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { BOOKING_STAGE } from '@/lib/cx/care';
import { STATUS_CX, TONE_COLOR } from '@/lib/cx/status';
import ServiceIcon from '@/components/ui/ServiceIcon';
import { EASE } from '@/lib/cx/motion';

const FILTERS = ['All', 'Upcoming', 'Active', 'Completed', 'Cancelled'];

export default function CareListPage() {
  const router = useRouter();
  const { bookings } = useAppStore();
  const [filter, setFilter] = useState('All');

  const filtered = bookings.filter(b => {
    if (filter === 'All')       return true;
    if (filter === 'Upcoming')  return ['pending', 'confirmed'].includes(b.status);
    if (filter === 'Active')    return ['vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'].includes(b.status);
    if (filter === 'Completed') return b.status === 'completed';
    if (filter === 'Cancelled') return b.status === 'cancelled';
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="mb-4">
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
            CARE
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
            Every visit, past and present
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scroll pb-1">
          {FILTERS.map(f => (
            <motion.button key={f} whileTap={{ scale: 0.92 }} onClick={() => setFilter(f)}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl transition-all"
              style={{
                background:    filter === f ? 'var(--ember)' : 'var(--cavern)',
                color:         filter === f ? 'var(--on-accent)' : 'var(--muted)',
                border:        `1px solid ${filter === f ? 'var(--ember)' : 'var(--border-2)'}`,
                fontFamily:    'var(--font-mono)',
                fontSize:      '10px',
                fontWeight:    700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}>
              {f}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'var(--smoke)' }}>
              <Calendar size={36} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              NOTHING HERE YET
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
              Your car’s visits will live here
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
            {filtered.map(b => {
              const cx = STATUS_CX[b.status];
              const active = !['completed', 'cancelled', 'pending', 'confirmed'].includes(b.status);
              return (
                <motion.button
                  key={b.id}
                  variants={{ hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } } }}
                  onClick={() => router.push(`/dashboard/care/${b.id}`)}
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
                        <span className="shrink-0 px-2.5 py-1 rounded-full font-mono inline-flex items-center gap-1.5"
                          style={{
                            fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: TONE_COLOR[cx.tone],
                            background: `color-mix(in srgb, ${TONE_COLOR[cx.tone]} 10%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${TONE_COLOR[cx.tone]} 25%, transparent)`,
                          }}>
                          {active && <span className="w-1 h-1 rounded-full animate-ping" style={{ background: TONE_COLOR[cx.tone] }} />}
                          {cx.label}
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
                        <span className="inline-flex items-center gap-1">
                          {b.paymentStatus === 'verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {b.paymentStatus === 'verified' ? 'Paid' : 'Pending'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Live progress for active visits — same model as the tracker */}
                  {active && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border-2)' }}>
                        <div className="h-full rounded-full" style={{
                          width: `${Math.round(BOOKING_STAGE[b.status].base * 100)}%`,
                          background: TONE_COLOR[cx.tone],
                        }} />
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
