'use client';
import { motion } from 'framer-motion';

interface PlasmaOrbProps {
  size?: number;
  opacity?: number;
  x?: string;
  y?: string;
  delay?: number;
}

export function PlasmaOrb({ size = 400, opacity = 0.15, x = '50%', y = '50%', delay = 0 }: PlasmaOrbProps) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        left: x, top: y,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, rgba(255,85,0,${opacity}) 0%, transparent 70%)`,
        filter: `blur(${size * 0.1}px)`,
        zIndex: 0,
      }}
      animate={{ scale: [1, 1.15, 1], opacity: [1, 1.3, 1] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}
