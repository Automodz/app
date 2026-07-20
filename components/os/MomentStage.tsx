'use client';
/**
 * The Stay's act renderer (design system §7.8): stage ground, act title,
 * narration, evidence photo, act row as words.
 */
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { crossfade } from '@/lib/os/motion';
import { ACT_ORDER, ACT_TITLE, actIndex, type CareAct } from '@/lib/os/visit';
import { Display, Body, Whisper } from './text';

interface MomentStageProps {
  act: CareAct;
  narration: string;
  photo?: string;        // latest evidence; fallback handled by caller (dimmed portrait)
  photoDimmed?: boolean;
  timing?: string;       // "Ready around 4:30" / delay wording
}

export default function MomentStage({ act, narration, photo, photoDimmed, timing }: MomentStageProps) {
  const current = actIndex(act);
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--st-stage)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative', flex: '0 0 60%', minHeight: '55vh' }}>
        {photo && (
          <Image src={photo} alt={`${ACT_TITLE[act]} — evidence photo`} fill
            style={{ objectFit: 'cover', opacity: photoDimmed ? 0.6 : 1 }} sizes="100vw" priority />
        )}
        <div aria-hidden style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
          background: 'linear-gradient(transparent, var(--st-stage))',
        }} />
      </div>

      <div style={{ padding: '0 24px calc(env(safe-area-inset-bottom) + 96px)', marginTop: -24, position: 'relative' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={act} {...crossfade}>
            <Display tone="over">{ACT_TITLE[act]}</Display>
            <Body tone="over-2" style={{ fontSize: 19, marginTop: 12 }}>{narration}</Body>
          </motion.div>
        </AnimatePresence>

        <div aria-label="Care progress" style={{ display: 'flex', gap: 16, marginTop: 48, flexWrap: 'wrap' }}>
          {ACT_ORDER.map((a, i) => {
            const done = i < current;
            const cur = i === current;
            return (
              <span key={a} style={{
                fontFamily: 'var(--st-text)', fontSize: 14,
                color: done || cur ? 'var(--st-over)' : 'var(--st-over-2)',
                fontWeight: cur ? 520 : 400,
              }}>
                {done ? '✓ ' : ''}{ACT_TITLE[a]}
              </span>
            );
          })}
        </div>

        {timing && <Whisper tone="over-2" style={{ marginTop: 16 }}>{timing}</Whisper>}
      </div>
    </div>
  );
}
