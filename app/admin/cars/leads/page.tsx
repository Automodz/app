'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Inbox, Phone, MessageCircle, Eye, Tag } from 'lucide-react';
import {
  getCarLeads, updateLeadStatus, getSellRequests, updateSellRequestStatus,
} from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import type { CarLead, SellRequest, LeadStatus } from '@/lib/types';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'closed'];
const STATUS_COLOR: Record<LeadStatus, string> = { new: 'var(--chrome)', contacted: 'var(--info)', closed: 'var(--success)' };

export default function AdminCarLeadsPage() {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [leads, setLeads] = useState<CarLead[]>([]);
  const [sellReqs, setSellReqs] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [l, s] = await Promise.all([getCarLeads(), getSellRequests()]);
    setLeads(l); setSellReqs(s); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const advanceLead = async (id: string, status: LeadStatus) => {
    await updateLeadStatus(id, status); toast.success(`Lead → ${status}`); await load();
  };
  const advanceSell = async (id: string, status: LeadStatus) => {
    await updateSellRequestStatus(id, status); toast.success(`Request → ${status}`); await load();
  };

  const statusButtons = (current: LeadStatus, onSet: (s: LeadStatus) => void) => (
    <div className="flex gap-1.5">
      {STATUSES.map(s => (
        <button key={s} onClick={() => onSet(s)}
          className="px-2.5 py-1.5 rounded-lg data-label"
          style={{
            background: current === s ? `${STATUS_COLOR[s]}22` : 'var(--dark)',
            color: current === s ? STATUS_COLOR[s] : 'var(--steel)',
            border: '1px solid var(--border)',
          }}>{s}</button>
      ))}
    </div>
  );

  const contactRow = (name: string, phone: string) => (
    <div className="flex items-center gap-2">
      <a href={`tel:+91${phone}`} className="w-8 h-8 flex items-center justify-center rounded-lg"
        style={{ background: 'var(--dark)', color: 'var(--steel)' }}><Phone size={13} /></a>
      <a href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${name}, this is AutoModz regarding your car enquiry.`)}`}
        target="_blank" rel="noreferrer" className="w-8 h-8 flex items-center justify-center rounded-lg"
        style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}><MessageCircle size={13} /></a>
    </div>
  );

  const newCount = leads.filter(l => l.status === 'new').length + sellReqs.filter(s => s.status === 'new').length;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <Link href="/admin/cars" className="flex items-center gap-2 data-label mb-4" style={{ color: 'var(--steel)' }}>
        <ArrowLeft size={13} /> Cars
      </Link>
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>CAR LEADS</h1>
        <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>{newCount} new leads to action</p>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('buy')} className="px-4 py-2.5 rounded-xl data-label"
          style={{
            background: tab === 'buy' ? 'var(--accent-mist)' : 'var(--dark)',
            border: tab === 'buy' ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
            color: tab === 'buy' ? 'var(--ember)' : 'var(--steel)',
          }}>Buy enquiries ({leads.length})</button>
        <button onClick={() => setTab('sell')} className="px-4 py-2.5 rounded-xl data-label"
          style={{
            background: tab === 'sell' ? 'var(--accent-mist)' : 'var(--dark)',
            border: tab === 'sell' ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
            color: tab === 'sell' ? 'var(--ember)' : 'var(--steel)',
          }}>Sell requests ({sellReqs.length})</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : tab === 'buy' ? (
        leads.length === 0 ? (
          <div className="card text-center py-14">
            <Inbox size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
            <p className="font-body" style={{ color: 'var(--steel)' }}>No enquiries yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((l, i) => (
              <motion.div key={l.id} initial={false} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="card-dark">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{l.name}</span>
                      <span className="data-label flex items-center gap-1" style={{ color: l.type === 'viewing' ? 'var(--ember)' : 'var(--steel)' }}>
                        {l.type === 'viewing' ? <Eye size={10} /> : <Tag size={10} />} {l.type}
                      </span>
                    </div>
                    <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                      {l.listingTitle} · {l.phone}
                      {l.preferredDate ? ` · wants to visit ${l.preferredDate}${l.preferredTime ? ` ${l.preferredTime}` : ''}` : ''}
                    </p>
                    {l.message && <p className="text-xs font-body mt-1 italic" style={{ color: 'var(--steel)' }}>“{l.message}”</p>}
                  </div>
                  {contactRow(l.name, l.phone)}
                  {statusButtons(l.status, s => advanceLead(l.id, s))}
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : sellReqs.length === 0 ? (
        <div className="card text-center py-14">
          <Inbox size={26} className="mx-auto mb-3" style={{ color: 'var(--steel)' }} />
          <p className="font-body" style={{ color: 'var(--steel)' }}>No sell requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sellReqs.map((r, i) => (
            <motion.div key={r.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }} className="card-dark">
              <div className="flex items-center gap-4 flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.photos[0] && <img src={r.photos[0].url} alt="" className="w-20 h-14 rounded-xl object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>
                    {r.year} {r.make} {r.model}
                  </p>
                  <p className="text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
                    {r.name} · {r.phone} · {(r.kmDriven / 1000).toFixed(0)}k km
                    {r.expectedPrice ? ` · asking ${formatCurrency(r.expectedPrice)}` : ''}
                    {` · ${r.photos.length} photos`}
                  </p>
                  {r.description && <p className="text-xs font-body mt-1 italic" style={{ color: 'var(--steel)' }}>“{r.description}”</p>}
                </div>
                {contactRow(r.name, r.phone)}
                {statusButtons(r.status, s => advanceSell(r.id, s))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
