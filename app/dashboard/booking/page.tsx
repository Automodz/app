'use client';
/**
 * Booking V3 — onboarding a car into AutoModz, not filling a form.
 * Six horizontal panes, one decision each:
 *   vehicle → goal → plan (one recommendation, with why) → date → arrival → review
 * State persists across panes; back is instant. All business logic —
 * availability engine, pricing, discount engine, membership washes,
 * createBooking, WhatsApp handoff — is untouched from the old wizard.
 */
import { useState, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Check, Copy, Truck, CreditCard, Banknote,
  Info, Zap, Shield, Sparkles, MapPin, Plus, Building2, Sun, Sunset, Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import {
  getServices, createBooking, getAvailability,
  STATIC_SERVICES, getUserSubscription, deductMembershipWash,
  getEligiblePromos, validatePromoCode, recordPromoRedemption,
  computeBestDiscount, promoDiscountAmount, fireOpsEvent, requestQuote,
} from '@/lib/firebaseService';
import {
  formatCurrency, generateTimeSlots, getAvailableDates, formatDate,
  formatTime, getDurationLabel, getBookingWhatsAppMsg, PICKUP_FEE,
} from '@/lib/utils';
import type { Service, StepData, Booking, Subscription, BookingDiscount, Vehicle } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';
import CxSheet from '@/components/cx/CxSheet';
import CxButton from '@/components/cx/CxButton';
import CxVehicleForm from '@/components/cx/CxVehicleForm';
import { deriveProtection } from '@/lib/cx/protection';
import { GOALS, type Goal, goalForCategory, recommend } from '@/lib/cx/goals';
import { DUR, EASE } from '@/lib/cx/motion';
import { Timestamp } from 'firebase/firestore';

const PANES = ['vehicle', 'goal', 'plan', 'date', 'arrival', 'review'] as const;
type Pane = typeof PANES[number] | 'done';

/* ── shared type styles ── */
const mono10 = { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
const body12 = { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)' };
const ask = { fontFamily: 'var(--font-display)', fontWeight: 800 as const, fontSize: '24px', color: 'var(--chrome)', letterSpacing: '-0.01em', lineHeight: 1.15 };

/* horizontal pane transition — one continuous surface */
const paneMotion = (dir: 1 | -1) => ({
  initial: { opacity: 0, x: dir * 36 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: dir * -36 },
  transition: { duration: DUR.base, ease: EASE },
});

const slotPeriod = (t: string): 'morning' | 'afternoon' | 'evening' => {
  const h = parseInt(t, 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
        <div className="w-10 h-10 loader-ring" />
      </div>
    }>
      <BookingFlow />
    </Suspense>
  );
}

function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, vehicles, bookings, addBookingToStore } = useAppStore();

  const [pane, setPane]       = useState<Pane>('vehicle');
  const [dir, setDir]         = useState<1 | -1>(1);
  const [data, setData]       = useState<StepData>({});
  const [goal, setGoal]       = useState<Goal | null>(null);
  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState('');

  const [avail, setAvail]         = useState<{ fullDates: string[]; fullSlots: Record<string, string[]> }>({ fullDates: [], fullSlots: {} });
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [membership, setMembership] = useState<Subscription | null>(null);
  const [usedMembershipWash, setUsedMembershipWash] = useState(false);
  const [discount, setDiscount]   = useState<BookingDiscount | undefined>(undefined);
  const [promoInput, setPromoInput] = useState('');
  const [promoBusy, setPromoBusy]   = useState(false);
  const [manualPromo, setManualPromo] = useState(false);

  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [optionsOpen, setOptionsOpen]       = useState(false);
  const [quoteMsg, setQuoteMsg]             = useState('');
  const [quoteSending, setQuoteSending]     = useState(false);
  const [copiedUpi, setCopiedUpi]           = useState(false);

  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'automodz@upi';

  const go = (next: Pane, direction: 1 | -1 = 1) => { setDir(direction); setPane(next); };
  const back = () => {
    if (pane === 'vehicle' || pane === 'done') { router.back(); return; }
    const i = PANES.indexOf(pane as typeof PANES[number]);
    go(PANES[i - 1], -1);
  };

  /* ── data loading (engine untouched) ── */
  useEffect(() => {
    getServices()
      .then(s => setServices(s.filter(x => x.active).sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    getUserSubscription(user.uid)
      .then(sub => {
        if (sub?.status === 'active') {
          const today = new Date().toISOString().split('T')[0];
          setMembership(sub.endDate >= today ? sub : null);
        } else setMembership(null);
      })
      .catch(() => setMembership(null));
  }, [user?.uid]);

  // Deep links: ?cat=PPF preselects the goal; ?vehicleId&serviceId jumps to the date pane
  useEffect(() => {
    const cat = params.get('cat');
    if (cat) { const g = goalForCategory(cat); if (g) setGoal(g); }
    const vId = params.get('vehicleId');
    const sId = params.get('serviceId');
    if (!vId || !sId || !vehicles.length || !services.length) return;
    const v = vehicles.find(x => x.id === vId);
    const s = services.find(x => x.id === sId);
    if (v && s) {
      setData({ vehicle: v, service: s });
      setGoal(goalForCategory(s.category) ?? null);
      setPane('date');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, vehicles]);

  // Resource-aware availability: full slots for every pickable date + bay-blocked dates
  useEffect(() => {
    if (!data.service) return;
    setSlotsLoading(true);
    getAvailability(getAvailableDates(), data.service.category, data.service.duration)
      .then(setAvail)
      .catch(() => setAvail({ fullDates: [], fullSlots: {} }))
      .finally(() => setSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.service?.id]);

  /* ── derived (pricing math untouched) ── */
  const pickupFee      = (data.pickup ? PICKUP_FEE : 0) + (data.drop ? PICKUP_FEE : 0);
  const isWashService  = data.service?.category === 'Washing';
  const washesRemaining = membership ? membership.washesTotal - membership.washesUsed : 0;
  const membershipCoversWash = isWashService && !!membership && washesRemaining > 0 && usedMembershipWash;
  const servicePrice   = membershipCoversWash ? 0 : (data.service?.price || 0);
  const activeDiscount = membershipCoversWash ? undefined : discount;
  const total          = Math.max(0, servicePrice - (activeDiscount?.amount ?? 0)) + pickupFee;
  const availDates     = getAvailableDates();
  const timeSlots      = data.service ? generateTimeSlots(data.service.duration) : [];
  const bookedSlots    = data.date ? (avail.fullSlots[data.date] ?? []) : [];

  const vehicleHistory = useMemo(() => (v: Vehicle) =>
    bookings
      .filter(b => b.vehicleId === v.id && b.status !== 'cancelled')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
  [bookings]);

  const recommendation = useMemo(() => {
    if (!goal || !data.vehicle) return null;
    const history = vehicleHistory(data.vehicle);
    return recommend(goal, services, {
      vehicle: data.vehicle,
      history,
      protection: deriveProtection(history, services),
      membership,
      washesRemaining,
    });
  }, [goal, data.vehicle, services, membership, washesRemaining, vehicleHistory]);

  // Auto-apply best discount (membership % vs eligible promos) when service is chosen
  useEffect(() => {
    if (!data.service || !user || manualPromo) return;
    const today = new Date().toISOString().split('T')[0];
    const svc = data.service;
    getEligiblePromos(
      { serviceId: svc.id, category: svc.category, userId: user.uid, date: today },
      { autoApplyOnly: true },
    )
      .then(eligible => {
        setDiscount(computeBestDiscount({
          price: svc.price,
          membershipPlan: membership?.plan ?? null,
          eligiblePromos: eligible,
        }));
      })
      .catch(() => setDiscount(undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.service?.id, user?.uid, membership?.plan, manualPromo]);

  const applyPromoCode = async () => {
    if (!data.service || !user || !promoInput.trim()) return;
    setPromoBusy(true);
    const today = new Date().toISOString().split('T')[0];
    const res = await validatePromoCode(promoInput, {
      serviceId: data.service.id, category: data.service.category,
      userId: user.uid, date: today,
    });
    if ('error' in res) {
      toast.error(res.error);
    } else {
      const amount = promoDiscountAmount(res.promo, data.service.price);
      if (amount <= (discount?.amount ?? 0)) {
        toast(`Your current ${discount?.source === 'membership' ? 'membership' : 'auto'} discount is better — we kept it`, { icon: 'ℹ️' });
      } else {
        setDiscount({ source: 'promo', promoId: res.promo.id, label: res.promo.label, amount });
        setManualPromo(true);
        toast.success(`${res.promo.label} applied`);
      }
    }
    setPromoBusy(false);
  };

  const sendQuoteRequest = async () => {
    if (!user || !data.vehicle || !goal) return;
    setQuoteSending(true);
    try {
      const qid = await requestQuote({
        customerName: user.name, customerPhone: user.phone || '',
        customerId: user.uid, vehicleName: data.vehicle.name,
        serviceCategory: goal.category, customerMessage: quoteMsg.trim() || undefined,
      });
      fireOpsEvent('quote_requested', qid);
      toast.success('We’ll WhatsApp you a personal price shortly.');
      setQuoteMsg('');
      setOptionsOpen(false);
    } catch { toast.error('We couldn’t send that — try again.'); }
    setQuoteSending(false);
  };

  const chooseService = (svc: Service) => {
    setData(p => ({ ...p, service: svc, date: undefined, time: undefined }));
    setUsedMembershipWash(svc.category === 'Washing' && !!membership && washesRemaining > 0);
    setManualPromo(false);
  };

  const reviewReady = (() => {
    if (membershipCoversWash && total === 0) return true;
    if (!data.paymentMethod) return false;
    if (data.paymentMethod === 'upi') return !!(data.transactionId?.trim());
    return true;
  })();

  /* ── submit (Firestore-first, WhatsApp after — untouched) ── */
  const handleSubmit = async () => {
    if (!user || !data.vehicle || !data.service || !data.date || !data.time) return;
    setSubmitting(true);
    try {
      let bookingId = '';
      let membershipId: string | undefined;
      let membershipWashApplied = false;

      if (membershipCoversWash && membership) {
        const result = await deductMembershipWash(user.uid);
        if (result.success) {
          membershipId = result.subscriptionId;
          membershipWashApplied = true;
        } else {
          toast.error('Membership wash unavailable. Charging normal price.');
        }
      }

      const paymentMethod = membershipWashApplied && total === pickupFee
        ? 'cash' : data.paymentMethod || 'cash';
      const paymentStatus = membershipWashApplied && total === pickupFee
        ? 'verified' : 'pending';

      bookingId = await createBooking({
        userId:                 user.uid,
        userName:               user.name,
        userPhone:              user.phone || '',
        userEmail:              user.email,
        vehicleId:              data.vehicle.id,
        vehicleName:            data.vehicle.name,
        vehicleRegNo:           data.vehicle.registrationNumber,
        serviceId:              data.service.id,
        serviceName:            data.service.name,
        serviceCategory:        data.service.category,
        serviceBasePrice:       data.service.price,
        serviceDurationMinutes: data.service.duration,
        pickupDropRequired: !!(data.pickup || data.drop),
        pickupRequired:   !!data.pickup,
        dropRequired:     !!data.drop,
        pickupDropFee:    pickupFee,
        pickupAddress:    data.pickupAddress || '',
        totalAmount:      total,
        scheduledDate:    data.date,
        scheduledTime:    data.time,
        paymentMethod,
        paymentStatus,
        transactionId:    data.transactionId || '',
        status:           'pending',
        usedMembershipWash: membershipWashApplied,
        membershipId,
        ...(activeDiscount ? { discount: activeDiscount } : {}),
      });

      fireOpsEvent('booking_created', bookingId);

      if (activeDiscount?.source === 'promo' && activeDiscount.promoId) {
        recordPromoRedemption({
          promoId: activeDiscount.promoId, userId: user.uid,
          bookingId, discountAmount: activeDiscount.amount,
        }).catch(() => {});
      }

      const now = Timestamp.now();
      const newBooking: Booking = {
        id:                     bookingId,
        userId:                 user.uid,
        userName:               user.name,
        userPhone:              user.phone || '',
        userEmail:              user.email,
        vehicleId:              data.vehicle.id,
        vehicleName:            data.vehicle.name,
        vehicleRegNo:           data.vehicle.registrationNumber,
        serviceId:              data.service.id,
        serviceName:            data.service.name,
        serviceCategory:        data.service.category,
        serviceBasePrice:       data.service.price,
        serviceDurationMinutes: data.service.duration,
        pickupDropRequired:     !!(data.pickup || data.drop),
        pickupRequired:         !!data.pickup,
        dropRequired:           !!data.drop,
        pickupDropFee:          pickupFee,
        pickupAddress:          data.pickupAddress,
        totalAmount:            total,
        scheduledDate:          data.date,
        scheduledTime:          data.time,
        status:                 'pending',
        paymentMethod,
        paymentStatus,
        transactionId:          data.transactionId,
        usedMembershipWash:     membershipWashApplied,
        membershipId,
        discount:               activeDiscount,
        createdAt: now,
        updatedAt: now,
      };
      addBookingToStore(newBooking);

      const msg = getBookingWhatsAppMsg({
        userName:          user.name,
        vehicleName:       data.vehicle.name,
        serviceName:       data.service.name,
        scheduledDate:     data.date,
        scheduledTime:     data.time,
        totalAmount:       total,
        id:                bookingId,
        pickupDropRequired: !!(data.pickup || data.drop),
        paymentMethod:     data.paymentMethod,
        transactionId:     data.transactionId,
      });
      setTimeout(() => {
        window.open(
          `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
          '_blank'
        );
      }, 400);

      setConfirmedId(bookingId);
      go('done');
    } catch (err) {
      console.error(err);
      toast.error('That didn’t go through. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const paneIndex = pane === 'done' ? PANES.length : PANES.indexOf(pane as typeof PANES[number]);

  /* ═══════════════════════════ render ═══════════════════════════ */
  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--void)' }}>

      {/* Header — quiet: a way back, a sense of place */}
      {pane !== 'done' && (
        <div className="sticky top-0 z-20 glass-nav px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={back} aria-label="Back"
              className="w-9 h-9 rounded-2xl card flex items-center justify-center shrink-0">
              <ChevronLeft size={15} style={{ color: 'var(--pewter)' }} />
            </button>
            <div className="flex-1 flex items-center gap-1.5">
              {PANES.map((p, i) => (
                <div key={p} className="h-[3px] flex-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--border-2)' }}>
                  <motion.div className="h-full rounded-full"
                    initial={false}
                    animate={{ width: i <= paneIndex ? '100%' : '0%' }}
                    transition={{ duration: DUR.base, ease: EASE }}
                    style={{ background: 'var(--ember)' }} />
                </div>
              ))}
            </div>
            {data.vehicle && pane !== 'vehicle' && (
              <p className="shrink-0 max-w-[110px] truncate" style={{ ...mono10, color: 'var(--steel)' }}>
                {data.vehicle.name}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-6 pb-36 max-w-lg mx-auto overflow-x-clip">
        <AnimatePresence mode="wait" custom={dir}>

          {/* ── PANE: vehicle ── */}
          {pane === 'vehicle' && (
            <motion.div key="vehicle" {...paneMotion(dir)}>
              <h2 style={ask}>Which car are we<br />looking after?</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '24px' }}>
                Every visit is written into its story.
              </p>

              <div className="space-y-3">
                {vehicles.map(v => {
                  const history = vehicleHistory(v);
                  const completed = history.filter(b => b.status === 'completed');
                  const protection = deriveProtection(history, services);
                  const last = completed[0];
                  return (
                    <motion.button key={v.id} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setData(p => ({ ...p, vehicle: v }));
                        setTimeout(() => go('goal'), 180);
                      }}
                      className="card w-full rounded-3xl p-5 text-left">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.01em', color: 'var(--chrome)' }}>
                        {v.name}
                      </p>
                      <p className="font-mono mt-1" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)' }}>
                        {v.registrationNumber} · {v.category.toUpperCase()}{v.color ? ` · ${v.color.toUpperCase()}` : ''}
                      </p>

                      {(protection.length > 0 || last) && (
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
                        </div>
                      )}
                      {last && (
                        <p className="font-body mt-2" style={{ fontSize: 11.5, color: 'var(--steel)' }}>
                          Last with us · {last.serviceName} · {formatDate(last.scheduledDate)}
                        </p>
                      )}
                    </motion.button>
                  );
                })}

                <button onClick={() => setAddVehicleOpen(true)}
                  className="w-full rounded-3xl p-5 flex items-center justify-center gap-2"
                  style={{ border: '1.5px dashed var(--border-strong)', color: 'var(--steel)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500 }}>
                  <Plus size={15} /> {vehicles.length === 0 ? 'Add your first car' : 'Add another car'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PANE: goal ── */}
          {pane === 'goal' && (
            <motion.div key="goal" {...paneMotion(dir)}>
              <h2 style={ask}>What does {data.vehicle?.name.split(' ')[0] ? 'your car' : 'it'} need<br />today?</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '24px' }}>
                Tell us the goal — we’ll match the care.
              </p>

              <div className="space-y-2.5">
                {GOALS.map(g => (
                  <motion.button key={g.id} whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setGoal(g);
                      setTimeout(() => go('plan'), 180);
                    }}
                    className={`w-full rounded-2xl p-4 text-left flex items-center gap-4 ${goal?.id === g.id ? 'card-ember' : 'card'}`}>
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--cavern)' }}>
                      <ServiceIcon category={g.category} size={18} style={{ color: 'var(--chrome)' }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                        {g.title}
                      </p>
                      <p style={{ ...body12, marginTop: '2px' }}>{g.line}</p>
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── PANE: plan (recommendation) ── */}
          {pane === 'plan' && (
            <motion.div key="plan" {...paneMotion(dir)}>
              <h2 style={ask}>Here’s what we’d do.</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '24px' }}>
                One recommendation, matched to {data.vehicle?.name}. Change it if you like.
              </p>

              {recommendation ? (
                <motion.div
                  key={recommendation.service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                  className="card-ember rounded-3xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: 'var(--chrome)', letterSpacing: '-0.01em' }}>
                        {recommendation.service.name}
                      </p>
                      <p className="font-mono mt-1" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--muted)' }}>
                        {getDurationLabel(recommendation.service.duration).toUpperCase()}
                        {recommendation.service.warranty && ` · ${recommendation.service.warranty.toUpperCase()} CARE`}
                        {recommendation.service.brand && ` · ${recommendation.service.brand.toUpperCase()}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {goal?.category === 'Washing' && membership && washesRemaining > 0 ? (
                        <>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                            {formatCurrency(recommendation.service.price)}
                          </p>
                          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '17px', color: 'var(--success)' }}>
                            On us
                          </p>
                        </>
                      ) : (
                        <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px' }}>
                          {formatCurrency(recommendation.service.price)}
                        </p>
                      )}
                    </div>
                  </div>

                  <p style={{ ...body12, marginTop: '12px', lineHeight: 1.5 }}>
                    {recommendation.service.description}
                  </p>

                  <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <p style={mono10}>Why this</p>
                    {recommendation.reasons.map((r, i) => (
                      <motion.p key={r}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.08, duration: DUR.base, ease: EASE }}
                        className="flex items-start gap-2" style={{ ...body12, color: 'var(--pewter)' }}>
                        <Check size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                        {r}
                      </motion.p>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="card rounded-3xl p-6 text-center">
                  <p style={body12}>We couldn’t find a match for this — see the options below.</p>
                </div>
              )}

              <button onClick={() => setOptionsOpen(true)}
                className="w-full mt-3 py-3 text-center"
                style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--steel)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                See other options
              </button>
            </motion.div>
          )}

          {/* ── PANE: date ── */}
          {pane === 'date' && (
            <motion.div key="date" {...paneMotion(dir)}>
              <h2 style={ask}>When should we<br />expect it?</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '20px' }}>
                {data.service?.name} · {getDurationLabel(data.service?.duration || 0)} in the studio
              </p>

              {/* Date rail — occupancy shown as a fill bar under each day */}
              <div className="flex gap-2 overflow-x-auto no-scroll pb-2 -mx-4 px-4">
                {availDates.map(d => {
                  const dt   = new Date(d + 'T12:00:00');
                  const sel  = data.date === d;
                  const full = avail.fullDates.includes(d);
                  const busy = timeSlots.length ? (avail.fullSlots[d]?.length ?? 0) / timeSlots.length : 0;
                  return (
                    <button key={d} onClick={() => !full && setData(p => ({ ...p, date: d, time: undefined }))}
                      disabled={full}
                      className="flex-shrink-0 w-[64px] rounded-2xl px-2 pt-3 pb-2.5 flex flex-col items-center gap-1 transition-all"
                      style={{
                        background: sel ? 'var(--ember)' : 'var(--dark)',
                        border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                        boxShadow: sel ? '0 4px 16px var(--accent-glow)' : 'none',
                        opacity: full ? 0.35 : 1,
                        cursor: full ? 'not-allowed' : 'pointer',
                      }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)', letterSpacing: '0.08em' }}>
                        {dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: sel ? 'var(--on-accent)' : 'var(--chrome)', lineHeight: 1 }}>
                        {dt.getDate()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8.5px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)', letterSpacing: '0.06em' }}>
                        {full ? 'FULL' : dt.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
                      </span>
                      {/* occupancy */}
                      <span className="w-full h-[3px] rounded-full overflow-hidden mt-0.5" style={{ background: sel ? 'color-mix(in srgb, var(--on-accent) 25%, transparent)' : 'var(--border-2)' }}>
                        <span className="block h-full rounded-full" style={{
                          width: `${Math.round((full ? 1 : busy) * 100)}%`,
                          background: sel ? 'var(--on-accent)' : busy > 0.66 || full ? 'var(--warning)' : 'var(--success)',
                        }} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Slots grouped by period */}
              {data.date && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.base, ease: EASE }} className="mt-5 space-y-5">
                  {slotsLoading && (
                    <div className="flex items-center gap-2" style={body12}>
                      <div className="w-4 h-4 loader-ring" /> Checking the bays…
                    </div>
                  )}
                  {([
                    { id: 'morning',   label: 'Morning',   Icon: Sun },
                    { id: 'afternoon', label: 'Afternoon', Icon: Sunset },
                    { id: 'evening',   label: 'Evening',   Icon: Moon },
                  ] as const).map(period => {
                    const slots = timeSlots.filter(t => slotPeriod(t) === period.id);
                    if (slots.length === 0) return null;
                    return (
                      <div key={period.id}>
                        <p className="flex items-center gap-1.5 mb-2.5" style={mono10}>
                          <period.Icon size={12} /> {period.label}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {slots.map(t => {
                            const sel   = data.time === t;
                            const taken = bookedSlots.includes(t);
                            return (
                              <button key={t} onClick={() => !taken && setData(p => ({ ...p, time: t }))}
                                disabled={taken}
                                className="rounded-xl py-3 transition-all"
                                style={{
                                  background: sel ? 'var(--ember)' : taken ? 'var(--cavern)' : 'var(--dark)',
                                  border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                                  fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
                                  color: sel ? 'var(--on-accent)' : taken ? 'var(--faint)' : 'var(--pewter)',
                                  opacity: taken ? 0.4 : 1,
                                  cursor: taken ? 'not-allowed' : 'pointer',
                                  textDecoration: taken ? 'line-through' : 'none',
                                  boxShadow: sel ? '0 2px 12px var(--accent-glow)' : 'none',
                                }}>
                                {formatTime(t)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── PANE: arrival ── */}
          {pane === 'arrival' && (
            <motion.div key="arrival" {...paneMotion(dir)}>
              <h2 style={ask}>How should it<br />reach us?</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '24px' }}>
                {data.date && formatDate(data.date)} at {data.time && formatTime(data.time)} · about {getDurationLabel(data.service?.duration || 0)} with us
              </p>

              <div className="space-y-3">
                {/* Studio visit */}
                <button
                  onClick={() => setData(p => ({ ...p, pickup: false, drop: false, pickupAddress: '' }))}
                  className={`w-full rounded-3xl p-5 text-left ${!data.pickup && !data.drop ? 'card-ember ember-ring' : 'card'}`}>
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--cavern)' }}>
                      <Building2 size={20} style={{ color: 'var(--chrome)' }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                        Drive in to the studio
                      </p>
                      <p style={{ ...body12, marginTop: '2px' }}>Bhairavnath Rd, Maninagar · no extra charge</p>
                    </div>
                    {!data.pickup && !data.drop && (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--ember)' }}>
                        <Check size={12} style={{ color: 'var(--on-accent)' }} />
                      </span>
                    )}
                  </div>
                </button>

                {/* Pickup / drop */}
                <div className={`rounded-3xl p-5 ${data.pickup || data.drop ? 'card-ember ember-ring' : 'card'}`}>
                  <div className="flex items-center gap-4 mb-1">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--cavern)' }}>
                      <Truck size={20} style={{ color: 'var(--chrome)' }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
                        We come to you
                      </p>
                      <p style={{ ...body12, marginTop: '2px' }}>{formatCurrency(PICKUP_FEE)} per leg — pick either, or both</p>
                    </div>
                  </div>

                  {([
                    { key: 'pickup' as const, label: 'Collect my car', sub: 'We pick it up from your address' },
                    { key: 'drop'   as const, label: 'Return my car',  sub: 'We bring it back when it’s done' },
                  ]).map(leg => (
                    <div key={leg.key} className="flex items-center justify-between py-2.5 mt-1"
                      style={{ borderTop: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--fg-dim)' }}>
                          {leg.label} <span style={{ color: 'var(--ember)' }}>+{formatCurrency(PICKUP_FEE)}</span>
                        </p>
                        <p style={body12}>{leg.sub}</p>
                      </div>
                      <button
                        onClick={() => setData(p => ({ ...p, [leg.key]: !p[leg.key] }))}
                        className={`toggle-track ${data[leg.key] ? 'on' : 'off'}`}>
                        <div className="toggle-knob" />
                      </button>
                    </div>
                  ))}

                  <AnimatePresence>
                    {(data.pickup || data.drop) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: DUR.fast, ease: EASE }}
                        className="overflow-hidden">
                        <input type="text"
                          placeholder="Where should we come?"
                          value={data.pickupAddress || ''}
                          onChange={e => setData(p => ({ ...p, pickupAddress: e.target.value }))}
                          className="input text-sm mt-2" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PANE: review ── */}
          {pane === 'review' && (
            <motion.div key="review" {...paneMotion(dir)}>
              <h2 style={ask}>One last look.</h2>
              <p style={{ ...body12, marginTop: '6px', marginBottom: '24px' }}>
                Then it’s in our hands.
              </p>

              {/* The visit, assembled */}
              <motion.div className="card-ember rounded-3xl p-5 mb-4"
                initial="hidden" animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
                {([
                  ['Vehicle',  data.vehicle?.name],
                  ['Care',     data.service?.name],
                  ['Arrives',  data.date && `${formatDate(data.date)} · ${data.time && formatTime(data.time)}`],
                  ['With us for', getDurationLabel(data.service?.duration || 0)],
                  ['Arrival',  data.pickup || data.drop
                    ? [data.pickup && 'We collect', data.drop && 'we return'].filter(Boolean).join(' & ')
                    : 'You drive in'],
                ] as [string, string | undefined | false][]).map(([l, v]) => (
                  <motion.div key={l}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } } }}
                    className="flex items-baseline justify-between py-2 first:pt-0"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <p style={mono10}>{l}</p>
                    <p className="text-right" style={{ fontFamily: 'var(--font-body)', fontSize: '13.5px', fontWeight: 600, color: 'var(--chrome)' }}>{v}</p>
                  </motion.div>
                ))}

                <motion.div
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } } }}
                  className="pt-3">
                  <div className="flex items-center justify-between">
                    <p style={body12}>{membershipCoversWash ? 'Care (membership)' : 'Care'}</p>
                    {membershipCoversWash ? (
                      <span className="flex items-center gap-2">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                          {formatCurrency(data.service?.price || 0)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: 'var(--success)' }}>On us</span>
                      </span>
                    ) : (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13.5px', fontWeight: 600, color: 'var(--chrome)' }}>
                        {formatCurrency(data.service?.price || 0)}
                      </p>
                    )}
                  </div>
                  {activeDiscount && (
                    <div className="flex items-center justify-between mt-1.5">
                      <p style={{ ...body12, color: 'var(--success)' }}>{activeDiscount.label}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13.5px', fontWeight: 600, color: 'var(--success)' }}>
                        −{formatCurrency(activeDiscount.amount)}
                      </p>
                    </div>
                  )}
                  {pickupFee > 0 && (
                    <div className="flex items-center justify-between mt-1.5">
                      <p style={body12}>Doorstep {data.pickup && data.drop ? 'pickup & return' : data.pickup ? 'pickup' : 'return'}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13.5px', fontWeight: 600, color: 'var(--chrome)' }}>
                        {formatCurrency(pickupFee)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--chrome)' }}>Total</p>
                    <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px' }}>
                      {total === 0 ? 'On us' : formatCurrency(total)}
                    </p>
                  </div>
                </motion.div>
              </motion.div>

              {/* Membership wash toggle */}
              {membership && isWashService && washesRemaining > 0 && (
                <div className="card rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--chrome)' }}>
                          Use a membership wash
                        </p>
                        <p style={body12}>
                          {membership.plan} · {washesRemaining} left · saves {formatCurrency(data.service?.price || 0)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setUsedMembershipWash(p => !p)}
                      className={`toggle-track ${usedMembershipWash ? 'on' : 'off'}`}>
                      <div className="toggle-knob" />
                    </button>
                  </div>
                </div>
              )}

              {/* Promo code */}
              {!membershipCoversWash && (
                <div className="card rounded-2xl p-4 mb-4">
                  <p style={{ ...mono10, marginBottom: '8px' }}>Have a code?</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Promo code" value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase())}
                      className="input text-sm flex-1 uppercase" />
                    <button onClick={applyPromoCode} disabled={promoBusy || !promoInput.trim()}
                      className="btn-ghost px-5 text-sm" style={{ opacity: promoInput.trim() ? 1 : 0.5 }}>
                      {promoBusy ? '…' : 'Apply'}
                    </button>
                  </div>
                  {activeDiscount?.source === 'membership' && (
                    <p style={{ ...body12, marginTop: '8px', color: 'var(--success)' }}>
                      Your membership price is already in — a better code will replace it.
                    </p>
                  )}
                </div>
              )}

              {/* Payment */}
              {membershipCoversWash && total === 0 ? (
                <div className="rounded-2xl p-5 text-center"
                  style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: 'var(--success)' }}>
                    Covered by your {membership?.plan} plan
                  </p>
                  <p style={{ ...body12, marginTop: '4px' }}>
                    Nothing to pay — one wash will be marked as used.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ ...mono10, marginBottom: '10px' }}>How would you like to pay?</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    {[
                      { id: 'upi',  Icon: CreditCard, label: 'UPI now',   sub: 'GPay · PhonePe · any app' },
                      { id: 'cash', Icon: Banknote,   label: 'At the studio', sub: 'Cash on arrival' },
                    ].map(m => {
                      const sel = data.paymentMethod === m.id;
                      return (
                        <button key={m.id}
                          onClick={() => setData(p => ({ ...p, paymentMethod: m.id as 'upi' | 'cash' }))}
                          className={`rounded-2xl p-4 text-left ${sel ? 'card-ember ember-ring' : 'card'}`}>
                          <m.Icon size={17} style={{ color: sel ? 'var(--ember)' : 'var(--steel)' }} className="mb-2.5" />
                          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--chrome)' }}>{m.label}</p>
                          <p style={{ ...body12, fontSize: '11px', marginTop: '2px' }}>{m.sub}</p>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {data.paymentMethod === 'upi' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: DUR.fast, ease: EASE }}
                        className="overflow-hidden">
                        <div className="card rounded-2xl p-4">
                          <p style={{ ...mono10, marginBottom: '8px' }}>Send {formatCurrency(total)} to</p>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 rounded-xl px-4 py-3"
                              style={{ background: 'var(--dark)', border: '1px solid var(--border-2)', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                              {upiId}
                            </div>
                            <button onClick={() => {
                              navigator.clipboard.writeText(upiId);
                              setCopiedUpi(true);
                              toast.success('Copied');
                              setTimeout(() => setCopiedUpi(false), 2500);
                            }}
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
                              style={{ background: copiedUpi ? 'var(--success)' : 'var(--ember)' }}>
                              {copiedUpi ? <Check size={16} style={{ color: 'var(--on-accent)' }} /> : <Copy size={16} style={{ color: 'var(--on-accent)' }} />}
                            </button>
                          </div>
                          <p style={{ ...mono10, marginBottom: '6px' }}>Transaction ID *</p>
                          <input type="text" placeholder="From your UPI app receipt"
                            value={data.transactionId || ''}
                            onChange={e => setData(p => ({ ...p, transactionId: e.target.value.trim() }))}
                            className="input"
                            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontSize: '14px' }} />
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Info size={10} /> Found under Payment History in your UPI app
                          </p>
                        </div>
                      </motion.div>
                    )}
                    {data.paymentMethod === 'cash' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: DUR.fast, ease: EASE }}
                        className="overflow-hidden">
                        <div className="card rounded-2xl p-4 flex items-center gap-3">
                          <MapPin size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                          <p style={body12}>
                            Pay {formatCurrency(total)} when you arrive — Bhairavnath Rd, Maninagar.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ── DONE ── */}
          {pane === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: DUR.base, ease: EASE }}
              className="text-center pt-10">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: DUR.slow, ease: EASE }}
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                <Check size={44} style={{ color: 'var(--ember)' }} />
              </motion.div>

              <h2 style={{ ...ask, fontSize: '28px' }}>We’ll take care of it.</h2>
              <p style={{ ...body12, fontSize: '13px', marginTop: '10px', marginBottom: '24px', lineHeight: 1.6 }}>
                We’ve reserved a bay for {data.vehicle?.name} on {data.date && formatDate(data.date)} at {data.time && formatTime(data.time)}.
                {(data.pickup || data.drop) && ' Our driver will be in touch.'}
                <br />You can follow every step from Care.
              </p>

              <div className="card-ember rounded-3xl p-5 text-left mb-6">
                {([
                  ['Vehicle', data.vehicle?.name],
                  ['Care',    data.service?.name],
                  ['Arrives', data.date && `${formatDate(data.date)} · ${data.time && formatTime(data.time)}`],
                  ['Total',   total === 0 ? 'Covered by membership' : formatCurrency(total)],
                  ['Reference', confirmedId.slice(0, 8).toUpperCase()],
                ] as [string, string | undefined][]).map(([l, v]) => (
                  <div key={l} className="flex items-baseline justify-between py-2 first:pt-0 last:pb-0"
                    style={{ borderBottom: l === 'Reference' ? 'none' : '1px solid var(--border)' }}>
                    <p style={mono10}>{l}</p>
                    <p className="text-right" style={{ fontFamily: 'var(--font-body)', fontSize: '13.5px', fontWeight: 600, color: 'var(--chrome)' }}>{v}</p>
                  </div>
                ))}
              </div>

              <CxButton onClick={() => router.push('/dashboard/history')}>Follow the visit</CxButton>
              <button onClick={() => router.push('/dashboard')}
                className="w-full mt-3 py-3"
                style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--steel)' }}>
                Back home
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom CTA — only where a pane needs explicit confirmation */}
      {(pane === 'plan' || pane === 'date' || pane === 'arrival' || pane === 'review') && (
        <div className="fixed left-0 right-0 z-[60] px-4 py-3 glass-nav"
          style={{ borderTop: '1px solid var(--border)', bottom: 'var(--bottom-nav-h)' }}>
          <div className="max-w-lg mx-auto">
            {pane === 'plan' && (
              <CxButton disabled={!recommendation}
                onClick={() => { if (recommendation) { chooseService(recommendation.service); go('date'); } }}>
                Sounds right — pick a day
              </CxButton>
            )}
            {pane === 'date' && (
              <CxButton disabled={!data.date || !data.time} onClick={() => go('arrival')}>
                {data.date && data.time ? `Reserve ${formatTime(data.time)}` : 'Pick a day and time'}
              </CxButton>
            )}
            {pane === 'arrival' && (
              <CxButton onClick={() => go('review')}>Review the visit</CxButton>
            )}
            {pane === 'review' && (
              <CxButton disabled={!reviewReady || submitting} onClick={handleSubmit}>
                {submitting
                  ? <><div className="w-4 h-4 loader-ring" /> Reserving your bay…</>
                  : 'Schedule Care'}
              </CxButton>
            )}
          </div>
        </div>
      )}

      {/* Add vehicle */}
      <CxSheet open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} tall title="Add vehicle">
        <CxVehicleForm
          onSaved={v => {
            setAddVehicleOpen(false);
            setData(p => ({ ...p, vehicle: v }));
            setTimeout(() => go('goal'), 250);
          }}
          onClose={() => setAddVehicleOpen(false)}
        />
      </CxSheet>

      {/* Other options + personal quote */}
      <CxSheet open={optionsOpen} onClose={() => setOptionsOpen(false)} tall title="Other options">
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: 'var(--chrome)', marginBottom: '4px' }}>
            {goal?.title ?? 'All options'}
          </h3>
          <p style={{ ...body12, marginBottom: '16px' }}>Every {goal?.category} service we offer.</p>

          <div className="space-y-2.5 mb-5">
            {services.filter(s => s.category === goal?.category).map(svc => {
              const sel = data.service?.id === svc.id || (!data.service && recommendation?.service.id === svc.id);
              return (
                <button key={svc.id}
                  onClick={() => { chooseService(svc); setOptionsOpen(false); go('date'); }}
                  className={`w-full rounded-2xl p-4 text-left ${sel ? 'card-ember ember-ring' : 'card'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--chrome)' }}>{svc.name}</p>
                      <p style={{ ...body12, marginTop: '3px', lineHeight: 1.4 }}>{svc.description}</p>
                      <p className="font-mono mt-2" style={{ fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--faint)' }}>
                        {getDurationLabel(svc.duration).toUpperCase()}
                        {svc.warranty && ` · ${svc.warranty.toUpperCase()}`}
                      </p>
                    </div>
                    <p className="gradient-text shrink-0" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px' }}>
                      {formatCurrency(svc.price)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {goal && ['PPF', 'Ceramic'].includes(goal.category) && (
            <div className="card rounded-2xl p-4 mb-6">
              <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                Want an exact price for your car?
              </p>
              <p style={{ ...body12, marginTop: '2px', marginBottom: '10px' }}>
                {goal.category} pricing depends on size and condition — we’ll send a personal quote.
              </p>
              <textarea className="input text-sm mb-2" rows={2} value={quoteMsg} maxLength={300}
                onChange={e => setQuoteMsg(e.target.value)}
                placeholder="Anything we should know? (full body / bonnet only, matte or gloss…)" />
              <CxButton intent="secondary" onClick={sendQuoteRequest} disabled={quoteSending}>
                {quoteSending ? 'Sending…' : 'Request a personal quote'}
              </CxButton>
            </div>
          )}
        </div>
      </CxSheet>

    </div>
  );
}
