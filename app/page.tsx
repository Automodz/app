'use client';
import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { getServices } from '@/lib/firebaseService';
import type { Service } from '@/lib/types';

import SmoothScroll from '@/components/home/SmoothScroll';
import HomeNav from '@/components/home/HomeNav';
import Hero from '@/components/home/Hero';
import Manifesto from '@/components/home/Manifesto';
import CraftGallery from '@/components/home/CraftGallery';
import Process from '@/components/home/Process';
import Proof from '@/components/home/Proof';
import Showcase from '@/components/home/Showcase';
import BookCTA from '@/components/home/BookCTA';
import SiteFooter from '@/components/home/SiteFooter';

/**
 * AutoModz landing — "The surface is everything."
 * A single scroll narrative: hook → standard → craft → process → measure →
 * proof → book. Composition only; each beat owns its own motion. Live pricing
 * is fetched once and threaded into the craft gallery, with static fallbacks
 * so the page is never in an empty/loading state.
 */
export default function HomePage() {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    getServices()
      .then((list) => {
        const min: Record<string, number> = {};
        list.filter((s) => s.active !== false).forEach((s: Service) => {
          if (!min[s.category] || s.price < min[s.category]) min[s.category] = s.price;
        });
        setPrices(min);
      })
      .catch(() => {/* fallbacks in CraftGallery keep the section whole */});
  }, []);

  return (
    // reducedMotion="never" forces Framer to always APPLY animation targets
    // (this version otherwise strands elements at `initial` under
    // prefers-reduced-motion). We honour the user's preference ourselves: the
    // Kinetic/Hero reveals collapse to zero duration via useRM, and all
    // scroll-parallax + looping motion is disabled for reduced-motion users —
    // so they get an instant, motionless page that is always fully visible.
    <MotionConfig reducedMotion="never">
      <div className="relative" style={{ background: 'var(--bg)', overflowX: 'clip' }}>
        <SmoothScroll />
        <HomeNav />
        <main>
          <Hero />
          <Manifesto />
          <CraftGallery prices={prices} />
          <Process />
          <Proof />
          <Showcase />
          <BookCTA />
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
