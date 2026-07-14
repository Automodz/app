'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Car, IndianRupee } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Job } from '@/lib/types';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  checked_in:    { label: 'Checked In',  color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 12%, transparent)' },
  in_progress:   { label: 'In Progress', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 12%, transparent)' },
  ready_for_delivery: { label: 'Ready', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  quality_check: { label: 'QC Check',    color: 'var(--info)', bg: 'color-mix(in srgb, var(--info) 12%, transparent)' },
  completed:     { label: 'Completed',   color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  cancelled:     { label: 'Cancelled',   color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)' },
};

export default function JobCard({ job }: { job: Job }) {
  const meta = STATUS_META[job.status] ?? STATUS_META.in_progress;
  return (
    <Link href={`/store/job/${job.id}`}>
      <motion.div layout initial={false} animate={{ opacity: 1, y: 0 }}
        className="card-dark active:scale-[0.98] transition-transform cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-body font-600 text-sm truncate" style={{ color: 'var(--chrome)' }}>
              {job.customerName}
            </p>
            <p className="flex items-center gap-1 text-xs font-body mt-0.5" style={{ color: 'var(--steel)' }}>
              <Car size={11} /> {job.vehicleName} · {job.vehicleRegNo}
            </p>
          </div>
          <span className="data-label px-2 py-1 rounded-lg shrink-0" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
          </span>
        </div>
        <div className="space-y-1 mb-2">
          {job.serviceItems.map((s, i) => (
            <p key={i} className="text-xs font-body truncate" style={{ color: 'var(--silver, var(--steel))' }}>
              • {s.serviceName}
            </p>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="flex items-center gap-1 font-mono text-sm font-700" style={{ color: 'var(--ember)' }}>
            <IndianRupee size={12} />{formatCurrency(job.totalAmount).replace('₹', '')}
          </span>
          <span className="data-label" style={{ color: job.paymentStatus === 'collected' ? 'var(--success)' : 'var(--steel)' }}>
            {job.paymentStatus === 'collected' ? `Paid · ${job.paymentMethod?.toUpperCase()}` : 'Payment due'}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
