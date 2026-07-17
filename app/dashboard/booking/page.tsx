'use client';
import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Car, Check, Loader2,
  Copy, Truck, CreditCard, Banknote, Info, Zap, Shield,
  MapPin, CheckCircle2, Droplets,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import {
  getServices, createBooking, getBookedSlotsForDate,
  STATIC_SERVICES, getUserSubscription, deductMembershipWash,
  getEligiblePromos, validatePromoCode, recordPromoRedemption,
  computeBestDiscount, promoDiscountAmount, fireOpsEvent, requestQuote,
} from '@/lib/firebaseService';
import {
  formatCurrency,
  generateTimeSlots,
  getAvailableDates,
  formatDate,
  formatTime,
  getDurationLabel,
  getBookingWhatsAppMsg,
  PICKUP_FEE,
} from '@/lib/utils';
import type { Service, StepData, Booking, Subscription, BookingDiscount } from '@/lib/types';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import ServiceIcon from '@/components/ui/ServiceIcon';
import { Timestamp } from 'firebase/firestore';

const STEPS = ['Vehicle', 'Service', 'Schedule', 'Review', 'Payment', 'Done'];
const CATS  = ['Washing', 'Ceramic', 'Coating', 'PPF'];

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
        <div className="w-10 h-10 loader-ring" />
      </div>
    }>
      <BookingInner />
    </Suspense>
  );
}

function BookingInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const { user, vehicles, addBookingToStore } = useAppStore();

  const [step, setStep]                         = useState(0);
  const [services, setServices]                 = useState<Service[]>(STATIC_SERVICES);
  const [submitting, setSubmitting]             = useState(false);
  const [data, setData]                         = useState<StepData>({});
  const [cat, setCat]                           = useState(params.get('cat') || 'Washing');
  const [bookedSlots, setBookedSlots]           = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading]         = useState(false);
  const [copiedUpi, setCopiedUpi]               = useState(false);
  const [confirmedId, setConfirmedId]           = useState('');
  const [membership, setMembership]             = useState<Subscription | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);

  const sendQuoteRequest = async () => {
    if (!user || !data.vehicle) return;
    setQuoteSending(true);
    try {
      const qid = await requestQuote({
        customerName: user.name, customerPhone: user.phone || '',
        customerId: user.uid, vehicleName: data.vehicle.name,
        serviceCategory: cat, customerMessage: quoteMsg.trim() || undefined,
      });
      fireOpsEvent('quote_requested', qid);
      toast.success('Quote requested - we\'ll WhatsApp you a price shortly!');
      setQuoteOpen(false); setQuoteMsg('');
    } catch { toast.error('Could not send request'); }
    setQuoteSending(false);
  };
  const [usedMembershipWash, setUsedMembershipWash] = useState(false);
  const [discount, setDiscount]                 = useState<BookingDiscount | undefined>(undefined);
  const [promoInput, setPromoInput]             = useState('');
  const [promoBusy, setPromoBusy]               = useState(false);
  const [manualPromo, setManualPromo]           = useState(false); // user-entered code beats auto-apply

  const upiId  = process.env.NEXT_PUBLIC_UPI_ID || 'automodz@upi';

  // Load services
  useEffect(() => {
    getServices()
      .then(s => setServices(s.filter(x => x.active).sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, []);

  // Deep-link pre-fill from URL params
  useEffect(() => {
    const vId = params.get('vehicleId');
    const sId = params.get('serviceId');
    if (!vId || !sId || !vehicles.length || !services.length) return;
    const v = vehicles.find(x => x.id === vId);
    const s = services.find(x => x.id === sId);
    if (v && s) { setData({ vehicle: v, service: s }); setCat(s.category); setStep(2); }
  }, [services, vehicles]);

  // Load booked slots when date/service changes, factoring in service duration and bay capacity
  useEffect(() => {
    if (!data.date || !data.service) return;
    setSlotsLoading(true);
    getBookedSlotsForDate(data.date, data.service.category, data.service.duration)
      .then(setBookedSlots)
      .finally(() => setSlotsLoading(false));
  }, [data.date, data.service?.category]);

  // Load membership when on service step
  useEffect(() => {
    if (step !== 1 || !user || membership !== null) return;
    setMembershipLoading(true);
    getUserSubscription(user.uid)
      .then(sub => {
        if (sub?.status === 'active') {
          const today = new Date().toISOString().split('T')[0];
          setMembership(sub.endDate >= today ? sub : null);
        } else {
          setMembership(null);
        }
      })
      .catch(() => setMembership(null))
      .finally(() => setMembershipLoading(false));
  }, [step, user?.uid]);

  // Derived values
  const pickupFee          = (data.pickup ? PICKUP_FEE : 0) + (data.drop ? PICKUP_FEE : 0);
  const isWashService      = data.service?.category === 'Washing';
  const membershipPlan     = membership ? MEMBERSHIP_PLANS.find(p => p.id === membership.plan) ?? null : null;
  // Law 1 (Liquid Chrome): tier shown as chrome, never plan.color
  const mpTone = membershipPlan
    ? ({ Silver: 'var(--accent-2)', Gold: 'var(--accent)', Platinum: 'var(--ember-hot)' } as Record<string, string>)[membershipPlan.id] ?? 'var(--ember)'
    : 'var(--ember)';
  const mpMix = (pct: number) => `color-mix(in srgb, ${mpTone} ${pct}%, transparent)`;
  const washesRemaining    = membership ? membership.washesTotal - membership.washesUsed : 0;
  const membershipCoversWash = isWashService && !!membership && washesRemaining > 0 && usedMembershipWash;
  const servicePrice       = membershipCoversWash ? 0 : (data.service?.price || 0);
  // Discount applies to the service price only (never pickup), and not on a free membership wash
  const activeDiscount     = membershipCoversWash ? undefined : discount;
  const total              = Math.max(0, servicePrice - (activeDiscount?.amount ?? 0)) + pickupFee;
  const filtered           = services.filter(s => s.category === cat);
  const timeSlots          = data.service ? generateTimeSlots(data.service.duration) : [];
  const availDates         = getAvailableDates();

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
        toast(`Your current ${discount?.source === 'membership' ? 'membership' : 'auto'} discount is better - kept it`, { icon: 'ℹ️' });
      } else {
        setDiscount({ source: 'promo', promoId: res.promo.id, label: res.promo.label, amount });
        setManualPromo(true);
        toast.success(`${res.promo.label} applied`);
      }
    }
    setPromoBusy(false);
  };

  // Step validation
  const canProceed = () => {
    if (step === 0) return !!data.vehicle;
    if (step === 1) return !!data.service;
    if (step === 2) return !!data.date && !!data.time;
    if (step === 3) return true;
    if (step === 4) {
      if (membershipCoversWash && total === 0) return true;
      if (!data.paymentMethod) return false;
      if (data.paymentMethod === 'upi') return !!(data.transactionId?.trim());
      return true;
    }
    return false;
  };

  // Submit - WhatsApp only fires AFTER Firestore write succeeds
  const handleSubmit = async () => {
    if (!user || !data.vehicle || !data.service || !data.date || !data.time) return;
    setSubmitting(true);

    try {
      let bookingId = '';
      let membershipId: string | undefined;
      let membershipWashApplied = false;

      // Apply membership wash deduction if selected
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
        ? 'cash'
        : data.paymentMethod || 'cash';

      const paymentStatus = membershipWashApplied && total === pickupFee
        ? 'verified'
        : 'pending';

      // Write to Firestore first - WhatsApp fires inside .then()
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

      // Owner gets pinged about the new booking (fire-and-forget)
      fireOpsEvent('booking_created', bookingId);

      // Record promo redemption (fire-and-forget; booking already saved)
      if (activeDiscount?.source === 'promo' && activeDiscount.promoId) {
        recordPromoRedemption({
          promoId: activeDiscount.promoId, userId: user.uid,
          bookingId, discountAmount: activeDiscount.amount,
        }).catch(() => {});
      }

      // Optimistic store update
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
        createdAt:        now,
        updatedAt:        now,
      };
      addBookingToStore(newBooking);

      // WhatsApp fires ONLY after successful Firestore write
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
      setStep(5);

    } catch (err) {
      console.error(err);
      toast.error('Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  // Shared style helpers
  const mono10    = { fontFamily: "var(--font-mono)", fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
  const syne14    = { fontFamily: "var(--font-display)", fontWeight: 700 as const, fontSize: '14px', color: 'var(--chrome)' };
  const grotesk12 = { fontFamily: "var(--font-body)", fontSize: '12px', color: 'var(--steel)' };

  // Membership banner (service step)
  const MembershipBanner = () => {
    if (!membership || !isWashService) return null;
    if (washesRemaining <= 0) return (
      <div className="rounded-xl p-3 mb-4 flex items-center gap-2"
        style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
        <Shield size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
        <p style={{ ...grotesk12, color: 'var(--danger)' }}>
          {membership.plan} membership - all {membership.washesTotal} washes used this month. Full price applies.
        </p>
      </div>
    );
    return (
      <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
        style={{ background: mpMix(8), border: `1px solid ${mpMix(25)}` }}>
        <Zap size={14} style={{ color: mpTone, flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: mpTone }}>
            {membership.plan} Membership Active
          </p>
          <p style={{ ...grotesk12, marginTop: '2px' }}>
            {washesRemaining} wash{washesRemaining !== 1 ? 'es' : ''} remaining. Select any Washing service to use 1 wash.
          </p>
        </div>
      </div>
    );
  };

  // Membership wash toggle (review + payment steps)
  const MembershipWashToggle = () => {
    if (!membership || !isWashService || washesRemaining <= 0) return null;
    return (
      <div className="rounded-2xl p-4 mb-4"
        style={{
          background: usedMembershipWash ? mpMix(7) : 'var(--card)',
          border: `1.5px solid ${usedMembershipWash ? mpMix(38) : 'var(--border-2)'}`,
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={15} style={{ color: mpTone, flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--chrome)' }}>
                Use Membership Wash
              </p>
              <p style={grotesk12}>
                {membership.plan} · {washesRemaining} remaining · saves {formatCurrency(data.service?.price || 0)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUsedMembershipWash(p => !p)}
            className={`toggle-track ${usedMembershipWash ? 'on' : 'off'}`}>
            <div className="toggle-knob" />
          </button>
        </div>
        {usedMembershipWash && (
          <motion.div initial={false} animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 overflow-hidden"
            style={{ borderTop: `1px solid ${mpMix(19)}` }}>
            <div className="flex items-center justify-between">
              <p style={grotesk12}>Service (membership)</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--success)', textDecoration: 'line-through', marginRight: '8px' }}>
                {formatCurrency(data.service?.price || 0)}
              </p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p style={grotesk12}>You pay</p>
              <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>
                {total === 0 ? 'FREE' : formatCurrency(total)}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--void)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-nav px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => step === 0 ? router.back() : setStep(step - 1)}
            className="w-9 h-9 rounded-2xl card flex items-center justify-center shrink-0">
            <ChevronLeft size={15} style={{ color: 'var(--pewter)' }} />
          </button>
          <div className="flex-1">
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: 'var(--chrome)', letterSpacing: '0.09em', lineHeight: 1 }}>
              BOOK SERVICE
            </h1>
            <p style={{ ...mono10, marginTop: '2px' }}>{STEPS[step]} - {step + 1}/{STEPS.length}</p>
          </div>
          {data.service && step > 1 && step < 5 && (
            <div className="text-right">
              <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', lineHeight: 1 }}>
                {membershipCoversWash && total === 0
                  ? <span style={{ color: 'var(--success)' }}>FREE</span>
                  : formatCurrency(total)}
              </p>
              {pickupFee > 0 && (
                <p style={{ ...mono10, marginTop: '2px' }}>
                  INCL. {data.pickup && data.drop ? 'PICKUP + DROP' : data.pickup ? 'PICKUP' : 'DROP'}
                </p>
              )}
              {membershipCoversWash && <p style={{ ...mono10, marginTop: '2px', color: mpTone }}>MEMBERSHIP</p>}
            </div>
          )}
        </div>
        <div className="progress-track">
          <motion.div className="progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
        </div>
      </div>

      <div className="px-4 py-5 pb-36">
        <AnimatePresence mode="wait">

          {/* Step 0 - Vehicle */}
          {step === 0 && (
            <motion.div key="s0" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                SELECT VEHICLE
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>Which car are we detailing?</p>

              {vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 animate-float"
                    style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                    <Car size={28} style={{ color: 'var(--ember)' }} />
                  </div>
                  <p style={{ ...syne14, marginBottom: '6px' }}>No Vehicles</p>
                  <p style={{ ...grotesk12, marginBottom: '24px' }}>Add a vehicle to get started</p>
                  <button onClick={() => router.push('/dashboard/vehicles')} className="btn-ember rounded-xl py-3 px-6">
                    ADD VEHICLE
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map(v => (
                    <motion.button key={v.id} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setData(p => ({ ...p, vehicle: v }));
                        setTimeout(() => setStep(1), 300);
                      }}
                      className={`w-full rounded-2xl p-4 text-left transition-all ${data.vehicle?.id === v.id ? 'ember-ring card-ember' : 'card'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold"
                          style={{ background: data.vehicle?.id === v.id ? 'var(--accent-mist)' : 'var(--cavern)', color: 'var(--chrome)' }}>
                          {v.category.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p style={syne14}>{v.name}</p>
                          <p style={grotesk12}>{v.category} · {v.registrationNumber}</p>
                          {v.color && <p style={{ ...grotesk12, color: 'var(--faint)' }}>{v.color}</p>}
                        </div>
                        {data.vehicle?.id === v.id && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--ember)' }}>
                            <Check size={12} style={{ color: 'var(--on-accent)' }} />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 1 - Service */}
          {step === 1 && (
            <motion.div key="s1" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                CHOOSE SERVICE
              </h2>
              <p style={{ ...grotesk12, marginBottom: '16px' }}>For {data.vehicle?.name}</p>

              {membershipLoading && (
                <div className="flex items-center gap-2 mb-3" style={{ ...grotesk12, color: 'var(--faint)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Checking membership...</span>
                </div>
              )}

              {cat === 'Washing' && !membershipLoading && <MembershipBanner />}

              <div className="flex gap-2 mb-5 overflow-x-auto no-scroll pb-1">
                {CATS.map(c => (
                  <button key={c} onClick={() => setCat(c)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl transition-all"
                    style={{
                      background: cat === c ? 'var(--ember)' : 'var(--dark)',
                      border: '1px solid ' + (cat === c ? 'var(--ember)' : 'var(--border-2)'),
                      fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: cat === c ? 'var(--on-accent)' : 'var(--steel)',
                      boxShadow: cat === c ? '0 2px 12px var(--accent-glow)' : 'none',
                    }}>
                    <span className="inline-flex items-center gap-1.5"><ServiceIcon category={c} size={13} /> {c}</span>
                  </button>
                ))}
              </div>

              {['PPF', 'Ceramic'].includes(cat) && (
                <div className="card rounded-2xl p-4 mb-4">
                  {!quoteOpen ? (
                    <button onClick={() => setQuoteOpen(true)} className="w-full text-left">
                      <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                        Want an exact price for your car?
                      </p>
                      <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                        {cat} pricing depends on your car&rsquo;s size and condition - request a personal quote.
                      </p>
                    </button>
                  ) : (
                    <div>
                      <textarea className="input text-sm mb-2" rows={2} value={quoteMsg} maxLength={300}
                        onChange={e => setQuoteMsg(e.target.value)}
                        placeholder="Anything we should know? (full body / bonnet only, matte or gloss…)" />
                      <div className="flex gap-2">
                        <button onClick={() => setQuoteOpen(false)} className="btn-ghost flex-1 py-2.5 text-xs">Cancel</button>
                        <button onClick={sendQuoteRequest} disabled={quoteSending} className="btn-ember flex-1 py-2.5 text-xs">
                          {quoteSending ? 'Sending…' : 'Request Quote'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {filtered.map(svc => {
                  const isMemberWash = svc.category === 'Washing' && !!membership && washesRemaining > 0;
                  return (
                    <motion.button key={svc.id} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setData(p => ({ ...p, service: svc }));
                        setUsedMembershipWash(isMemberWash);
                        setTimeout(() => setStep(2), 300);
                      }}
                      className={`w-full rounded-2xl p-4 text-left transition-all holo-surface ${data.service?.id === svc.id ? 'ember-ring card-ember' : 'card'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p style={syne14}>{svc.name}</p>
                            {svc.popular && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '99px', background: 'var(--smoke)', color: 'var(--chrome)', border: '1px solid var(--border-strong)' }}>
                                HOT
                              </span>
                            )}
                            {isMemberWash && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '99px', background: mpMix(12), color: mpTone, border: `1px solid ${mpMix(25)}` }}>
                                MEMBER
                              </span>
                            )}
                          </div>
                          <p style={{ ...grotesk12, lineHeight: 1.4, marginBottom: '8px' }}>{svc.description}</p>
                          <div className="flex items-center gap-3" style={{ ...mono10, opacity: 0.6 }}>
                            <span>⏱ {getDurationLabel(svc.duration)}</span>
                            {svc.warranty && <span className="inline-flex items-center gap-1"><Check size={12} /> {svc.warranty}</span>}
                            {svc.brand && <span>◆ {svc.brand}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isMemberWash ? (
                            <div>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                                {formatCurrency(svc.price)}
                              </p>
                              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: 'var(--success)' }}>FREE</p>
                            </div>
                          ) : (
                            <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px' }}>
                              {formatCurrency(svc.price)}
                            </p>
                          )}
                          {data.service?.id === svc.id && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center ml-auto mt-2" style={{ background: 'var(--ember)' }}>
                              <Check size={12} style={{ color: 'var(--on-accent)' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2 - Schedule */}
          {step === 2 && (
            <motion.div key="s2" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                SCHEDULE
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>
                {data.service?.name} · {getDurationLabel(data.service?.duration || 0)}
              </p>

              {/* Date picker */}
              <div className="mb-6">
                <p style={{ ...mono10, marginBottom: '10px' }}>Date</p>
                <div className="flex gap-2 overflow-x-auto no-scroll pb-2">
                  {availDates.map(d => {
                    const dt  = new Date(d + 'T12:00:00');
                    const sel = data.date === d;
                    return (
                      <button key={d} onClick={() => setData(p => ({ ...p, date: d, time: '' }))}
                        className="flex-shrink-0 w-16 rounded-2xl p-3 flex flex-col items-center gap-1 transition-all"
                        style={{
                          background: sel ? 'var(--ember)' : 'var(--dark)',
                          border: '1px solid ' + (sel ? 'var(--ember)' : 'var(--border-2)'),
                          boxShadow: sel ? '0 4px 16px var(--accent-glow)' : 'none',
                        }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)', letterSpacing: '0.08em' }}>
                          {dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: sel ? 'var(--on-accent)' : 'var(--chrome)', lineHeight: 1 }}>
                          {dt.getDate()}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: sel ? 'var(--on-accent-dim)' : 'var(--faint)', letterSpacing: '0.06em' }}>
                          {dt.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {data.date && (
                <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-3">
                    <p style={mono10}>Time Slot</p>
                    {slotsLoading && <div className="w-4 h-4 loader-ring" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map(t => {
                      const sel   = data.time === t;
                      const taken = bookedSlots.includes(t);
                      return (
                        <button key={t} onClick={() => !taken && setData(p => ({ ...p, time: t }))}
                          disabled={taken}
                          className="rounded-xl py-3 transition-all relative"
                          style={{
                            background: sel ? 'var(--ember)' : taken ? 'var(--cavern)' : 'var(--dark)',
                            border: '1px solid ' + (sel ? 'var(--ember)' : taken ? 'var(--border)' : 'var(--border-2)'),
                            fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
                            color: sel ? 'var(--on-accent)' : taken ? 'var(--faint)' : 'var(--pewter)',
                            opacity: taken ? 0.4 : 1,
                            cursor: taken ? 'not-allowed' : 'pointer',
                            textDecoration: taken ? 'line-through' : 'none',
                            boxShadow: sel ? '0 2px 12px var(--accent-glow)' : 'none',
                          }}>
                          {formatTime(t)}
                          {taken && (
                            <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1 rounded-full"
                              style={{ background: 'var(--danger)', color: 'white', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                              FULL
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3 - Review */}
          {step === 3 && (
            <motion.div key="s3" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                REVIEW
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>Confirm your booking details</p>

              <MembershipWashToggle />

              <div className="card-ember rounded-2xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  {([
                    ['Vehicle', data.vehicle?.name],
                    ['Service', data.service?.name],
                    ['Date',    data.date && formatDate(data.date)],
                    ['Time',    data.time && formatTime(data.time)],
                  ] as [string, string | undefined][]).map(([l, v]) => (
                    <div key={l}>
                      <p style={mono10}>{l}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--fg-dim)', fontWeight: 500, marginTop: '2px' }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-2)' }}>
                  <p style={grotesk12}>{membershipCoversWash ? 'Service (membership covered)' : 'Service Price'}</p>
                  {membershipCoversWash ? (
                    <div className="flex items-center gap-2">
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                        {formatCurrency(data.service?.price || 0)}
                      </p>
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: 'var(--success)' }}>FREE</p>
                    </div>
                  ) : (
                    <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>
                      {formatCurrency(data.service?.price || 0)}
                    </p>
                  )}
                </div>
                {activeDiscount && (
                  <div className="pt-2 mt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>
                      {activeDiscount.label}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: 'var(--success)' }}>
                      −{formatCurrency(activeDiscount.amount)}
                    </p>
                  </div>
                )}
                {(activeDiscount || pickupFee > 0) && (
                  <div className="pt-2 mt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <p style={grotesk12}>You pay</p>
                    <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>
                      {formatCurrency(total)}
                    </p>
                  </div>
                )}
              </div>

              {/* Promo code */}
              {!membershipCoversWash && (
                <div className="card rounded-2xl p-4 mb-4">
                  <p style={{ ...mono10, marginBottom: '8px' }}>PROMO CODE</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Have a code?" value={promoInput}
                      onChange={e => setPromoInput(e.target.value.toUpperCase())}
                      className="input text-sm flex-1 uppercase" />
                    <button onClick={applyPromoCode} disabled={promoBusy || !promoInput.trim()}
                      className="btn-ghost px-5 text-sm" style={{ opacity: promoInput.trim() ? 1 : 0.5 }}>
                      {promoBusy ? '…' : 'Apply'}
                    </button>
                  </div>
                  {activeDiscount?.source === 'membership' && (
                    <p style={{ ...grotesk12, marginTop: '8px', color: 'var(--success)' }}>
                      Your membership discount is applied automatically - a better code will replace it.
                    </p>
                  )}
                </div>
              )}

              {/* Pickup / Drop - separate legs, ₹50 each */}
              <div className="card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, color: 'var(--fg-dim)' }}>
                    Doorstep Pickup &amp; Drop
                  </p>
                </div>
                {([
                  { key: 'pickup' as const, label: 'Pickup', sub: 'We collect your car from your address' },
                  { key: 'drop'   as const, label: 'Drop',   sub: 'We return your car after the service' },
                ]).map(leg => (
                  <div key={leg.key} className="flex items-center justify-between py-2.5"
                    style={{ borderTop: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500, color: 'var(--fg-dim)' }}>
                        {leg.label} <span style={{ color: 'var(--ember)' }}>+{formatCurrency(PICKUP_FEE)}</span>
                      </p>
                      <p style={grotesk12}>{leg.sub}</p>
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
                    <motion.div initial={false} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                      <input type="text"
                        placeholder={data.pickup ? 'Pickup address' : 'Drop-off address'}
                        value={data.pickupAddress || ''}
                        onChange={e => setData(p => ({ ...p, pickupAddress: e.target.value }))}
                        className="input text-sm" />
                      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                        <p style={grotesk12}>
                          Total (incl. {data.pickup && data.drop ? 'pickup + drop' : data.pickup ? 'pickup' : 'drop'})
                        </p>
                        <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>
                          {formatCurrency(total)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Step 4 - Payment */}
          {step === 4 && (
            <motion.div key="s4" initial={false} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                PAYMENT
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>
                Total:{' '}
                <strong style={{ color: membershipCoversWash && total === 0 ? 'var(--success)' : 'var(--fg)' }}>
                  {membershipCoversWash && total === 0 ? 'FREE (Membership)' : formatCurrency(total)}
                </strong>
              </p>

              {membershipCoversWash && total === 0 ? (
                <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6 text-center"
                  style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
                  <div className="mb-3 flex justify-center"><CheckCircle2 size={40} style={{ color: 'var(--success)' }} /></div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'var(--success)', marginBottom: '6px' }}>
                    Covered by Membership
                  </p>
                  <p style={{ ...grotesk12, lineHeight: 1.6 }}>
                    This wash is fully covered by your {membership?.plan} plan.
                    No payment required - 1 wash will be deducted.
                  </p>
                  <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--cavern)', border: '1px solid var(--border-2)' }}>
                    <p style={{ ...mono10, color: 'var(--faint)' }}>AFTER THIS BOOKING</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: mpTone, marginTop: '4px' }}>
                      {washesRemaining - 1} wash{washesRemaining - 1 !== 1 ? 'es' : ''} remaining
                    </p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-3 mb-5">
                    {[
                      { id: 'upi',  Icon: CreditCard, label: 'Pay via UPI',    sub: 'GPay · PhonePe · Paytm · any UPI' },
                      { id: 'cash', Icon: Banknote,   label: 'Cash at Studio', sub: 'Pay on arrival at Maninagar' },
                    ].map(m => {
                      const sel = data.paymentMethod === m.id;
                      return (
                        <button key={m.id}
                          onClick={() => setData(p => ({ ...p, paymentMethod: m.id as 'upi' | 'cash' }))}
                          className={`w-full rounded-2xl p-4 text-left flex items-center gap-4 transition-all ${sel ? 'ember-ring card-ember' : 'card'}`}>
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: sel ? 'var(--accent-haze)' : 'var(--cavern)' }}>
                            <m.Icon size={18} style={{ color: sel ? 'var(--ember)' : 'var(--steel)' }} />
                          </div>
                          <div className="flex-1">
                            <p style={syne14}>{m.label}</p>
                            <p style={grotesk12}>{m.sub}</p>
                          </div>
                          {sel && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--ember)' }}>
                              <Check size={12} style={{ color: 'var(--on-accent)' }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {data.paymentMethod === 'upi' && (
                      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card-ember rounded-2xl p-5">
                        <div className="text-center mb-5">
                          <p style={mono10}>Amount to Pay</p>
                          <p className="gradient-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', marginTop: '4px', lineHeight: 1 }}>
                            {formatCurrency(total)}
                          </p>
                        </div>
                        <p style={{ ...mono10, marginBottom: '8px' }}>AutoModz UPI ID</p>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1 rounded-xl px-4 py-3"
                            style={{ background: 'var(--dark)', border: '1px solid var(--border-2)', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                            {upiId}
                          </div>
                          <button onClick={() => {
                            navigator.clipboard.writeText(upiId);
                            setCopiedUpi(true);
                            toast.success('Copied!');
                            setTimeout(() => setCopiedUpi(false), 2500);
                          }}
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
                            style={{ background: copiedUpi ? 'var(--success)' : 'var(--ember)' }}>
                            {copiedUpi ? <Check size={16} style={{ color: 'var(--on-accent)' }} /> : <Copy size={16} style={{ color: 'var(--on-accent)' }} />}
                          </button>
                        </div>
                        <div className="rounded-xl p-3 mb-4 space-y-1.5" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                          {[
                            'Open any UPI app and send to the ID above',
                            `Send exactly ${formatCurrency(total)} as the payment`,
                            'Copy your transaction ID from the app receipt',
                            'Paste it in the field below to confirm booking',
                          ].map((s, i) => (
                            <p key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--steel)', display: 'flex', gap: '8px' }}>
                              <span style={{ color: 'var(--ember)', flexShrink: 0 }}>{i + 1}.</span>{s}
                            </p>
                          ))}
                        </div>
                        <p style={{ ...mono10, marginBottom: '8px' }}>
                          UPI Transaction ID <span style={{ color: 'var(--ember)' }}>*required</span>
                        </p>
                        <input type="text" placeholder="e.g. 412345678901"
                          value={data.transactionId || ''}
                          onChange={e => setData(p => ({ ...p, transactionId: e.target.value.trim() }))}
                          className="input"
                          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontSize: '14px' }}
                        />
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--faint)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={10} /> Found in your UPI app → Payment History
                        </p>
                      </motion.div>
                    )}
                    {data.paymentMethod === 'cash' && (
                      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card rounded-2xl p-5 text-center">
                        <div className="mb-3 flex justify-center animate-float"><Banknote size={38} style={{ color: 'var(--chrome)' }} /></div>
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--chrome)', marginBottom: '4px' }}>
                          Pay {formatCurrency(total)} at Studio
                        </p>
                        <p style={grotesk12}>Cash on arrival. Exact change preferred.</p>
                        <p className="inline-flex items-center gap-1.5" style={{ ...mono10, marginTop: '12px', color: 'var(--ember)' }}>
                          <MapPin size={11} /> BHAIRAVNATH RD, MANINAGAR
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}

          {/* Step 5 - Confirmed */}
          {step === 5 && (
            <motion.div key="s5" initial={false} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-ember-pulse"
                style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                <Check size={44} style={{ color: 'var(--ember)' }} />
              </motion.div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--chrome)', letterSpacing: '0.04em', marginBottom: '8px' }}>
                BOOKED
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--steel)', marginBottom: '4px' }}>
                WhatsApp confirmation sent to studio
              </p>
              {membershipCoversWash && (
                <p className="inline-flex items-center justify-center gap-1.5 w-full" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: mpTone, marginBottom: '4px', letterSpacing: '0.08em' }}>
                  <Droplets size={11} /> 1 {membership?.plan} WASH DEDUCTED
                </p>
              )}
              {data.paymentMethod === 'upi' && data.transactionId && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--faint)', marginBottom: '20px' }}>
                  TXN: {data.transactionId}
                </p>
              )}

              <div className="card-ember rounded-2xl p-4 text-left mb-6">
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ['Vehicle', data.vehicle?.name],
                    ['Service', data.service?.name],
                    ['Date',    data.date && formatDate(data.date)],
                    ['Time',    data.time && formatTime(data.time)],
                    ['Total',   membershipCoversWash && total === 0 ? 'FREE' : formatCurrency(total)],
                    ['ID',      confirmedId.slice(0, 8).toUpperCase()],
                  ] as [string, string | undefined][]).map(([l, v]) => (
                    <div key={l}>
                      <p style={mono10}>{l}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--fg-dim)', fontWeight: 500, marginTop: '2px' }}>{v}</p>
                    </div>
                  ))}
                </div>
                {(data.pickup || data.drop) && (
                  <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-2)' }}>
                    <Truck size={12} style={{ color: 'var(--ember)' }} />
                    <p style={{ ...mono10, color: 'var(--ember)' }}>
                      {data.pickup && data.drop ? 'PICKUP & DROP' : data.pickup ? 'PICKUP' : 'DROP'} ARRANGED +{formatCurrency(pickupFee)}
                    </p>
                  </div>
                )}
              </div>

              <button onClick={() => router.push('/dashboard')} className="btn-ember w-full rounded-xl py-4">
                BACK TO HOME
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {step < 5 && (
        <div className="fixed left-0 right-0 z-[60] px-4 py-3 glass-nav"
          style={{ borderTop: '1px solid var(--border)', bottom: 'var(--bottom-nav-h)' }}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => step === 4 ? handleSubmit() : canProceed() && setStep(step + 1)}
            disabled={!canProceed() || submitting}
            className="btn-ember w-full rounded-xl py-4 flex items-center justify-center gap-2">
            {submitting
              ? <><div className="w-4 h-4 loader-ring" /> PROCESSING...</>
              : step === 4
                ? membershipCoversWash && total === 0
                  ? 'CONFIRM BOOKING (FREE)'
                  : `CONFIRM · ${formatCurrency(total)}`
                : <><span>CONTINUE</span><ChevronRight size={17} /></>}
          </motion.button>
        </div>
      )}
    </div>
  );
}