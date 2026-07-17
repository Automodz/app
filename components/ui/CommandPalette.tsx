'use client';
/**
 * Command palette (⌘K / Ctrl-K) - the hallmark of an operating-system feel.
 * Fuzzy-filter across every destination and quick action, full keyboard control
 * (↑ ↓ to move, ↵ to run, esc to close). Opens from anywhere via the global
 * shortcut or the top-bar trigger. Design-system native: glass panel, spring in,
 * token-driven, works in light + dark, respects reduced motion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  hint?: string;
  run: () => void;
  keywords?: string;
}

export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // reset + focus on open
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      // focus after the panel paints
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(c =>
      (c.label + ' ' + c.group + ' ' + (c.keywords ?? '')).toLowerCase().includes(term),
    );
  }, [q, commands]);

  // keep active index in range
  useEffect(() => { setActive(a => Math.min(a, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  // scroll active row into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[active]; if (c) { onClose(); c.run(); } }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // group the filtered results, preserving group order of first appearance
  const groups = useMemo(() => {
    const map = new Map<string, { cmd: Command; idx: number }[]>();
    filtered.forEach((cmd, idx) => {
      const arr = map.get(cmd.group) ?? [];
      arr.push({ cmd, idx });
      map.set(cmd.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-[100] flex items-start justify-center px-4"
          style={{ paddingTop: 'max(14vh, calc(var(--sat) + 16px))', background: 'rgba(6,7,9,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.985 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="w-full max-w-xl rounded-2xl overflow-hidden"
            style={{
              background: 'var(--glass)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-lg, 0 24px 64px rgba(0,0,0,0.4))',
            }}
            role="dialog" aria-modal="true" aria-label="Command palette"
          >
            {/* search field */}
            <div className="flex items-center gap-3 px-4" style={{ height: 54, borderBottom: '1px solid var(--border)' }}>
              <Search size={17} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search actions, pages, customers…"
                className="flex-1 bg-transparent outline-none"
                style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--fg)' }}
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md font-mono"
                style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--fog)', border: '1px solid var(--border-2)' }}>ESC</kbd>
            </div>

            {/* results */}
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>
                  No results for “{q}”
                </div>
              ) : (
                groups.map(([group, rows]) => (
                  <div key={group} className="px-2 pb-1">
                    <p className="px-3 pt-2 pb-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--faint)' }}>{group}</p>
                    {rows.map(({ cmd, idx }) => {
                      const on = idx === active;
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          data-idx={idx}
                          onMouseMove={() => setActive(idx)}
                          onClick={() => { onClose(); cmd.run(); }}
                          className="w-full flex items-center gap-3 px-3 rounded-xl text-left transition-colors"
                          style={{ height: 42, background: on ? 'var(--accent-mist)' : 'transparent', color: on ? 'var(--fg)' : 'var(--fg-dim)' }}
                        >
                          <span className="grid place-items-center rounded-lg shrink-0"
                            style={{ width: 28, height: 28, background: on ? 'var(--accent-haze)' : 'var(--fog)', color: on ? 'var(--fg)' : 'var(--muted)' }}>
                            <Icon size={15} />
                          </span>
                          <span className="flex-1 min-w-0 truncate" style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: on ? 600 : 500 }}>{cmd.label}</span>
                          {cmd.hint && <span className="font-mono shrink-0" style={{ fontSize: 10, color: 'var(--faint)' }}>{cmd.hint}</span>}
                          {on && <CornerDownLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* footer hints */}
            <div className="flex items-center gap-4 px-4" style={{ height: 38, borderTop: '1px solid var(--border)' }}>
              <Hint icon={ArrowUp} icon2={ArrowDown} label="Navigate" />
              <Hint icon={CornerDownLeft} label="Open" />
              <span className="ml-auto font-mono" style={{ fontSize: 10, color: 'var(--faint)' }}>AutoModz OS</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Hint({ icon: Icon, icon2: Icon2, label }: { icon: LucideIcon; icon2?: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)' }}>
      <span className="inline-flex items-center gap-0.5">
        <kbd className="grid place-items-center rounded" style={{ width: 18, height: 18, background: 'var(--fog)', border: '1px solid var(--border-2)' }}><Icon size={10} /></kbd>
        {Icon2 && <kbd className="grid place-items-center rounded" style={{ width: 18, height: 18, background: 'var(--fog)', border: '1px solid var(--border-2)' }}><Icon2 size={10} /></kbd>}
      </span>
      {label}
    </span>
  );
}
