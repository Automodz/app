'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, UserCheck, ArrowRight, ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import {
  findCustomerByPhone, createWalkInJob, getServices, listEmployees,
  getUserSubscription, computeBestDiscount,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import { applyDiscount } from '@/lib/services/pricing';
import { subscribeTodaysJobs } from '@/lib/firebaseService';
import { fmtMin } from '@/lib/services/washMetrics';
import { categoryToResource, RESOURCE_LABELS } from '@/lib/availability';
import { useFloor } from '@/components/workspace/useFloor';
import ServiceIcon from '@/components/ui/ServiceIcon';
import { useAppStore } from '@/lib/store';
import type { Service, User, JobServiceItem, BookingDiscount, Employee, Job, Subscription } from '@/lib/types';
import { washesLeftOf } from '@/lib/os/club';

const CATEGORIES = ['Washing', 'Ceramic', 'Coating', 'PPF'];

export default function WalkInFlow({ onDone }: {
  /** drawer mode: hand the new job id back instead of routing */
  onDone?: (jobId: string) => void;
} = {}) {
  const router = useRouter();
  const { kioskEmployee, user } = useAppStore();
  // Kiosk PIN identity wins; otherwise staff act as themselves - managers on
  // their admin session, technicians on their personal employee session.
  const operator = kioskEmployee
    ?? (user?.role === 'admin' ? { id: user.uid, name: user.name || 'Manager' }
      : user?.role === 'employee' ? { id: user.employeeId ?? user.uid, name: user.name || 'Staff' }
      : null);
  const [step, setStep] = useState(0); // 0 customer, 1 vehicle, 2 services, 3 confirm

  useEffect(() => { listEmployees().then(setStaff).catch(() => {}); }, []);
  useEffect(() => {
    if (kioskEmployee && assignees.size === 0) {
      setAssignees(new Map([[kioskEmployee.id, kioskEmployee.name]]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kioskEmployee?.id]);

  // customer
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [matched, setMatched] = useState<User | null>(null);
  const [looking, setLooking] = useState(false);

  // vehicle
  const [vehicleName, setVehicleName] = useState('');
  const [regNo, setRegNo] = useState('');

  // services
  const [services, setServices] = useState<Service[]>([]);
  const [cat, setCat] = useState('Washing');
  const [selected, setSelected] = useState<Map<string, JobServiceItem>>(new Map());
  // live floor state - the physical resource (Wash / Protection Bay) is
  // derived from the chosen services; nobody picks a bay number
  const [floorJobs, setFloorJobs] = useState<Job[]>([]);
  useEffect(() => subscribeTodaysJobs(setFloorJobs, () => {}), []);
  const floor = useFloor(floorJobs);
  const [creating, setCreating] = useState(false);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [assignees, setAssignees] = useState<Map<string, string>>(new Map()); // id -> name
  /* A QUOTE for the counter to read out. The Booking Service recomputes it
     from the same line items when it creates the job - this never travels. */
  const [discount, setDiscount] = useState<BookingDiscount | undefined>(undefined);
  const [memberSub, setMemberSub] = useState<Subscription | null>(null);
  /* A member's included wash applies at the counter exactly as it does in
     the app - the server is the one that decides whether it can (see
     `decidePrice`). This was a useState nothing ever set, so a member
     walking in silently paid for a wash they had already bought. */

  useEffect(() => { getServices().then(setServices); }, []);

  // Auto-apply the membership rate for phone-matched customers
  useEffect(() => {
    if (step !== 3 || !matched || selected.size === 0) { setDiscount(undefined); return; }
    const items = Array.from(selected.values());
    const today = new Date().toISOString().split('T')[0];
    (async () => {
      try {
        const sub = await getUserSubscription(matched.uid);
        const activeSub = sub?.status === 'active' && sub.endDate >= today ? sub : null;
        setMemberSub(activeSub);
        const plan = activeSub?.plan ?? null;
        /* Evaluated on the highest-priced item, matching the booking flow.
           Promo codes are removed, so the membership rate is the only benefit
           there is and there is nothing to be best-of against. */
        const top = items.reduce((a, b) => (b.price > a.price ? b : a));
        setDiscount(computeBestDiscount({ price: top.price, membershipPlan: plan }));
      } catch { setDiscount(undefined); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, matched?.uid]);

  const lookup = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { toast.error('Enter a 10-digit phone'); return; }
    setLooking(true);
    const user = await findCustomerByPhone(clean);
    setMatched(user);
    if (user) { setName(user.name); toast.success(`Found ${user.name}`); }
    setLooking(false);
  };

  const toggleService = (s: Service) => {
    const next = new Map(selected);
    if (next.has(s.id)) next.delete(s.id);
    else next.set(s.id, { serviceId: s.id, serviceName: s.name, category: s.category, price: s.price });
    setSelected(next);
  };

  const setPrice = (id: string, price: number) => {
    const next = new Map(selected);
    const item = next.get(id);
    if (item) { next.set(id, { ...item, price: Math.max(0, price) }); setSelected(next); }
  };

  /* One subtraction, one place (§22.2). This one also had no floor at zero -
     an over-spent membership would have reported a negative entitlement. */
  const washesLeft = washesLeftOf(memberSub);
  const rawItems = Array.from(selected.values());
  const washItem = rawItems.find(i => i.category === 'Washing');
  const memberWashActive = !!memberSub && washesLeft > 0 && !!washItem;
  // Member wash zero-prices the wash line (never stacks with the % discount on it)
  const items = memberWashActive
    ? rawItems.map(i => i === washItem ? { ...i, price: 0 } : i)
    : rawItems;
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  // quoted through the one engine - the server reaches the same number
  const quoted = applyDiscount(subtotal, discount);

  const canNext =
    step === 0 ? phone.replace(/\D/g, '').length >= 10 && name.trim().length > 1 :
    step === 1 ? vehicleName.trim().length > 1 && regNo.trim().length >= 4 :
    step === 2 ? items.length > 0 : true;

  /* One key per ticket, so a double-tap or a retry on a bad counter connection
     returns the job that already exists instead of opening a second one. */
  const idemRef = useRef<string>('');
  if (!idemRef.current) {
    idemRef.current = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
      .replace(/[^A-Za-z0-9_-]/g, '');
  }

  const create = async () => {
    if (!operator) { toast.error('Kiosk locked'); return; }
    setCreating(true);
    try {
      /* Line prices are ours to set; the BENEFIT is not. The wash deduction and
         two follow-up calls that used to live here - and could each fail on
         their own - are gone. */
      const { id } = await createWalkInJob({
        customerId: matched?.uid,
        customerName: name.trim(), customerPhone: phone,
        vehicleName: vehicleName.trim(), vehicleRegNo: regNo,
        serviceItems: rawItems,
        useMembershipWash: memberWashActive,
        byEmployee: operator,
        assignees: [...assignees].map(([id, name]) => ({ id, name })),
        idempotencyKey: idemRef.current,
      });
      toast.success('Job created');
      if (onDone) onDone(id);
      else router.replace(`/admin/jobs/${id}`);
    } catch (e) {
      console.error(e); toast.error('Could not create job'); setCreating(false);
    }
  };

  const stepTitles = ['CUSTOMER', 'VEHICLE', 'SERVICES', 'CONFIRM'];

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        {stepTitles.map((t, i) => (
          <div key={t} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center data-label"
                style={{
                  background: i < step ? 'rgba(52,211,153,0.15)' : i === step ? 'var(--accent-mist)' : 'var(--dark)',
                  color: i < step ? 'var(--success)' : i === step ? 'var(--ember)' : 'var(--steel)',
                  border: `1px solid ${i === step ? 'var(--accent-glow)' : 'var(--border)'}`,
                }}>
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span className="data-label hidden sm:inline" style={{ color: i === step ? 'var(--chrome)' : 'var(--steel)' }}>{t}</span>
            </div>
            {i < 3 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="data-label block mb-1">Phone number</label>
                <div className="flex gap-2">
                  <input className="input flex-1 text-lg" inputMode="numeric" value={phone} maxLength={10}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setMatched(null); }}
                    placeholder="Customer mobile" autoFocus />
                  <button onClick={lookup} disabled={looking}
                    className="btn-ghost px-5 flex items-center gap-2">
                    <Search size={15} /> {looking ? '…' : 'Find'}
                  </button>
                </div>
              </div>
              {matched && (
                <div className="card-dark flex items-center gap-3 py-3">
                  <UserCheck size={18} style={{ color: 'var(--success)' }} />
                  <div>
                    <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{matched.name}</p>
                    <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>Existing customer - job links to their account</p>
                  </div>
                </div>
              )}
              <div>
                <label className="data-label block mb-1">Customer name</label>
                <input className="input text-lg" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="data-label block mb-1">Vehicle</label>
                <input className="input text-lg" value={vehicleName} onChange={e => setVehicleName(e.target.value)}
                  placeholder="e.g. Hyundai Creta" autoFocus />
              </div>
              <div>
                <label className="data-label block mb-1">Registration number</label>
                <input className="input text-lg uppercase" value={regNo} onChange={e => setRegNo(e.target.value.toUpperCase())}
                  placeholder="GJ01AB1234" />
              </div>
              <div>
                <label className="data-label block mb-1">Working on this job</label>
                <div className="flex gap-2 flex-wrap">
                  {staff.map(e => {
                    const on = assignees.has(e.id);
                    return (
                      <button key={e.id}
                        onClick={() => setAssignees(p => {
                          const n = new Map(p);
                          if (on) n.delete(e.id); else n.set(e.id, e.name);
                          return n;
                        })}
                        className="px-4 rounded-xl data-label transition-all"
                        style={{
                          minHeight: 44,
                          background: on ? 'var(--accent-mist)' : 'var(--dark)',
                          border: on ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                          color: on ? 'var(--ember)' : 'var(--steel)',
                        }}>{e.name}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCat(c)}
                    className="px-4 py-2.5 rounded-xl data-label whitespace-nowrap"
                    style={{
                      background: cat === c ? 'var(--accent-mist)' : 'var(--dark)',
                      border: cat === c ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                      color: cat === c ? 'var(--ember)' : 'var(--steel)',
                    }}><span className="inline-flex items-center gap-1.5"><ServiceIcon category={c} size={13} /> {c}</span></button>
                ))}
              </div>
              <div className="space-y-2 mb-4">
                {services.filter(s => s.category === cat && s.active).map(s => {
                  const sel = selected.has(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleService(s)}
                      className="card-dark w-full flex items-center gap-3 text-left py-3"
                      style={{ border: sel ? '1px solid var(--border-strong)' : undefined }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: sel ? 'var(--ember)' : 'var(--dark)', border: '1px solid var(--border)' }}>
                        {sel && <Check size={13} color="white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{s.name}</p>
                        {s.brand && <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>{s.brand}</p>}
                      </div>
                      <span className="font-mono text-sm font-700" style={{ color: sel ? 'var(--ember)' : 'var(--steel)' }}>
                        {formatCurrency(s.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {items.length > 0 && (
                <div className="card">
                  <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>Selected - tap ± to adjust price</p>
                  {items.map(i => (
                    <div key={i.serviceId} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="flex-1 text-sm font-body truncate" style={{ color: 'var(--chrome)' }}>{i.serviceName}</span>
                      <button onClick={() => setPrice(i.serviceId, i.price - 100)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--dark)', color: 'var(--steel)' }}><Minus size={12} /></button>
                      <span className="font-mono text-sm w-20 text-center" style={{ color: 'var(--ember)' }}>{formatCurrency(i.price)}</span>
                      <button onClick={() => setPrice(i.serviceId, i.price + 100)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--dark)', color: 'var(--steel)' }}><Plus size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="card space-y-3">
              <div>
                <p className="data-label" style={{ color: 'var(--steel)' }}>Customer</p>
                <p className="font-body font-600" style={{ color: 'var(--chrome)' }}>{name} · {phone}</p>
                {matched && <p className="text-xs" style={{ color: 'var(--success)' }}>Linked to account</p>}
              </div>
              <div>
                <p className="data-label" style={{ color: 'var(--steel)' }}>Vehicle</p>
                <p className="font-body font-600" style={{ color: 'var(--chrome)' }}>{vehicleName} · {regNo}</p>
              </div>
              {/* the physical bay this job will occupy, with live state */}
              {items.length > 0 && (() => {
                const resource = categoryToResource(items[0].category);
                const freeIn = floor.freeInMin[resource];
                const occupied = freeIn !== null;
                const freeAt = occupied
                  ? new Date(floor.now.getTime() + freeIn * 60000)
                    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
                  : null;
                return (
                  <div className="rounded-xl px-3 py-2.5" style={{
                    background: 'var(--dark)',
                    border: `1px solid ${occupied ? 'color-mix(in srgb, var(--warning) 30%, transparent)' : 'color-mix(in srgb, var(--success) 25%, transparent)'}`,
                  }}>
                    <p className="data-label" style={{ color: 'var(--steel)' }}>{RESOURCE_LABELS[resource]}</p>
                    {occupied ? (
                      <>
                        <p className="font-body text-sm font-600" style={{ color: 'var(--warning)' }}>
                          Occupied · free {freeIn > 0 ? `at ${freeAt} (${fmtMin(freeIn)})` : 'any moment'}
                        </p>
                        <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                          This vehicle joins the queue and starts when the bay frees up.
                        </p>
                      </>
                    ) : (
                      <p className="font-body text-sm font-600" style={{ color: 'var(--success)' }}>Free now - work can start immediately.</p>
                    )}
                  </div>
                );
              })()}
              <div>
                <p className="data-label mb-1" style={{ color: 'var(--steel)' }}>Services</p>
                {items.map(i => (
                  <div key={i.serviceId} className="flex justify-between text-sm font-body py-0.5">
                    <span style={{ color: 'var(--chrome)' }}>{i.serviceName}</span>
                    <span className="font-mono" style={{ color: 'var(--steel)' }}>{formatCurrency(i.price)}</span>
                  </div>
                ))}
              </div>
              {discount && (
                <div className="flex justify-between text-sm font-body">
                  <span style={{ color: 'var(--success)' }}>{discount.label}</span>
                  <span className="font-mono" style={{ color: 'var(--success)' }}>−{formatCurrency(discount.amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-body font-600" style={{ color: 'var(--chrome)' }}>Total</span>
                <span className="font-mono font-700 text-lg" style={{ color: 'var(--ember)' }}>
                  {formatCurrency(quoted)}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn-ghost flex items-center gap-2 px-6 py-3.5">
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext}
            className="btn-ember flex-1 flex items-center justify-center gap-2 py-3.5"
            style={{ opacity: canNext ? 1 : 0.4 }}>
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={create} disabled={creating}
            className="btn-ember flex-1 flex items-center justify-center gap-2 py-3.5">
            {creating ? 'Creating…' : `Start Job · ${formatCurrency(quoted)}`}
          </button>
        )}
      </div>
    </div>
  );
}
