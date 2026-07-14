'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GOOGLE_REVIEW_URL } from '@/lib/config/storeConfig';

/**
 * Post-service review capture on the PUBLIC invoice (reaches walk-ins too).
 * 4–5 stars → straight to the Google review page (where it earns new business);
 * 1–3 stars → private feedback to the owner, never public.
 */
export default function RatingCard({ invoiceId, customerName, customerPhone }: {
  invoiceId: string; customerName?: string; customerPhone?: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'low' | 'done'>('idle');

  const submitFeedback = async (r: number, text?: string) => {
    try {
      await addDoc(collection(db, 'feedback'), {
        rating: r,
        ...(text?.trim() ? { comment: text.trim().slice(0, 1000) } : {}),
        invoiceId,
        ...(customerName ? { customerName } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        createdAt: serverTimestamp(),
      });
    } catch { /* rating UX never errors at the customer */ }
  };

  const pick = async (r: number) => {
    setRating(r);
    if (r >= 4) {
      submitFeedback(r);
      setState('done');
      window.open(GOOGLE_REVIEW_URL, '_blank');
    } else {
      setState('low');
    }
  };

  if (state === 'done') {
    return (
      <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--chrome)' }}>
          Thank you! ✦ Your feedback keeps us sharp.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
      <p className="text-center mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--chrome)' }}>
        How did we do?
      </p>
      <div className="flex justify-center gap-2 mb-2">
        {[1, 2, 3, 4, 5].map(r => (
          <button key={r} onClick={() => pick(r)} aria-label={`${r} stars`}
            className="p-1.5 transition-transform active:scale-90">
            <Star size={30}
              fill={r <= rating ? 'var(--warning)' : 'transparent'}
              style={{ color: r <= rating ? 'var(--warning)' : 'var(--steel)' }} />
          </button>
        ))}
      </div>
      {state === 'low' && (
        <div className="mt-3">
          <textarea className="input text-sm w-full" rows={3} value={comment} maxLength={1000}
            onChange={e => setComment(e.target.value)}
            placeholder="Sorry we missed the mark - tell us what went wrong and the owner will personally follow up." />
          <button
            onClick={async () => { await submitFeedback(rating, comment); setState('done'); }}
            className="btn-ember w-full py-3 mt-2">
            Send to the owner
          </button>
        </div>
      )}
    </div>
  );
}
