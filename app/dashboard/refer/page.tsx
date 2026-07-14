'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Gift, Copy, MessageCircle, Users, CheckCircle2 } from 'lucide-react';
import {
  getMyReferralCode, getMyReferrals, referralShareLink, referralWhatsAppLink,
  type ReferralRecord,
} from '@/lib/firebaseService';
import { REFERRAL } from '@/lib/config/storeConfig';
import { useAppStore } from '@/lib/store';

export default function ReferPage() {
  const { user } = useAppStore();
  const [code, setCode] = useState('');
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getMyReferralCode(user), getMyReferrals(user.uid)])
      .then(([c, r]) => { setCode(c); setReferrals(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralShareLink(code));
    toast.success('Link copied!');
  };

  return (
    <div className="px-5 pt-6 max-w-lg mx-auto">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
        className="card-ember rounded-3xl p-6 text-center mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--accent-grad)', boxShadow: '0 8px 24px var(--accent-glow)' }}>
          <Gift size={24} style={{ color: 'var(--on-accent)' }} />
        </div>
        <h1 className="font-display font-800 text-xl mb-1" style={{ color: 'var(--chrome)' }}>
          GIVE {REFERRAL.label.toUpperCase()}, GET {REFERRAL.label.toUpperCase()}
        </h1>
        <p className="text-sm font-body mb-5" style={{ color: 'var(--steel)' }}>
          Your friend gets {REFERRAL.label} on their first service.
          You get {REFERRAL.label} when they sign up. Everyone wins.
        </p>

        {loading ? (
          <div className="h-12 shimmer rounded-xl" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 py-3 rounded-xl font-mono font-700 text-lg tracking-widest"
                style={{ background: 'var(--dark)', border: '1px dashed var(--accent-glow)', color: 'var(--ember)' }}>
                {code}
              </div>
              <button onClick={copyLink} className="w-12 h-12 flex items-center justify-center rounded-xl"
                style={{ background: 'var(--dark)', border: '1px solid var(--border)', color: 'var(--steel)' }}>
                <Copy size={16} />
              </button>
            </div>
            <a href={referralWhatsAppLink(code, user?.name ?? '')} target="_blank" rel="noreferrer"
              className="btn-ember w-full flex items-center justify-center gap-2 py-3.5">
              <MessageCircle size={16} /> Share on WhatsApp
            </a>
          </>
        )}
      </motion.div>

      <div className="card-dark">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} style={{ color: 'var(--ember)' }} />
          <p className="data-label" style={{ color: 'var(--steel)' }}>
            Your referrals ({referrals.length})
          </p>
        </div>
        {referrals.length === 0 ? (
          <p className="text-sm font-body py-4 text-center" style={{ color: 'var(--steel)' }}>
            No referrals yet - share your link and watch the rewards roll in.
          </p>
        ) : (
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm font-body py-1.5">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--chrome)' }}>{r.referredName}</span>
                <span className="ml-auto data-label" style={{ color: 'var(--success)' }}>
                  {REFERRAL.label} earned
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
