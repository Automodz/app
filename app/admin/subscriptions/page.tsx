'use client';
import { useEffect, useState } from 'react';
import { getAllSubscriptions, updateSubscriptionStatus } from '@/lib/firebaseService';
import type { Subscription } from '@/lib/types';

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllSubscriptions().then(s => setSubs(s)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id: string, status: Subscription['status']) => {
    try {
      await updateSubscriptionStatus(id, status);
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch {}
  };

  return (
    <div className="p-6">
      <h1 className="font-display font-900 text-2xl text-foreground tracking-wide mb-4">MEMBERSHIPS</h1>
      {loading ? (
        <p>Loading...</p>
      ) : subs.length === 0 ? (
        <p className="text-muted">No subscriptions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">Washes</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.userName}</td>
                  <td className="px-4 py-2">{s.plan}</td>
                  <td className="px-4 py-2">{s.status}</td>
                  <td className="px-4 py-2">{s.startDate} → {s.endDate}</td>
                  <td className="px-4 py-2">{s.washesUsed}/{s.washesTotal}</td>
                  <td className="px-4 py-2 space-x-2">
                    {s.status !== 'active' && (
                      <button onClick={() => changeStatus(s.id, 'active')} className="text-green-600 underline">Activate</button>
                    )}
                    {s.status === 'active' && (
                      <button onClick={() => changeStatus(s.id, 'expired')} className="text-red-600 underline">Expire</button>
                    )}
                    {(s.status === 'active' || s.status === 'expired') && (
                      <button onClick={() => changeStatus(s.id, 'cancelled')} className="text-gray-600 underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
