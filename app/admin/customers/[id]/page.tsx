'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, MessageCircle, Car, Wrench, FileText,
  CreditCard, BadgePercent, StickyNote, Pencil, Plus, X,
} from 'lucide-react';
import { doc, getDoc, getDocs, updateDoc, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getJobsForCustomer, getInvoicesForCustomer, listPromos, updatePromo,
  buildInvoiceWhatsAppLink, invoicePublicUrl, createSubscription,
} from '@/lib/firebaseService';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import type { User, Vehicle, Booking, Subscription, Job, Invoice, Promo } from '@/lib/types';

type Tab = 'bookings' | 'jobs' | 'vehicles' | 'memberships' | 'invoices' | 'promos' | 'notes';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [tab, setTab] = useState<Tab>('bookings');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [userSnap, vehiclesSnap, bookingsSnap, subsSnap, customerJobs, customerInvoices, allPromos] =
      await Promise.all([
        getDoc(doc(db, 'users', id)),
        getDocs(collection(db, 'users', id, 'vehicles')),
        getDocs(query(collection(db, 'bookings'), where('userId', '==', id))),
        getDocs(query(collection(db, 'subscriptions'), where('userId', '==', id))),
        getJobsForCustomer(id),
        getInvoicesForCustomer(id),
        listPromos(),
      ]);
    if (userSnap.exists()) {
      const u = { uid: userSnap.id, ...userSnap.data() } as User;
      setCustomer(u); setNotes(u.notes ?? '');
    }
    setVehicles(vehiclesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
    setSubs(subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subscription))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
    setJobs(customerJobs);
    setInvoices(customerInvoices);
    setPromos(allPromos);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const ltv =
    bookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0) +
    jobs.filter(j => j.status === 'completed').reduce((s, j) => s + j.totalAmount, 0) +
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

  const createPlanFor = async (planId: 'Silver' | 'Gold' | 'Platinum') => {
    if (!customer) return;
    const cfg = MEMBERSHIP_PLANS.find(p => p.id === planId)!;
    setCreatingPlan(planId);
    try {
      const start = new Date().toISOString().split('T')[0];
      const endDt = new Date(); endDt.setDate(endDt.getDate() + 30);
      const end = endDt.toISOString().split('T')[0];
      await createSubscription({
        userId: id, userName: customer.name,
        userEmail: customer.email, userPhone: customer.phone || '',
        plan: planId, status: 'active',
        startDate: start, endDate: end,
        washesTotal: cfg.washesPerMonth, washesUsed: 0,
        paymentMethod: 'cash',
      });
      toast.success(`${planId} membership started for ${customer.name}`);
      setPlanPickerOpen(false);
      await load();
    } catch { toast.error('Could not create membership'); }
    setCreatingPlan(null);
  };

  const assignPromo = async (p: Promo) => {
    const userIds = p.target.kind === 'customers' ? p.target.userIds : [];
    if (userIds.includes(id)) { toast('Already assigned'); return; }
    await updatePromo(p.id, { target: { kind: 'customers', userIds: [...userIds, id] } });
    toast.success(`${p.code} assigned to ${customer?.name}`);
    await load();
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="w-10 h-10 loader-ring" /></div>;
  if (!customer) return <div className="p-8 text-center font-body" style={{ color: 'var(--steel)' }}>Customer not found.</div>;

  const TABS: { id: Tab; label: string; icon: typeof Car; count: number }[] = [
    { id: 'bookings', label: 'Bookings', icon: Wrench, count: bookings.length },
    { id: 'jobs', label: 'Walk-ins', icon: Car, count: jobs.length },
    { id: 'vehicles', label: 'Garage', icon: Car, count: vehicles.length },
    { id: 'memberships', label: 'Plans', icon: CreditCard, count: subs.length },
    { id: 'invoices', label: 'Invoices', icon: FileText, count: invoices.length },
    { id: 'promos', label: 'Promos', icon: BadgePercent, count: promos.filter(p => p.target.kind === 'customers' && p.target.userIds.includes(id)).length },
    { id: 'notes', label: 'Notes', icon: StickyNote, count: 0 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link href="/admin/customers" className="flex items-center gap-2 data-label mb-4" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Customers
      </Link>

      {/* Header */}
      <div className="card mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--smoke)' }}>
            <span className="font-display font-800 text-xl" style={{ color: 'var(--ember)' }}>
              {customer.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>{customer.name}</h1>
            <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</p>
            <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
              Joined {customer.createdAt?.toDate?.().toLocaleDateString('en-IN') ?? '-'}
            </p>
          </div>
          <div className="text-right">
            <p className="data-label" style={{ color: 'var(--steel)' }}>Lifetime value</p>
            <p className="font-display font-800 text-xl" style={{ color: 'var(--ember)' }}>{formatCurrency(ltv)}</p>
          </div>
          <div className="flex gap-2">
            {customer.phone && (
              <>
                <a href={`tel:+91${customer.phone}`} className="w-10 h-10 flex items-center justify-center rounded-xl"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><Phone size={15} /></a>
                <a href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}><MessageCircle size={15} /></a>
              </>
            )}
            <button onClick={openEdit} aria-label="Edit customer"
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)', color: 'var(--ember)' }}>
              <Pencil size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3.5 py-2 rounded-xl data-label whitespace-nowrap"
            style={{
              background: tab === t.id ? 'var(--accent-mist)' : 'var(--dark)',
              border: tab === t.id ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
              color: tab === t.id ? 'var(--ember)' : 'var(--steel)',
            }}>
            {t.label}{t.count > 0 && ` (${t.count})`}
          </button>
        ))}
      </div>

      {tab === 'bookings' && (
        <div className="space-y-3">
          {bookings.length === 0 && <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>No bookings yet.</p>}
          {bookings.map(b => (
            <div key={b.id} className="card-dark flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{b.serviceName}</p>
                <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                  {b.vehicleName} · {formatDate(b.scheduledDate)}
                  {b.discount ? ` · ${b.discount.label}` : ''}
                </p>
              </div>
              <span className="font-mono text-sm font-700" style={{ color: 'var(--chrome)' }}>{formatCurrency(b.totalAmount)}</span>
              <span className={`status-badge text-xs ${getStatusColor(b.status)}`}>{getStatusLabel(b.status)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-3">
          {jobs.length === 0 && <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>No walk-in jobs.</p>}
          {jobs.map(j => (
            <div key={j.id} className="card-dark flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                  {j.serviceItems.map(s => s.serviceName).join(', ')}
                </p>
                <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>{j.vehicleName} · {formatDate(j.date)}</p>
              </div>
              <span className="font-mono text-sm font-700" style={{ color: 'var(--chrome)' }}>{formatCurrency(j.totalAmount)}</span>
              <span className="data-label" style={{ color: j.status === 'completed' ? 'var(--success)' : 'var(--ember)' }}>{j.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-3">
          {vehicles.length === 0 && <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>No vehicles in garage.</p>}
          {vehicles.map(v => (
            <div key={v.id} className="card-dark flex items-center gap-4">
              <Car size={18} style={{ color: 'var(--ember)' }} />
              <div className="flex-1">
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{v.name}</p>
                <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>{v.registrationNumber} · {v.category} · {v.color}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'memberships' && (
        <div className="space-y-3">
          {!planPickerOpen ? (
            <button onClick={() => setPlanPickerOpen(true)}
              className="btn-ghost w-full py-3 flex items-center justify-center gap-2 text-sm">
              <Plus size={15} /> New membership for {customer.name?.split(' ')[0]}
            </button>
          ) : (
            <div className="card-ember p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="data-label" style={{ color: 'var(--ember)' }}>START A MEMBERSHIP</p>
                <button onClick={() => setPlanPickerOpen(false)} aria-label="Close"
                  className="w-9 h-9 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={13} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MEMBERSHIP_PLANS.map(p => (
                  <button key={p.id} onClick={() => createPlanFor(p.id)} disabled={!!creatingPlan}
                    className="card p-3 text-left active:scale-95 transition-transform">
                    <p className="font-display font-800 text-sm text-ember">{p.label.toUpperCase()}</p>
                    <p className="data-label mt-1">{p.washesPerMonth} washes · {formatCurrency(p.price)}/mo</p>
                    <p className="font-mono text-[10px] mt-2" style={{ color: 'var(--ember)' }}>
                      {creatingPlan === p.id ? 'CREATING…' : 'TAP TO START →'}
                    </p>
                  </button>
                ))}
              </div>
              <p className="font-body text-[11px] mt-3" style={{ color: 'var(--muted)' }}>
                Starts today, runs 30 days, payment collected as cash.
              </p>
            </div>
          )}
          {subs.length === 0 && <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>No memberships.</p>}
          {subs.map(s => (
            <div key={s.id} className="card-dark flex items-center gap-4">
              <div className="flex-1">
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{s.plan}</p>
                <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                  {s.startDate} → {s.endDate} · {s.washesUsed}/{s.washesTotal} washes used
                </p>
              </div>
              <span className="data-label" style={{ color: s.status === 'active' ? 'var(--success)' : 'var(--steel)' }}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-3">
          {invoices.length === 0 && <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>No invoices.</p>}
          {invoices.map(inv => (
            <div key={inv.id} className="card-dark flex items-center gap-4">
              <div className="flex-1">
                <p className="font-mono font-700 text-sm" style={{ color: 'var(--ember)' }}>{inv.invoiceNumber}</p>
                <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                  {inv.vehicleName} · {inv.createdAt?.toDate?.().toLocaleDateString('en-IN')}
                </p>
              </div>
              <span className="font-mono text-sm font-700" style={{ color: 'var(--chrome)' }}>{formatCurrency(inv.total)}</span>
              <a href={invoicePublicUrl(inv)} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">View</a>
              <a href={buildInvoiceWhatsAppLink(inv)} target="_blank" rel="noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}><MessageCircle size={13} /></a>
            </div>
          ))}
        </div>
      )}

      {tab === 'promos' && (
        <div className="space-y-3">
          <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
            Tap a promo to assign it to {customer.name} (targets them specifically).
          </p>
          {promos.filter(p => p.active).map(p => {
            const assigned = p.target.kind === 'customers' && p.target.userIds.includes(id);
            const forEveryone = p.target.kind === 'all';
            return (
              <button key={p.id} onClick={() => !assigned && !forEveryone && assignPromo(p)}
                className="card-dark w-full flex items-center gap-4 text-left"
                style={{ opacity: forEveryone ? 0.6 : 1 }}>
                <div className="flex-1">
                  <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                    <span className="font-mono" style={{ color: 'var(--ember)' }}>{p.code}</span> - {p.label}
                  </p>
                  <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
                    {p.type === 'percent' ? `${p.value}%` : formatCurrency(p.value)} off · till {p.validTo}
                  </p>
                </div>
                <span className="data-label" style={{ color: assigned ? 'var(--success)' : forEveryone ? 'var(--steel)' : 'var(--ember)' }}>
                  {assigned ? 'Assigned' : forEveryone ? 'For everyone' : 'Assign →'}
                </span>
              </button>
            );
          })}
          {promos.filter(p => p.active).length === 0 && (
            <p className="font-body text-sm py-8 text-center" style={{ color: 'var(--steel)' }}>
              No active promos - create one in <Link href="/admin/promos" style={{ color: 'var(--ember)' }}>Promos</Link>.
            </p>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="card">
          <textarea className="input" rows={6} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Private notes about this customer - preferences, car quirks, follow-ups…" />
          <button onClick={saveNotes} disabled={savingNotes} className="btn-ember px-6 py-2.5 mt-3 text-sm">
            {savingNotes ? 'Saving…' : 'Save Notes'}
          </button>
        </div>
      )}

      {/* Edit customer sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setEditOpen(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-800 text-base" style={{ color: 'var(--chrome)' }}>EDIT CUSTOMER</p>
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
