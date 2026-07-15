'use client';
/**
 * Client-only wrapper that mounts the vanilla three.js car stage into a canvas
 * and feeds it the shared scroll progress. Loaded via next/dynamic({ssr:false})
 * so three.js never runs on the server. Pauses its render loop when scrolled out
 * of view, and skips WebGL entirely when unsupported (page shows the fallback).
 */
import { useEffect, useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import { createCarScene, type CarStageHandle } from './carScene';

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export default function CarStage({ progress }: { progress: MotionValue<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !webglOK()) return;

    let handle: CarStageHandle | null = null;
    try {
      handle = createCarScene(canvas);
    } catch {
      return; // fallback stays visible
    }
    handle.setProgress(progress.get());
    handle.start();

    const unsub = progress.on('change', (v) => handle?.setProgress(v));
    const onResize = () => handle?.resize();
    window.addEventListener('resize', onResize);

    // pause the loop when the stage is off-screen
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? handle?.start() : handle?.stop()),
      { threshold: 0.01 },
    );
    io.observe(wrap);

    // second resize after layout settles
    const t = setTimeout(() => handle?.resize(), 60);

    return () => {
      unsub();
      window.removeEventListener('resize', onResize);
      io.disconnect();
      clearTimeout(t);
      handle?.dispose();
    };
  }, [progress]);

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
