'use client';
import { useEffect, useState } from 'react';
/* eslint-disable @next/next/no-img-element */
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Fuel, Gauge, Settings2, Users, Palette, Calendar,
  MessageCircle, Eye, X, Phone,
} from 'lucide-react';
import { getCarListing, createCarLead } from '@/lib/firebaseService';
import { formatCurrency, getAvailableDates, formatDate } from '@/lib/utils';
import { COMPANY as BUSINESS } from '@/lib/company';
import { useAppStore } from '@/lib/store';
import type { CarListing } from '@/lib/types';

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAppStore();
  const [car, setCar] = useState<CarListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [modal, setModal] = useState<'inquiry' | 'viewing' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [sending, setSending] = useState(false);

  // Parallax hero - image drifts slower than the page scroll
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 420], [0, 110]);
  const heroScale = useTransform(scrollY, [0, 420], [1, 1.08]);

  useEffect(() => {
    getCarListing(id).then(c => { setCar(c); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user) { setName(user.name ?? ''); setPhone(user.phone ?? ''); }
  }, [user]);

  const submit = async () => {
    if (!car || !modal) return;
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 10) {
      toast.error('Name and 10-digit phone required'); return;
    }
    if (modal === 'viewing' && !visitDate) { toast.error('Pick a date for your visit'); return; }
    setSending(true);
    try {
      await createCarLead({
        listingId: car.id, listingTitle: car.title, type: modal,
        userId: user ? user.uid : undefined,
        name, phone, message: message || undefined,
        preferredDate: modal === 'viewing' ? visitDate : undefined,
      });
      toast.success(modal === 'viewing' ? 'Visit requested - we\'ll confirm on WhatsApp!' : 'Enquiry sent - we\'ll call you soon!');
      setModal(null); setMessage(''); setVisitDate('');
    } catch (e) { console.error(e); toast.error('Could not send - try calling us instead'); }
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
      <div className="w-10 h-10 loader-ring" />
    </div>
  );
  if (!car || !car.active) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--void)' }}>
      <p className="font-body" style={{ color: 'var(--steel)' }}>This listing is no longer available.</p>
      <button onClick={() => router.push('/cars')} className="btn-ember px-6 py-3 text-sm">Browse Cars</button>
    </div>
  );

  const specs = [
    { icon: Calendar, label: 'Year', value: String(car.year) },
    { icon: Gauge, label: 'Driven', value: `${(car.kmDriven / 1000).toFixed(0)}k km` },
    { icon: Fuel, label: 'Fuel', value: car.fuel },
    { icon: Settings2, label: 'Gearbox', value: car.transmission },
    { icon: Users, label: 'Owner', value: `${car.ownership}${car.ownership === 1 ? 'st' : car.ownership === 2 ? 'nd' : 'rd'}` },
    { icon: Palette, label: 'Colour', value: car.color || '-' },
  ];

  return (
    <div className="min-h-screen pb-28 bg-mesh" style={{ overflowX: 'clip' }}>
      <div className="relative">
        <div className="aspect-[4/3] max-h-[420px] w-full overflow-hidden" style={{ background: 'var(--dark)' }}>
          {car.photos[photoIdx] ? (
            <motion.img src={car.photos[photoIdx].url} alt={car.title}
              className="w-full h-full object-cover" style={{ y: heroY, scale: heroScale }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gauge size={36} style={{ color: 'var(--steel)' }} />
            </div>
          )}
        </div>
        <button onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(5,5,7,0.7)', backdropFilter: 'blur(8px)', color: 'white' }}>
          <ArrowLeft size={16} />
        </button>
        {car.status !== 'available' && (
          <span className="absolute top-4 right-4 status-badge font-display font-800 tracking-widest px-4 py-1.5 rounded-xl"
            style={{ color: car.status === 'sold' ? 'var(--danger)' : 'var(--warning)', background: 'rgba(5,5,7,0.85)' }}>
            {car.status.toUpperCase()}
          </span>
        )}
      </div>
      {car.photos.length > 1 && (
        <div className="flex gap-2 px-5 mt-3 overflow-x-auto pb-1">
          {car.photos.map((p, i) => (
            <button key={p.path} onClick={() => setPhotoIdx(i)}
              className="w-16 h-12 rounded-lg overflow-hidden shrink-0"
              style={{ border: i === photoIdx ? '2px solid var(--ember)' : '2px solid transparent' }}>
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pt-5 max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h1 className="font-display font-800 text-xl" style={{ color: 'var(--chrome)' }}>{car.title}</h1>
          <p className="font-display font-800 text-xl shrink-0" style={{ color: 'var(--ember)' }}>
            {formatCurrency(car.price)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {specs.map(({ icon: Icon, label, value }) => (
            <div key={label} className="card-dark py-3 text-center">
              <Icon size={14} className="mx-auto mb-1" style={{ color: 'var(--ember)' }} />
              <p className="data-label" style={{ color: 'var(--steel)' }}>{label}</p>
              <p className="font-body font-600 text-xs mt-0.5 capitalize" style={{ color: 'var(--chrome)' }}>{value}</p>
            </div>
          ))}
        </div>

        {car.description && (
          <div className="card mb-5">
            <p className="data-label mb-2" style={{ color: 'var(--steel)' }}>About this car</p>
            <p className="text-sm font-body leading-relaxed whitespace-pre-line" style={{ color: 'var(--chrome)' }}>
              {car.description}
            </p>
          </div>
        )}

        <div className="card-dark flex items-center gap-3">
          <Phone size={15} style={{ color: 'var(--ember)' }} />
          <p className="text-xs font-body" style={{ color: 'var(--steel)' }}>
            Inspect it at our Maninagar studio · <a href={`tel:+91${BUSINESS.phone}`} style={{ color: 'var(--ember)' }}>+91 {BUSINESS.phone}</a>
          </p>
        </div>
      </div>

      {car.status === 'available' && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 glass-nav" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap-3 max-w-2xl mx-auto">
            <button onClick={() => setModal('viewing')} className="btn-ghost flex-1 flex items-center justify-center gap-2 py-3.5">
              <Eye size={15} /> Book Viewing
            </button>
            <button onClick={() => setModal('inquiry')} className="btn-ember flex-1 flex items-center justify-center gap-2 py-3.5">
              <MessageCircle size={15} /> I&apos;m Interested
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setModal(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                  {modal === 'viewing' ? 'BOOK A VIEWING' : 'SEND ENQUIRY'}
                </h2>
                <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <p className="text-sm font-body mb-4" style={{ color: 'var(--steel)' }}>{car.title} · {formatCurrency(car.price)}</p>
              <div className="space-y-3">
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                <input className="input" inputMode="numeric" maxLength={10} value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Mobile number" />
                {modal === 'viewing' && (
                  <div>
                    <label className="data-label block mb-2">When would you like to visit?</label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {getAvailableDates(7).map(d => (
                        <button key={d} onClick={() => setVisitDate(d)}
                          className="px-3 py-2.5 rounded-xl data-label whitespace-nowrap"
                          style={{
                            background: visitDate === d ? 'var(--accent-mist)' : 'var(--dark)',
                            border: visitDate === d ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                            color: visitDate === d ? 'var(--ember)' : 'var(--steel)',
                          }}>{formatDate(d)}</button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea className="input" rows={2} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder={modal === 'viewing' ? 'Anything we should know? (optional)' : 'Your message (optional)'} />
                <button onClick={submit} disabled={sending} className="btn-ember w-full py-3.5">
                  {sending ? 'Sending…' : modal === 'viewing' ? 'Request Visit' : 'Send Enquiry'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
