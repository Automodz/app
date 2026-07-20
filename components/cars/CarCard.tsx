'use client';
import Link from 'next/link';
/* eslint-disable @next/next/no-img-element */
import { motion } from 'framer-motion';
import { Heart, Fuel, Gauge, Settings2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CarListing } from '@/lib/types';

interface CarCardProps {
  car: CarListing;
  saved?: boolean;
  onToggleSave?: (car: CarListing) => void;
  hrefBase?: string; // '/cars'
}

export default function CarCard({ car, saved, onToggleSave, hrefBase = '/cars' }: CarCardProps) {
  const cover = car.photos[0]?.url;
  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden relative"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Link href={`${hrefBase}/${car.id}`}>
        <div className="relative aspect-[4/3]" style={{ background: 'var(--dark)' }}>
          {cover ? (
            <img src={cover} alt={car.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gauge size={28} style={{ color: 'var(--steel)' }} />
            </div>
          )}
          {car.status !== 'available' && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(5,5,7,0.6)' }}>
              <span className="status-badge font-display font-800 tracking-widest text-sm px-4 py-1.5 rounded-xl"
                style={{
                  color: car.status === 'sold' ? 'var(--danger)' : 'var(--warning)',
                  background: 'rgba(5,5,7,0.85)', border: '1px solid var(--border)',
                }}>
                {car.status.toUpperCase()}
              </span>
            </div>
          )}
          {car.featured && car.status === 'available' && (
            <span className="absolute top-2 left-2 data-label px-2 py-1 rounded-lg"
              style={{ background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>FEATURED</span>
          )}
        </div>
      </Link>
      {onToggleSave && (
        <button onClick={() => onToggleSave(car)}
          className="absolute top-2 right-2 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(5,5,7,0.7)', backdropFilter: 'blur(8px)' }}>
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} style={{ color: 'white' }} />
        </button>
      )}
      <Link href={`${hrefBase}/${car.id}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{car.title}</p>
            <p className="font-display font-800 text-base shrink-0" style={{ color: 'var(--ember)' }}>
              {formatCurrency(car.price)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs font-body" style={{ color: 'var(--steel)' }}>
            <span className="flex items-center gap-1"><Gauge size={11} />{(car.kmDriven / 1000).toFixed(0)}k km</span>
            <span className="flex items-center gap-1"><Fuel size={11} />{car.fuel}</span>
            <span className="flex items-center gap-1"><Settings2 size={11} />{car.transmission}</span>
            <span>{car.year}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
