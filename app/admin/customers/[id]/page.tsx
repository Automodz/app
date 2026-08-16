'use client';
/**
 * Customer 360 - not a CRUD page. One continuous, chronological timeline of
 * everything this customer has ever done (bookings, walk-ins, invoices,
 * memberships), with the operational rail (garage, membership, activity, notes)
 * always visible beside it. No tabs, nothing hidden.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, MessageCircle, Car, Wrench, FileText,
  CreditCard, Pencil, Plus, X, ChevronRight, CalendarClock,
} from 'lucide-react';
import { doc, getDoc, getDocs, updateDoc, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getJobsForCustomer, getInvoicesForCustomer, listCustomerActivity,
  buildInvoiceWhatsAppLink, invoicePublicUrl,
} from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import { authedFetch } from '@/lib/clientSession';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import type { User, Vehicle, Booking, Subscription, Job, Invoice } from '@/lib/types';
import type { ActivityEvent } from '@/lib/services/activity';
import { ActivityTimeline } from '@/components/workspace/parts';

type TimelineItem = {
  id: string;
  at: number;
  icon: typeof Car;
  title: string;
  sub: string;
  amount?: number;
  badge?: { label: string; className?: string; color?: string };
  onOpen?: () => void;
  trailing?: React.ReactNode;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  /* THE TRAIL, WHICH WAS BEING WRITTEN AND NEVER READ. Every act on a job or
     a booking calls `logActivity` with the customer's id on it, and the two
     readers that had surfaces were job- and booking-scoped - so the one
     question this page exists to answer, "what has happened with this
     customer", was the one the log could not be asked. */
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [userSnap, vehiclesSnap, bookingsSnap, subsSnap, customerJobs, customerInvoices] =
      await Promise.all([
        getDoc(doc(db, 'users', id)),
        getDocs(collection(db, 'users', id, 'vehicles')),
        getDocs(query(collection(db, 'bookings'), where('userId', '==', id))),
        getDocs(query(collection(db, 'subscriptions'), where('userId', '==', id))),
        getJobsForCustomer(id),
        getInvoicesForCustomer(id),
      ]);
    if (userSnap.exists()) {
      const u = { uid: userSnap.id, ...userSnap.data() } as User;
      setCustomer(u); setNotes(u.notes ?? '');
      listCustomerActivity(id).then(setActivity).catch(() => setActivity([]));
    }
    setVehicles(vehiclesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    setSubs(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
    setJobs(customerJobs);
    setInvoices(customerInvoices);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const ltv =
    bookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0) +
    jobs.filter(j => j.status === 'completed' && !j.bookingId).reduce((s, j) => s + j.totalAmount, 0) +
    subs.reduce((s, x) => s + (x.status !== 'pending' ? (x.plan === 'Silver' ? 1499 : x.plan === 'Gold' ? 2999 : 5999) : 0), 0);

  const saveNotes = async () => {
    setSavingNotes(true);
    await updateDoc(doc(db, 'users', id), { notes });
    toast.success('Notes saved');
    setSavingNotes(false);
  };

  const openEdit = () => {
    setEditName(customer?.name ?? '');
    setEditPhone(customer?.phone ?? '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (editName.trim().length < 2) { toast.error('Name required'); return; }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'users', id), {
        name: editName.trim(),
        phone: editPhone.replace(/\D/g, '').slice(-10),
      });
      toast.success('Customer updated');
      setEditOpen(false);
      await load();
    } catch { toast.error('Update failed'); }
    setSavingEdit(false);
  };

  /**
   * THE STUDIO STARTS A MEMBERSHIP AT THE COUNTER.
   *
   * This used to assemble the document here - plan, dates, wash count - and
   * write `status: 'active'` straight to Firestore. Two writers meant two
   * chances for the terms to drift from the catalogue, and this copy carried
   * no `amountPaid` at all, so a membership sold at the counter recorded no
   * revenue. One door now, and the terms are derived from the plan.
   */
  const createPlanFor = async (planId: 'Silver' | 'Gold' | 'Platinum') => {
    if (!customer) return;
    setCreatingPlan(planId);
    try {
      const res = await authedFetch('/api/membership', {
        method: 'POST',
        body: JSON.stringify({ userId: id, plan: planId, paymentMethod: 'cash' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' })) as { error?: string };
        toast.error(body.error || 'Could not create membership');
        return;
      }
      toast.success(`${planId} membership started for ${customer.name}`);
      setPlanPickerOpen(false);
      await load();
    } catch { toast.error('Could not create membership'); }
    finally { setCreatingPlan(null); }
  };


  if (loading) return <div className="p-8 flex justify-center"><div className="w-10 h-10 loader-ring" /></div>;
  if (!customer) return <div className="p-8 text-center font-body" style={{ color: 'var(--steel)' }}>Customer not found.</div>;

  // ── One chronological stream. Booking-linked jobs are folded into their
  //    booking entry (one car, one row) - never duplicated. ──
  const timeline: TimelineItem[] = [
    ...bookings.map((b): TimelineItem => ({
      id: 'b' + b.id,
      at: b.createdAt?.toMillis?.() ?? 0,
      icon: CalendarClock,
      title: b.serviceName,
      sub: `${b.vehicleName} · ${formatDate(b.scheduledDate)}${b.discount ? ` · ${b.discount.label}` : ''}${b.jobId ? ' · in studio' : ''}`,
      amount: b.totalAmount,
      badge: { label: getStatusLabel(b.status), className: getStatusColor(b.status) },
      onOpen: () => router.push(`/admin/bookings/${b.id}`),
    })),
    ...jobs.filter(j => !j.bookingId).map((j): TimelineItem => ({
      id: 'j' + j.id,
      at: j.createdAt?.toMillis?.() ?? 0,
      icon: Wrench,
      title: j.serviceItems.map(s => s.serviceName).join(', '),
      sub: `${j.vehicleName} · ${formatDate(j.date)} · walk-in`,
      amount: j.totalAmount,
      badge: { label: getStatusLabel(j.status), color: j.status === 'completed' ? 'var(--success)' : 'var(--warning)' },
      onOpen: () => router.push(`/admin/jobs/${j.id}`),
    })),
    ...invoices.map((inv): TimelineItem => ({
      id: 'i' + inv.id,
      at: inv.createdAt?.toMillis?.() ?? 0,
      icon: FileText,
      title: `Invoice ${inv.invoiceNumber}`,
      sub: `${inv.vehicleName} · ${inv.paymentStatus === 'paid' ? 'paid' : 'pending'}`,
      amount: inv.total,
      trailing: (
        <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <a href={invoicePublicUrl(inv)} target="_blank" rel="noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
            style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><FileText size={11} /></a>
          <a href={buildInvoiceWhatsAppLink(inv)} target="_blank" rel="noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[.06]"
            style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><MessageCircle size={11} /></a>
        </span>
      ),
    })),
    ...subs.map((s): TimelineItem => ({
      id: 's' + s.id,
      at: s.createdAt?.toMillis?.() ?? 0,
      icon: CreditCard,
      title: `${s.plan} membership`,
      sub: `${s.startDate} → ${s.endDate} · ${s.washesUsed}/${s.washesTotal} washes used`,
      badge: { label: s.status, color: s.status === 'active' ? 'var(--success)' : 'var(--steel)' },
    })),
  ].sort((a, b) => b.at - a.at);

  const activeSub = subs.find(s => s.status === 'active');

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <Link href="/admin/customers" className="flex items-center gap-2 data-label mb-4" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Customers
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--smoke)' }}>
          <span className="font-display font-800 text-lg" style={{ color: 'var(--chrome)' }}>
            {customer.name?.charAt(0) || 'C'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-800 text-xl" style={{ color: 'var(--chrome)' }}>{customer.name}</h1>
          <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
            {customer.email}{customer.phone ? ` · ${customer.phone}` : ''} · joined {customer.createdAt?.toDate?.().toLocaleDateString('en-IN') ?? '-'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--faint)' }}>Lifetime value</p>
          <p className="font-display font-800 text-lg" style={{ color: 'var(--chrome)' }}>{formatCurrency(ltv)}</p>
        </div>
        <div className="flex gap-1.5">
          {customer.phone && (
            <>
              <a href={`tel:+91${customer.phone}`} className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/[.06]"
                style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><Phone size={14} /></a>
              <a href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/[.06]"
                style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}><MessageCircle size={14} /></a>
            </>
          )}
          <button onClick={openEdit} aria-label="Edit customer"
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/[.06]"
            style={{ border: '1px solid var(--border)', color: 'var(--pewter)' }}>
            <Pencil size={13} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* ── Timeline: everything, chronological ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h2 className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>History</h2>
            <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{timeline.length}</span>
          </div>
          {timeline.length === 0 ? (
            <div className="card text-center py-14">
              <p className="font-body text-sm" style={{ color: 'var(--steel)' }}>Nothing yet - their first visit will appear here.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--fog)' }}>
              {timeline.map((t, i) => {
                const Row = (
                  <>
                    <t.icon size={15} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-600 truncate" style={{ fontSize: 13.5, color: 'var(--chrome)' }}>{t.title}</p>
                      <p className="text-xs font-body truncate mt-0.5" style={{ color: 'var(--steel)' }}>{t.sub}</p>
                    </div>
                    {t.amount !== undefined && (
                      <span className="font-mono font-700 text-sm shrink-0" style={{ color: 'var(--chrome)' }}>{formatCurrency(t.amount)}</span>
                    )}
                    {t.badge && (t.badge.className
                      ? <span className={`status-badge text-[10px] shrink-0 ${t.badge.className}`}>{t.badge.label}</span>
                      : <span className="text-[10px] font-mono uppercase tracking-wider shrink-0" style={{ color: t.badge.color }}>{t.badge.label}</span>)}
                    {t.trailing}
                    {t.onOpen && <ChevronRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />}
                  </>
                );
                const style = { borderTop: i === 0 ? 'none' : '1px solid var(--border)' } as React.CSSProperties;
                return t.onOpen ? (
                  <button key={t.id} onClick={t.onOpen} style={style}
                    className="group w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[.03] cursor-pointer">
                    {Row}
                  </button>
                ) : (
                  <div key={t.id} style={style} className="flex items-center gap-3 px-4 py-2.5">{Row}</div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Rail: garage, membership, activity, notes - always visible ── */}
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: 'var(--faint)' }}>Garage · {vehicles.length}</p>
            {vehicles.length === 0 ? (
              <p className="font-body text-xs" style={{ color: 'var(--steel)' }}>No vehicles saved.</p>
            ) : (
              <div className="space-y-2">
                {vehicles.map(v => (
                  <button key={v.id} onClick={() => router.push(`/admin/vehicles/${encodeURIComponent(v.registrationNumber)}`)}
                    className="group w-full flex items-center gap-2.5 text-left cursor-pointer">
                    <Car size={13} style={{ color: 'var(--pewter)', flexShrink: 0 }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body font-600 truncate" style={{ fontSize: 12.5, color: 'var(--chrome)' }}>{v.name}</p>
                      <p className="text-[11px] font-body truncate" style={{ color: 'var(--steel)' }}>{v.registrationNumber} · {v.category}{v.color ? ` · ${v.color}` : ''}</p>
                    </div>
                    <ChevronRight size={13} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--steel)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {activity.length > 0 ? (
            <div className="rounded-2xl p-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: 'var(--faint)' }}>Activity</p>
              {/* The same timeline the job and booking workspaces draw - one
                  implementation, so a customer's trail cannot start reading
                  differently from the trail on the job it came from. */}
              <ActivityTimeline events={activity} />
            </div>
          ) : null}

          <div className="rounded-2xl p-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: 'var(--faint)' }}>Membership</p>
            {activeSub ? (
              <div>
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{activeSub.plan}</p>
                <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                  {activeSub.washesUsed}/{activeSub.washesTotal} washes · ends {activeSub.endDate}
                </p>
              </div>
            ) : !planPickerOpen ? (
              <button onClick={() => setPlanPickerOpen(true)}
                className="w-full py-2 rounded-xl text-xs font-body flex items-center justify-center gap-1.5 transition-colors hover:bg-white/[.04] cursor-pointer"
                style={{ border: '1px dashed var(--border-strong)', color: 'var(--pewter)' }}>
                <Plus size={12} /> Start a membership
              </button>
            ) : (
              <div className="space-y-1.5">
                {MEMBERSHIP_PLANS.map(p => (
                  <button key={p.id} onClick={() => createPlanFor(p.id)} disabled={!!creatingPlan}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors hover:bg-white/[.04] cursor-pointer"
                    style={{ border: '1px solid var(--border)' }}>
                    <span className="font-body font-600 text-xs" style={{ color: 'var(--chrome)' }}>{p.label}</span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--steel)' }}>
                      {creatingPlan === p.id ? 'Starting…' : `${p.washesPerMonth} washes · ${formatCurrency(p.price)}`}
                    </span>
                  </button>
                ))}
                <button onClick={() => setPlanPickerOpen(false)} className="w-full py-1.5 text-[11px] font-body cursor-pointer" style={{ color: 'var(--faint)' }}>Cancel</button>
              </div>
            )}
          </div>


          <div className="rounded-2xl p-4" style={{ background: 'var(--fog)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-2.5" style={{ color: 'var(--faint)' }}>Notes</p>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Preferences, car quirks, follow-ups…"
              className="w-full rounded-xl px-3 py-2.5 font-body resize-none outline-none"
              style={{ fontSize: 12.5, background: 'var(--phantom)', border: '1px solid var(--border-2)', color: 'var(--fg)' }} />
            {notes !== (customer.notes ?? '') && (
              <button onClick={saveNotes} disabled={savingNotes}
                className="mt-2 w-full py-2 rounded-xl text-xs font-body cursor-pointer"
                style={{ background: 'var(--fog)', border: '1px solid var(--border-2)', color: 'var(--fg-dim)' }}>
                {savingNotes ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit customer sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setEditOpen(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-800 text-base" style={{ color: 'var(--chrome)' }}>Edit customer</p>
              <button onClick={() => setEditOpen(false)} aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg"
                style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={13} /></button>
            </div>
            <label className="data-label block mb-1.5">Name</label>
            <input className="input mb-3" value={editName} onChange={e => setEditName(e.target.value)} />
            <label className="data-label block mb-1.5">Phone</label>
            <input className="input mb-4" inputMode="numeric" maxLength={10} value={editPhone}
              onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))} />
            <button onClick={saveEdit} disabled={savingEdit} className="btn-ember w-full py-3">
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
