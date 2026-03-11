'use client';
import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Car, Check, Loader2,
  Copy, Truck, CreditCard, Banknote, Info, Zap, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/lib/store';
import {
  getServices, createBooking, getBookedSlotsForDate,
  STATIC_SERVICES, getUserSubscription, deductMembershipWash,
} from '@/lib/firebaseService';
import {
  formatCurrency, generateTimeSlots, getAvailableDates,
  formatDate, formatTime, getDurationLabel, getCategoryIcon,
  getBookingWhatsAppMsg, PICKUP_FEE,
} from '@/lib/utils';
import type { Service, StepData, Booking, Subscription } from '@/lib/types';
import { MEMBERSHIP_PLANS } from '@/lib/types';

const STEPS = ['Vehicle', 'Service', 'Schedule', 'Details', 'Payment', 'Done'];
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

  const [step, setStep]               = useState(0);
  const [services, setServices]       = useState<Service[]>(STATIC_SERVICES);
  const [submitting, setSubmitting]   = useState(false);
  const [data, setData]               = useState<StepData>({});
  const [cat, setCat]                 = useState(params.get('cat') || 'Washing');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [copiedUpi, setCopiedUpi]     = useState(false);
  const [confirmedId, setConfirmedId] = useState('');

  // membership state
  const [membership, setMembership]         = useState<Subscription | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [usedMembershipWash, setUsedMembershipWash] = useState(false);

  const isDemo = user?.role === 'demo';
  const upiId  = process.env.NEXT_PUBLIC_UPI_ID || 'automodz@upi';

  // ── load services ──────────────────────────────────────────────────────────
  useEffect(() => {
    getServices()
      .then(s => setServices(s.filter(x => x.active).sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, []);

  // ── deep-link: pre-fill vehicle + service from URL params ─────────────────
  useEffect(() => {
    const vId = params.get('vehicleId'), sId = params.get('serviceId');
    if (!vId || !sId || !vehicles.length || !services.length) return;
    const v = vehicles.find(x => x.id === vId), s = services.find(x => x.id === sId);
    if (v && s) { setData({ vehicle: v, service: s }); setCat(s.category); setStep(2); }
  }, [services, vehicles]);

  // ── load booked slots when date changes ───────────────────────────────────
  useEffect(() => {
    if (!data.date || !data.service) return;
    setSlotsLoading(true);
    getBookedSlotsForDate(data.date, data.service.category)
      .then(setBookedSlots)
      .finally(() => setSlotsLoading(false));
  }, [data.date, data.service?.category]);

  // ── load membership when user lands on service step (step 1) ──────────────
  useEffect(() => {
    if (step !== 1 || !user || isDemo) return;
    if (membership !== null) return; // already loaded
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

  // ── derived values ─────────────────────────────────────────────────────────
  const pickupFee     = data.pickupDrop ? PICKUP_FEE * 2 : 0;
  const isWashService = data.service?.category === 'Washing';
  const membershipPlan = membership
    ? MEMBERSHIP_PLANS.find(p => p.id === membership.plan) ?? null
    : null;
  const washesRemaining = membership
    ? membership.washesTotal - membership.washesUsed
    : 0;
  // If member has washes remaining and service is a wash → cover by membership → total = pickup only
  const membershipCoversWash = isWashService && !!membership && washesRemaining > 0 && usedMembershipWash;
  const servicePrice = membershipCoversWash ? 0 : (data.service?.price || 0);
  const total        = servicePrice + pickupFee;

  const filtered   = services.filter(s => s.category === cat);
  const timeSlots  = data.service ? generateTimeSlots(data.service.duration) : [];
  const availDates = getAvailableDates();

  // ── step validation ────────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return !!data.vehicle;
    if (step === 1) return !!data.service;
    if (step === 2) return !!data.date && !!data.time;
    if (step === 3) return true;
    if (step === 4) {
      // if membership covers it fully and no pickup fee → no payment step needed
      if (membershipCoversWash && total === 0) return true;
      if (!data.paymentMethod) return false;
      if (data.paymentMethod === 'upi') return !!(data.transactionId?.trim());
      return true;
    }
    return false;
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !data.vehicle || !data.service || !data.date || !data.time) return;
    // payment method required unless fully covered by membership
    if (!membershipCoversWash || total > 0) {
      if (!data.paymentMethod) return;
    }

    setSubmitting(true);
    try {
      let bookingId = 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      let membershipId: string | undefined;

      if (!isDemo) {
        // deduct membership wash BEFORE creating booking so state is consistent
        if (membershipCoversWash && membership) {
          const result = await deductMembershipWash(user.uid);
          if (!result.success) {
            toast.error('Membership wash could not be applied. Proceeding at full price.');
            setUsedMembershipWash(false);
          } else {
            membershipId = result.subscriptionId;
          }
        }

        bookingId = await createBooking({
          userId: user.uid,
          userName: user.name,
          userPhone: user.phone || '',
          userEmail: user.email,
          vehicleId: data.vehicle.id,
          vehicleName: data.vehicle.name,
          vehicleRegNo: data.vehicle.registrationNumber,
          serviceId: data.service.id,
          serviceName: data.service.name,
          serviceCategory: data.service.category,
          serviceBasePrice: data.service.price,   // always store original price
          pickupDropRequired: !!data.pickupDrop,
          pickupDropFee: pickupFee,
          pickupAddress: data.pickupAddress || '',
          totalAmount: total,                      // 0 if membership-covered + no pickup
          scheduledDate: data.date,
          scheduledTime: data.time,
          paymentMethod: membershipCoversWash && total === 0
            ? 'cash'  // placeholder — no payment needed
            : data.paymentMethod!,
          paymentStatus: membershipCoversWash && total === 0 ? 'verified' : 'pending',
          transactionId: data.transactionId || '',
          status: 'pending',
          usedMembershipWash: membershipCoversWash,
          membershipId,
        });

        const nb: Booking = {
          id: bookingId, userId: user.uid, userName: user.name,
          userPhone: user.phone || '', userEmail: user.email,
          vehicleId: data.vehicle.id, vehicleName: data.vehicle.name,
          vehicleRegNo: data.vehicle.registrationNumber,
          serviceId: data.service.id, serviceName: data.service.name,
          serviceCategory: data.service.category,
          serviceBasePrice: data.service.price,
          pickupDropRequired: !!data.pickupDrop,
          pickupDropFee: pickupFee, pickupAddress: data.pickupAddress,
          totalAmount: total, scheduledDate: data.date, scheduledTime: data.time,
          status: 'pending',
          paymentMethod: membershipCoversWash && total === 0 ? 'cash' : data.paymentMethod!,
          paymentStatus: membershipCoversWash && total === 0 ? 'verified' : 'pending',
          transactionId: data.transactionId,
          usedMembershipWash: membershipCoversWash,
          membershipId,
          createdAt: null as any, updatedAt: null as any,
        };
        addBookingToStore(nb);

        const msg = getBookingWhatsAppMsg({
          userName: user.name, vehicleName: data.vehicle.name,
          serviceName: data.service.name, scheduledDate: data.date,
          scheduledTime: data.time, totalAmount: total, id: bookingId,
          pickupDropRequired: !!data.pickupDrop,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
        });
        setTimeout(() => window.open(
          `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919876543210'}?text=${encodeURIComponent(msg)}`,
          '_blank',
        ), 500);
      }

      setConfirmedId(bookingId);
      setStep(5);
    } catch {
      toast.error('Booking failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  // ── shared style helpers ───────────────────────────────────────────────────
  const mono10    = { fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase' as const };
  const syne14    = { fontFamily: "'Syne', sans-serif", fontWeight: 700 as const, fontSize: '14px', color: 'var(--chrome)' };
  const grotesk12 = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)' };

  // ── membership banner shown on service step ────────────────────────────────
  const MembershipBanner = () => {
    if (!membership || !isWashService) return null;
    if (washesRemaining <= 0) return (
      <div className="rounded-xl p-3 mb-4 flex items-center gap-2"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Shield size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: '#EF4444' }}>
          {membership.plan} membership — all {membership.washesTotal} washes used this month.
          This booking will be charged at full price.
        </p>
      </div>
    );
    return (
      <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
        style={{ background: `${membershipPlan?.color ?? 'var(--ember)'}14`, border: `1px solid ${membershipPlan?.color ?? 'var(--ember)'}40` }}>
        <Zap size={14} style={{ color: membershipPlan?.color ?? 'var(--ember)', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '13px', color: membershipPlan?.color ?? 'var(--ember)' }}>
            {membership.plan} Membership Active
          </p>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)', marginTop: '2px' }}>
            {washesRemaining} wash{washesRemaining !== 1 ? 'es' : ''} remaining.
            {' '}Select any Washing service to use 1 wash from your plan.
          </p>
        </div>
      </div>
    );
  };

  // ── membership wash toggle shown on review + payment steps ────────────────
  const MembershipWashToggle = () => {
    if (!membership || !isWashService || washesRemaining <= 0) return null;
    return (
      <div className="rounded-2xl p-4 mb-4"
        style={{
          background: usedMembershipWash
            ? `${membershipPlan?.color ?? 'var(--ember)'}12`
            : 'var(--card)',
          border: `1.5px solid ${usedMembershipWash ? (membershipPlan?.color ?? 'var(--ember)') + '60' : 'var(--border-2)'}`,
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={15} style={{ color: membershipPlan?.color ?? 'var(--ember)', flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 600, color: 'var(--chrome)' }}>
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 overflow-hidden"
            style={{ borderTop: `1px solid ${membershipPlan?.color ?? 'var(--ember)'}30` }}>
            <div className="flex items-center justify-between">
              <p style={grotesk12}>Service (membership)</p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#22C55E', textDecoration: 'line-through', marginRight: '8px' }}>
                {formatCurrency(data.service?.price || 0)}
              </p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p style={grotesk12}>You pay</p>
              <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px' }}>
                {total === 0 ? 'FREE' : formatCurrency(total)}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--void)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 glass-nav px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => step === 0 ? router.back() : setStep(step - 1)}
            className="w-9 h-9 rounded-2xl card flex items-center justify-center shrink-0">
            <ChevronLeft size={15} style={{ color: 'var(--pewter)' }} />
          </button>
          <div className="flex-1">
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '15px', color: 'var(--chrome)', letterSpacing: '0.09em', lineHeight: 1 }}>
              BOOK SERVICE
            </h1>
            <p style={{ ...mono10, marginTop: '2px' }}>{STEPS[step]} — {step + 1}/{STEPS.length}</p>
          </div>
          {data.service && step > 1 && step < 5 && (
            <div className="text-right">
              <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', lineHeight: 1 }}>
                {membershipCoversWash && total === 0 ? (
                  <span style={{ color: '#22C55E' }}>FREE</span>
                ) : formatCurrency(total)}
              </p>
              {pickupFee > 0 && <p style={{ ...mono10, marginTop: '2px' }}>INCL. PICKUP</p>}
              {membershipCoversWash && <p style={{ ...mono10, marginTop: '2px', color: membershipPlan?.color }}>MEMBERSHIP</p>}
            </div>
          )}
        </div>
        <div className="progress-track">
          <motion.div className="progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
        </div>
      </div>

      <div className="px-4 py-5 pb-32">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Vehicle ─────────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                SELECT VEHICLE
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>Which car are we detailing?</p>

              {vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 animate-float"
                    style={{ background: 'rgba(255,69,0,0.08)', border: '1px solid rgba(255,69,0,0.15)' }}>
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
                      onClick={() => setData(p => ({ ...p, vehicle: v }))}
                      className={`w-full rounded-2xl p-4 text-left transition-all ${data.vehicle?.id === v.id ? 'ember-ring card-ember' : 'card'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                          style={{ background: data.vehicle?.id === v.id ? 'rgba(255,69,0,0.15)' : 'var(--cavern)' }}>
                          🚗
                        </div>
                        <div className="flex-1">
                          <p style={syne14}>{v.name}</p>
                          <p style={grotesk12}>{v.category} · {v.registrationNumber}</p>
                          {v.color && <p style={{ ...grotesk12, color: 'var(--faint)' }}>{v.color}</p>}
                        </div>
                        {data.vehicle?.id === v.id && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--ember)' }}>
                            <Check size={12} style={{ color: 'white' }} />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 1: Service ─────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                CHOOSE SERVICE
              </h2>
              <p style={{ ...grotesk12, marginBottom: '16px' }}>For {data.vehicle?.name}</p>

              {/* membership loading indicator */}
              {membershipLoading && (
                <div className="flex items-center gap-2 mb-3" style={{ ...grotesk12, color: 'var(--faint)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Checking membership...</span>
                </div>
              )}

              {/* membership banner — shown when Washing tab is active */}
              {cat === 'Washing' && !membershipLoading && <MembershipBanner />}

              <div className="flex gap-2 mb-5 overflow-x-auto no-scroll pb-1">
                {CATS.map(c => (
                  <button key={c} onClick={() => setCat(c)}
                    className="flex-shrink-0 px-4 py-2 rounded-xl transition-all"
                    style={{
                      background: cat === c ? 'var(--ember)' : 'var(--dark)',
                      border: '1px solid ' + (cat === c ? 'var(--ember)' : 'var(--border-2)'),
                      fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: cat === c ? 'white' : 'var(--steel)',
                      boxShadow: cat === c ? '0 2px 12px rgba(255,69,0,0.3)' : 'none',
                    }}>
                    {getCategoryIcon(c)} {c}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filtered.map(svc => {
                  const isMemberWash = svc.category === 'Washing' && !!membership && washesRemaining > 0;
                  return (
                    <motion.button key={svc.id} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setData(p => ({ ...p, service: svc }));
                        // auto-enable membership wash when a wash service is selected
                        if (isMemberWash) setUsedMembershipWash(true);
                        else setUsedMembershipWash(false);
                      }}
                      className={`w-full rounded-2xl p-4 text-left transition-all holo-surface ${data.service?.id === svc.id ? 'ember-ring card-ember' : 'card'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-3">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p style={syne14}>{svc.name}</p>
                            {svc.popular && (
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '99px', background: 'rgba(255,69,0,0.15)', color: 'var(--ember)', border: '1px solid rgba(255,69,0,0.25)' }}>
                                HOT
                              </span>
                            )}
                            {isMemberWash && (
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '99px', background: `${membershipPlan?.color ?? '#EAB308'}20`, color: membershipPlan?.color ?? '#EAB308', border: `1px solid ${membershipPlan?.color ?? '#EAB308'}40` }}>
                                MEMBER
                              </span>
                            )}
                          </div>
                          <p style={{ ...grotesk12, lineHeight: 1.4, marginBottom: '8px' }}>{svc.description}</p>
                          <div className="flex items-center gap-3" style={{ ...mono10, opacity: 0.6 }}>
                            <span>⏱ {getDurationLabel(svc.duration)}</span>
                            {svc.warranty && <span>🛡 {svc.warranty}</span>}
                            {svc.brand && <span>🏷 {svc.brand}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isMemberWash ? (
                            <div>
                              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                                {formatCurrency(svc.price)}
                              </p>
                              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '14px', color: '#22C55E' }}>
                                FREE
                              </p>
                            </div>
                          ) : (
                            <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px' }}>
                              {formatCurrency(svc.price)}
                            </p>
                          )}
                          {data.service?.id === svc.id && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center ml-auto mt-2" style={{ background: 'var(--ember)' }}>
                              <Check size={12} style={{ color: 'white' }} />
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

          {/* ── Step 2: Schedule ────────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
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
                          boxShadow: sel ? '0 4px 16px rgba(255,69,0,0.35)' : 'none',
                        }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: sel ? 'rgba(255,255,255,0.7)' : 'var(--faint)', letterSpacing: '0.08em' }}>
                          {dt.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
                        </span>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '20px', color: sel ? 'white' : 'var(--chrome)', lineHeight: 1 }}>
                          {dt.getDate()}
                        </span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: sel ? 'rgba(255,255,255,0.7)' : 'var(--faint)', letterSpacing: '0.06em' }}>
                          {dt.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {data.date && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
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
                            fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', fontWeight: 500,
                            color: sel ? 'white' : taken ? 'var(--faint)' : 'var(--pewter)',
                            opacity: taken ? 0.4 : 1,
                            cursor: taken ? 'not-allowed' : 'pointer',
                            textDecoration: taken ? 'line-through' : 'none',
                            boxShadow: sel ? '0 2px 12px rgba(255,69,0,0.3)' : 'none',
                          }}>
                          {formatTime(t)}
                          {taken && (
                            <span className="absolute -top-1.5 -right-1.5 text-[8px] px-1 rounded-full"
                              style={{ background: '#ef4444', color: 'white', fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em' }}>
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

          {/* ── Step 3: Review ──────────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                REVIEW
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>Confirm booking details</p>

              {/* membership wash toggle */}
              <MembershipWashToggle />

              <div className="card-ember rounded-2xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  {[
                    ['Vehicle', data.vehicle?.name],
                    ['Service', data.service?.name],
                    ['Date', data.date && formatDate(data.date)],
                    ['Time', data.time && formatTime(data.time)],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <p style={mono10}>{l}</p>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--fg-dim)', fontWeight: 500, marginTop: '2px' }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,69,0,0.15)' }}>
                  <p style={grotesk12}>
                    {membershipCoversWash ? 'Service (membership covered)' : 'Service Price'}
                  </p>
                  {membershipCoversWash ? (
                    <div className="flex items-center gap-2">
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: 'var(--faint)', textDecoration: 'line-through' }}>
                        {formatCurrency(data.service?.price || 0)}
                      </p>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '16px', color: '#22C55E' }}>
                        FREE
                      </p>
                    </div>
                  ) : (
                    <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px' }}>
                      {formatCurrency(data.service?.price || 0)}
                    </p>
                  )}
                </div>
              </div>

              {/* Pickup toggle */}
              <div className="card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Truck size={15} style={{ color: 'var(--ember)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: 'var(--fg-dim)' }}>
                        Pickup &amp; Drop
                      </p>
                      <p style={grotesk12}>+{formatCurrency(PICKUP_FEE)} pickup + {formatCurrency(PICKUP_FEE)} drop</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setData(p => ({ ...p, pickupDrop: !p.pickupDrop, pickupAddress: p.pickupDrop ? '' : p.pickupAddress }))}
                    className={`toggle-track ${data.pickupDrop ? 'on' : 'off'}`}>
                    <div className="toggle-knob" />
                  </button>
                </div>
                <p style={grotesk12}>We collect your car from your address and return it after service.</p>
                <AnimatePresence>
                  {data.pickupDrop && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
                      <input type="text" placeholder="Your pickup address"
                        value={data.pickupAddress || ''}
                        onChange={e => setData(p => ({ ...p, pickupAddress: e.target.value }))}
                        className="input text-sm" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {data.pickupDrop && (
                  <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                    <p style={grotesk12}>Total (with pickup)</p>
                    <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px' }}>
                      {formatCurrency(total)}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Payment ─────────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '22px', color: 'var(--chrome)', letterSpacing: '0.03em', marginBottom: '4px' }}>
                PAYMENT
              </h2>
              <p style={{ ...grotesk12, marginBottom: '20px' }}>
                Total:{' '}
                <strong style={{ color: membershipCoversWash && total === 0 ? '#22C55E' : 'var(--fg)' }}>
                  {membershipCoversWash && total === 0 ? 'FREE (Membership)' : formatCurrency(total)}
                </strong>
              </p>

              {/* membership covers it fully — skip payment */}
              {membershipCoversWash && total === 0 ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6 text-center"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <div className="text-4xl mb-3">🎉</div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: '#22C55E', marginBottom: '6px' }}>
                    Covered by Membership
                  </p>
                  <p style={{ ...grotesk12, lineHeight: 1.6 }}>
                    This wash is fully covered by your {membership?.plan} plan.
                    No payment required — 1 wash will be deducted from your allowance.
                  </p>
                  <div className="mt-4 rounded-xl p-3"
                    style={{ background: 'var(--cavern)', border: '1px solid var(--border-2)' }}>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--faint)', letterSpacing: '0.1em' }}>
                      AFTER THIS BOOKING
                    </p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '16px', color: membershipPlan?.color, marginTop: '4px' }}>
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
                            style={{ background: sel ? 'rgba(255,69,0,0.2)' : 'var(--cavern)' }}>
                            <m.Icon size={18} style={{ color: sel ? 'var(--ember)' : 'var(--steel)' }} />
                          </div>
                          <div className="flex-1">
                            <p style={syne14}>{m.label}</p>
                            <p style={grotesk12}>{m.sub}</p>
                          </div>
                          {sel && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: 'var(--ember)' }}>
                              <Check size={12} style={{ color: 'white' }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {data.paymentMethod === 'upi' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card-ember rounded-2xl p-5">
                        <div className="text-center mb-5">
                          <p style={mono10}>Amount to Pay</p>
                          <p className="gradient-text" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '32px', marginTop: '4px', lineHeight: 1 }}>
                            {formatCurrency(total)}
                          </p>
                        </div>
                        <p style={{ ...mono10, marginBottom: '8px' }}>AutoModz UPI ID</p>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1 rounded-xl px-4 py-3"
                            style={{ background: 'var(--dark)', border: '1px solid var(--border-2)', fontFamily: "'Space Mono', monospace", fontSize: '13px', color: 'var(--chrome)', letterSpacing: '0.06em' }}>
                            {upiId}
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(upiId); setCopiedUpi(true); toast.success('Copied!'); setTimeout(() => setCopiedUpi(false), 2500); }}
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
                            style={{ background: copiedUpi ? '#34d399' : 'var(--ember)' }}>
                            {copiedUpi ? <Check size={16} style={{ color: 'white' }} /> : <Copy size={16} style={{ color: 'white' }} />}
                          </button>
                        </div>
                        <div className="rounded-xl p-3 mb-4 space-y-1.5"
                          style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                          {[
                            'Open any UPI app and send to the ID above',
                            `Send exactly ${formatCurrency(total)} as the payment`,
                            'Copy your transaction ID from the app receipt',
                            'Paste it in the field below to confirm booking',
                          ].map((s, i) => (
                            <p key={i} style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', color: 'var(--steel)', display: 'flex', gap: '8px' }}>
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
                          className="input font-mono"
                          style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.06em', fontSize: '14px' }}
                        />
                        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '11px', color: 'var(--faint)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={10} /> Found in your UPI app → Payment History
                        </p>
                        {isDemo && (
                          <div className="mt-3 text-center" style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: 'var(--ember)', letterSpacing: '0.08em' }}>
                            ✦ DEMO — ANY TEXT WORKS
                          </div>
                        )}
                      </motion.div>
                    )}
                    {data.paymentMethod === 'cash' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card rounded-2xl p-5 text-center">
                        <div className="text-4xl mb-3 animate-float">💵</div>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '16px', color: 'var(--chrome)', marginBottom: '4px' }}>
                          Pay {formatCurrency(total)} at Studio
                        </p>
                        <p style={grotesk12}>Cash on arrival. Exact change preferred.</p>
                        <p style={{ ...mono10, marginTop: '12px', color: 'var(--ember)' }}>
                          📍 BHAIRAVNATH RD, MANINAGAR
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}

          {/* ── Step 5: Confirmed ───────────────────────────────────────────── */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-ember-pulse"
                style={{ background: 'rgba(255,69,0,0.12)', border: '1px solid rgba(255,69,0,0.25)' }}>
                <Check size={44} style={{ color: 'var(--ember)' }} />
              </motion.div>

              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '28px', color: 'var(--chrome)', letterSpacing: '0.04em', marginBottom: '8px' }}>
                BOOKED ✦
              </h2>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--steel)', marginBottom: '4px' }}>
                {isDemo ? 'Demo booking — full flow tested' : 'WhatsApp confirmation sent to studio'}
              </p>
              {membershipCoversWash && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: membershipPlan?.color, marginBottom: '4px', letterSpacing: '0.08em' }}>
                  ✦ 1 {membership?.plan} WASH DEDUCTED
                </p>
              )}
              {data.paymentMethod === 'upi' && data.transactionId && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: 'var(--faint)', marginBottom: '20px' }}>
                  TXN: {data.transactionId}
                </p>
              )}

              <div className="card-ember rounded-2xl p-4 text-left mb-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Vehicle', data.vehicle?.name],
                    ['Service', data.service?.name],
                    ['Date', data.date && formatDate(data.date)],
                    ['Time', data.time && formatTime(data.time)],
                    ['Total', membershipCoversWash && total === 0 ? 'FREE' : formatCurrency(total)],
                    ['ID', confirmedId.slice(0, 8).toUpperCase()],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <p style={mono10}>{l}</p>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--fg-dim)', fontWeight: 500, marginTop: '2px' }}>{v}</p>
                    </div>
                  ))}
                </div>
                {data.pickupDrop && (
                  <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,69,0,0.15)' }}>
                    <Truck size={12} style={{ color: 'var(--ember)' }} />
                    <p style={{ ...mono10, color: 'var(--ember)' }}>
                      PICKUP &amp; DROP ARRANGED +{formatCurrency(pickupFee)}
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

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-4 glass-nav"
          style={{ borderTop: '1px solid var(--border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
