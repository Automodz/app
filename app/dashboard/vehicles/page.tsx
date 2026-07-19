'use client';
/**
 * My Garage — the digital ownership experience for each car.
 * A vehicle card is a passport: protection state, last visit, lifetime care.
 * Tapping one opens the vehicle sheet — protection validity (derived from
 * completed bookings × the service catalog's warranty), a care timeline,
 * invoices and one-tap rebooking. Everything derives from the customer's
 * own bookings — nothing invented, nothing fetched twice.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import CxSheet from '@/components/cx/CxSheet';
import CxButton from '@/components/cx/CxButton';
import CxVehicleForm from '@/components/cx/CxVehicleForm';
import {
  Plus, Car, Edit3, Trash2, X, Loader2, ChevronLeft, ChevronRight,
  Shield, Sparkles, FileText, CalendarPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { deleteVehicle, getVehicles, getServices } from '@/lib/firebaseService';
import { useAppStore } from '@/lib/store';
import type { Service, Vehicle } from '@/lib/types';
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/utils';
import { deriveProtection } from '@/lib/cx/protection';
import { EASE } from '@/lib/cx/motion';

export default function GaragePage() {
  const router = useRouter();
  const { user, vehicles, removeVehicleFromStore, setVehicles, bookings } = useAppStore();

  // Refresh vehicles + load the service catalog once (warranty lookup)
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    if (!user) return;
    getVehicles(user.uid).then(setVehicles).catch(() => {});
    getServices().then(setServices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detail, setDetail]     = useState<Vehicle | null>(null);

  const openAdd  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setShowForm(true); };

  const historyOf = useMemo(() => (v: Vehicle) =>
    bookings
      .filter(b => b.vehicleId === v.id && b.status !== 'cancelled')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
  [bookings]);

  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);
  const handleDelete = async (v: Vehicle) => {
    if (!user) return;
    setConfirmDelete(null);
    setDetail(null);
    setDeleting(v.id);
    try {
      await deleteVehicle(user.uid, v.id);
      removeVehicleFromStore(v.id);
      toast.success('Vehicle removed');
    } catch {
      toast.error('Failed to delete vehicle.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl card flex items-center justify-center">
              <ChevronLeft size={16} style={{ color: 'var(--pewter)' }} />
            </motion.button>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                MY GARAGE
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={openAdd} aria-label="Add vehicle"
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--ember)', boxShadow: '0 4px 18px var(--accent-glow)' }}>
            <Plus size={18} style={{ color: 'var(--on-accent)' }} />
          </motion.button>
        </div>
      </div>

      <div className="px-4 py-6">
        {vehicles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
              style={{ background: 'var(--smoke)' }}>
              <Car size={36} style={{ color: 'var(--ember)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              EMPTY GARAGE
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
              Add your vehicles to start booking services
            </p>
            <button onClick={openAdd} className="btn-ember rounded-xl px-8 py-3">
              ADD VEHICLE
            </button>
          </div>
        ) : (
          <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            className="space-y-3">
            {vehicles.map(v => {
              const history = historyOf(v);
              const completed = history.filter(b => b.status === 'completed');
              const last = history[0];
              const spend = completed.reduce((s, b) => s + b.totalAmount, 0);
              const protection = deriveProtection(history, services);
              return (
                <motion.button
                  key={v.id}
                  variants={{ hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } } }}
                  onClick={() => setDetail(v)}
                  className="card rounded-2xl p-4 w-full text-left cursor-pointer"
                  style={{ minHeight: 44 }}>
                  {/* passport header: the car's name is the hero */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--chrome)' }}>
                        {v.name}
                      </p>
                      <p className="font-mono mt-0.5" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)' }}>
                        {v.registrationNumber} · {v.category.toUpperCase()}{v.color ? ` · ${v.color.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: 'var(--steel)' }} />
                  </div>

                  {/* protection layers — the reason this page exists */}
                  {(protection.length > 0 || completed.length > 0) && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {protection.map(p => (
                        <span key={p.kind} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono"
                          style={{
                            fontSize: 9.5, letterSpacing: '0.1em',
                            color: p.active ? 'var(--success)' : 'var(--warning)',
                            background: `color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 10%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 25%, transparent)`,
                          }}>
                          {p.kind === 'PPF' ? <Shield size={10} /> : <Sparkles size={10} />}
                          {p.kind.toUpperCase()} {p.active ? 'PROTECTED' : 'EXPIRED'}
                        </span>
                      ))}
                      {completed.length > 0 && (
                        <span className="font-mono ml-auto" style={{ fontSize: 10, color: 'var(--steel)' }}>
                          {completed.length} visit{completed.length === 1 ? '' : 's'} · {formatCurrency(spend)}
                        </span>
                      )}
                    </div>
                  )}
                  {last && (
                    <p className="font-body mt-2" style={{ fontSize: 11.5, color: 'var(--steel)' }}>
                      Last visit · {last.serviceName} · {formatDate(last.scheduledDate)}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Vehicle sheet: the car's story ── */}
      <CxSheet open={!!detail} onClose={() => setDetail(null)} tall title={detail ? detail.name : 'Vehicle'}>
        {detail && (() => {
          const history = historyOf(detail);
          const completed = history.filter(b => b.status === 'completed');
          const spend = completed.reduce((s, b) => s + b.totalAmount, 0);
          const protection = deriveProtection(history, services);
          const lastCat = history[0]?.serviceCategory ?? 'Washing';
          return (
            <div>

                  {/* identity */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="min-w-0">
                      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--chrome)', lineHeight: 1.05 }}>
                        {detail.name}
                      </h2>
                      <p className="font-mono mt-1" style={{ fontSize: 11.5, letterSpacing: '0.12em', color: 'var(--muted)' }}>
                        {detail.registrationNumber} · {detail.category.toUpperCase()}{detail.color ? ` · ${detail.color.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <button onClick={() => setDetail(null)} aria-label="Close"
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
                      <X size={16} style={{ color: 'var(--muted)' }} />
                    </button>
                  </div>

                  {/* protection — the vehicle's shield status */}
                  {protection.length > 0 && (
                    <div className="space-y-2 mb-5">
                      {protection.map(p => (
                        <div key={p.kind} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                          style={{
                            background: `color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 6%, var(--cavern))`,
                            border: `1px solid color-mix(in srgb, ${p.active ? 'var(--success)' : 'var(--warning)'} 22%, transparent)`,
                          }}>
                          {p.kind === 'PPF'
                            ? <Shield size={17} style={{ color: p.active ? 'var(--success)' : 'var(--warning)' }} />
                            : <Sparkles size={17} style={{ color: p.active ? 'var(--success)' : 'var(--warning)' }} />}
                          <div className="flex-1 min-w-0">
                            <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{p.service}</p>
                            <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--steel)' }}>
                              APPLIED {formatDate(p.applied).toUpperCase()}
                              {p.until && ` · ${p.active ? 'PROTECTED UNTIL' : 'EXPIRED'} ${p.until.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase()}`}
                            </p>
                          </div>
                          {!p.active && (
                            <button onClick={() => router.push(`/dashboard/booking?cat=${p.kind}`)}
                              className="font-mono text-[10px] px-3 py-2 rounded-lg shrink-0"
                              style={{ color: 'var(--ember)', background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                              RENEW
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* the numbers that matter */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {[
                      { v: String(completed.length), l: 'Visits' },
                      { v: spend >= 100000 ? `₹${(spend / 100000).toFixed(1)}L` : formatCurrency(spend), l: 'Lifetime care' },
                      { v: history[0] ? formatDate(history[0].scheduledDate) : '—', l: 'Last visit' },
                    ].map(s => (
                      <div key={s.l} className="rounded-2xl px-3 py-3 text-center" style={{ background: 'var(--cavern)', border: '1px solid var(--border)' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--chrome)' }}>{s.v}</p>
                        <p className="font-body text-[10.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{s.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* care timeline */}
                  <p className="font-mono mb-3" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--faint)' }}>CARE TIMELINE</p>
                  {history.length === 0 ? (
                    <p className="font-body text-sm py-4 text-center" style={{ color: 'var(--steel)' }}>
                      No services yet — its story starts with the first booking.
                    </p>
                  ) : (
                    <div className="relative pl-4 mb-6" style={{ borderLeft: '1px solid var(--border-2)' }}>
                      {history.slice(0, 12).map((b, i) => (
                        <motion.div key={b.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 + i * 0.04, duration: 0.35, ease: EASE }}
                          className="relative pb-4 last:pb-0">
                          <span className="absolute rounded-full" style={{
                            left: -20.5, top: 5, width: 9, height: 9,
                            background: b.status === 'completed' ? 'var(--success)' : 'var(--info)',
                            border: '2px solid var(--deep)',
                          }} />
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>{b.serviceName}</p>
                            <p className="font-mono text-[10px] shrink-0" style={{ color: 'var(--faint)' }}>{formatDate(b.scheduledDate)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-body text-xs" style={{ color: 'var(--steel)' }}>
                              {getStatusLabel(b.status)} · {formatCurrency(b.totalAmount)}
                            </p>
                            {b.invoiceId && (
                              <button onClick={() => router.push(`/invoice/${b.invoiceId}`)}
                                className="inline-flex items-center gap-1 font-mono text-[9.5px] px-2 py-1 rounded-md"
                                style={{ color: 'var(--ember)', background: 'var(--accent-mist)' }}>
                                <FileText size={9} /> INVOICE
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* actions */}
                  <CxButton onClick={() => router.push(`/dashboard/booking?cat=${lastCat}`)} className="mb-2">
                    <CalendarPlus size={16} /> BOOK A SERVICE
                  </CxButton>
                  <div className="flex gap-2">
                    <button onClick={() => { setDetail(null); openEdit(detail); }}
                      className="btn-ghost flex-1 py-3 flex items-center justify-center gap-2 text-sm">
                      <Edit3 size={13} /> Edit
                    </button>
                    <button onClick={() => setConfirmDelete(detail)}
                      className="flex-1 py-3 rounded-xl font-body text-sm flex items-center justify-center gap-2"
                      style={{ color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                      {deleting === detail.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Remove
                    </button>
                  </div>
            </div>
          );
        })()}
      </CxSheet>

      {/* Add / Edit bottom sheet */}
      <CxSheet open={showForm} onClose={() => setShowForm(false)} tall title={editing ? 'Edit vehicle' : 'Add vehicle'}>
        <CxVehicleForm
          editing={editing}
          onSaved={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      </CxSheet>

      {/* Delete confirmation */}
      <CxSheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove vehicle">
        {confirmDelete && (
          <div className="text-center pt-2">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}>
              <Trash2 size={20} style={{ color: 'var(--danger)' }} />
            </div>
            <p className="font-display font-700 text-[16px] mb-1" style={{ color: 'var(--chrome)' }}>
              Remove {confirmDelete.name}?
            </p>
            <p className="font-body text-[13px] mb-5" style={{ color: 'var(--muted)' }}>
              Its service history stays saved, but the vehicle leaves your garage.
            </p>
            <div className="flex gap-2">
              <CxButton intent="secondary" onClick={() => setConfirmDelete(null)}>Keep it</CxButton>
              <CxButton intent="danger" onClick={() => handleDelete(confirmDelete)}>Remove</CxButton>
            </div>
          </div>
        )}
      </CxSheet>
    </div>
  );
}
