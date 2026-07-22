'use client';
/**
 * The owner's Chapter - `/app/chapter/[id]` (P2D1 §C5).
 *
 * The permanent record of one completed visit, read by the person whose car
 * it is: the work, the evidence, the people, the promise, the amount and the
 * papers. It replaces the legacy invoice page as the customer's destination;
 * the invoice itself survives as a document *inside* this record.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Invoice, Job, Service } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { getServices, STATIC_SERVICES, getJobsForCustomer } from '@/lib/firebaseService';
import { getInvoice } from '@/lib/services/invoices';
import { isDevUser, DEV_JOBS } from '@/lib/cx/devseed';
import { deriveChapter } from '@/lib/os/chapter';
import { visitPhase } from '@/lib/os/visit';
import { deriveProtection } from '@/lib/cx/protection';
import Chapter from '@/components/os/Chapter';
import Action from '@/components/os/Action';
import { Body } from '@/components/os/text';

export default function OwnerChapterPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, bookings } = useAppStore();

  const [services, setServices] = useState<Service[]>(STATIC_SERVICES);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const booking = useMemo(() => bookings.find(b => b.id === id) ?? null, [bookings, id]);

  useEffect(() => { getServices().then(setServices).catch(() => {}); }, []);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    if (isDevUser(uid)) { setJobs(Object.values(DEV_JOBS)); return; }
    getJobsForCustomer(uid).then(setJobs).catch(() => setJobs([]));
  }, [uid]);

  // the owner may read their own invoice (rules), so the papers are real
  useEffect(() => {
    if (!booking?.invoiceId) { setInvoice(null); return; }
    getInvoice(booking.invoiceId).then(setInvoice).catch(() => setInvoice(null));
  }, [booking?.invoiceId]);

  // a visit still in flight belongs to the Stay
  const live = booking ? visitPhase(booking.status) === 'live' : false;
  useEffect(() => { if (live) router.replace(`/app/visit/${id}`); }, [live, id, router]);

  const job = useMemo(
    () => jobs.find(j => j.bookingId === booking?.id) ?? null,
    [jobs, booking?.id],
  );

  const chapter = useMemo(
    () => (booking ? deriveChapter({ booking, job, invoice, invoiceToken: invoice?.publicToken }) : null),
    [booking, job, invoice],
  );

  /* what this car's completed work protects it with - the one protection
     engine, not a second derivation */
  const protections = useMemo(() => {
    if (!booking) return [];
    const history = bookings
      .filter(b => b.vehicleId === booking.vehicleId)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
    return deriveProtection(history, services)
      .filter(p => p.kind === booking.serviceCategory);
  }, [bookings, booking, services]);

  const shareUrl = useMemo(() => {
    if (!invoice || typeof window === 'undefined') return undefined;
    return `${window.location.origin}/chapter/${invoice.id}?t=${invoice.publicToken}`;
  }, [invoice]);

  if (!user) return null;

  if (!booking || !chapter) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--st-inset)' }}>
        <div style={{ textAlign: 'center' }}>
          <Body tone="ink-2">That chapter isn’t in this garage.</Body>
          <div style={{ marginTop: 'var(--st-gap)' }}>
            <Action onClick={() => router.replace('/app')}>Back to the car</Action>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <Chapter
        chapter={chapter}
        protections={protections}
        owner
        shareUrl={shareUrl}
        onBack={() => router.replace('/app')}
      />
    </main>
  );
}
