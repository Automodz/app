'use client';
/**
 * THE DESK - find anything.
 *
 * Source: reference/customer-old/components/os/Desk.tsx
 *         docs/AUTOMODZ-OS-ARCHITECTURE.md §6
 *
 * The old Home carried a search layer over eight kinds of row. It is restored
 * here as a system primitive rather than a Home component, because the same
 * layer serves Garage, Vehicle and History without change - it takes items and
 * knows nothing about what they are.
 *
 * Radix supplies the focus trap, dismiss layer and scroll lock; the keyboard
 * model (↑/↓/Enter) is ours because Radix Dialog has no listbox opinion, and
 * §21.4 requires every control to be reachable by keyboard alone.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  color, space, INSET, radius, elevation, HAIRLINE, MEASURE,
  duration, curve, spring, type as typeScale, TARGET_MIN,
} from '@/design';
import { Text } from './Text';

export interface DeskItem {
  id: string;
  label: string;
  group: string;
  href: string;
  /**
   * Words a customer might arrive with that the label does not contain. The
   * rooms speak the product's vocabulary ("The Club", "Arrange a visit"); a
   * customer types the world's ("membership", "book"). Matching the label
   * alone answers neither. Never shown - only matched.
   */
  keywords?: string;
}

/** One line of the studio's record. */
export interface DeskLogEntry {
  id: string;
  line: string;
  when: string;
  href?: string;
}

export interface DeskProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DeskItem[];
  /**
   * The studio's record, shown beneath the search when nothing is typed. The
   * old Desk carried this and it is what makes the layer a place rather than a
   * search box.
   */
  log?: DeskLogEntry[];
  /**
   * The single sentence that is true right now, from `os/truth`. It sits above
   * the field because a place should say where you are before it asks what you
   * are looking for.
   */
  truth?: string;
}

export function Desk({ open, onOpenChange, items, log = [], truth }: DeskProps) {
  const still = useReducedMotion();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(i =>
      i.label.toLowerCase().includes(query) || i.keywords?.toLowerCase().includes(query));
  }, [q, items]);

  const groups = useMemo(() => [...new Set(results.map(r => r.group))], [results]);

  /* A new query invalidates the highlighted row - leaving it where it was would
     mean Enter opening something the customer can no longer see. */
  useEffect(() => { setActive(0); }, [q]);

  /* Reopening starts clean. A stale query is the layer remembering something
     the customer has already finished with. */
  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);

  const flat = results;
  const activeId = flat[active] ? `desk-${flat[active].id}` : undefined;

  /* The list is longer than the layer once a customer has several cars and a
     year of visits. An arrow key that highlights a row below the fold moves a
     selection nobody can see. */
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="am-scrim"
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={still ? undefined : { opacity: 0 }}
                transition={{ duration: still ? 0 : duration.move / 1000 }}
                style={{
                  position: 'fixed', inset: 0,
                  zIndex: elevation.sheet.z,
                  background: color.paper, opacity: 0.72,
                }}
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              aria-label="Find anything"
              onOpenAutoFocus={e => {
                /* Focus belongs in the field, not on the first result - the
                   customer opened this to type. */
                e.preventDefault();
                inputRef.current?.focus();
              }}
            >
              <motion.div
                initial={still ? { opacity: 0 } : { y: '4%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={still ? { opacity: 0 } : { y: '4%', opacity: 0 }}
                transition={still
                  ? { duration: duration.tick / 1000 }
                  : { type: 'spring', ...spring }}
                style={{
                  position: 'fixed',
                  insetInline: 0,
                  top: 0,
                  zIndex: elevation.sheet.z + 1,
                  maxHeight: '92svh',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  background: color.surface,
                  borderBottomLeftRadius: radius.sheet,
                  borderBottomRightRadius: radius.sheet,
                  boxShadow: elevation.sheet.shadow,
                  paddingTop: `calc(env(safe-area-inset-top, 0px) + ${space.gap}px)`,
                  paddingBottom: space.rest,
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive(a => Math.min(a + 1, flat.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive(a => Math.max(a - 1, 0));
                  }
                }}
              >
                <Dialog.Title style={{
                  position: 'absolute', width: 1, height: 1, overflow: 'hidden',
                  clipPath: 'inset(50%)', whiteSpace: 'nowrap',
                }}>Find anything</Dialog.Title>

                <div style={{
                  paddingInline: INSET,
                  maxWidth: MEASURE + INSET * 2,
                  marginInline: 'auto',
                  width: '100%',
                }}>
                  {truth ? (
                    <Text role="body" tone="ink" style={{ marginBottom: space.gap }}>
                      {truth}
                    </Text>
                  ) : null}

                  {/* §1.3 - the one hairline the Desk is allowed. */}
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Find anything"
                    aria-label="Search your car’s history"
                    role="combobox"
                    aria-expanded
                    aria-controls="desk-results"
                    aria-activedescendant={activeId}
                    style={{
                      width: '100%',
                      minHeight: TARGET_MIN,
                      padding: `${space.breath}px 0`,
                      border: 'none',
                      borderBottom: `${HAIRLINE}px solid ${color.edge}`,
                      background: 'transparent',
                      fontFamily: typeScale.body.family,
                      fontSize: typeScale.body.size,
                      color: color.ink,
                      outline: 'none',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && flat[active]) {
                        e.preventDefault();
                        (document.getElementById(`desk-${flat[active].id}`) as HTMLAnchorElement | null)?.click();
                      }
                    }}
                  />

                  <div id="desk-results" role="listbox" style={{ marginTop: space.gap }}>
                    {flat.length === 0 ? (
                      /* §18.1 - absence speaks plainly, and says what to do next. */
                      <Text role="body" tone="ink3" style={{ paddingBlock: space.gap }}>
                        Nothing by that name.
                      </Text>
                    ) : (
                      groups.map(g => (
                        <div key={g} role="group" aria-label={g}
                             style={{ marginBottom: space.gap }}>
                          <Text role="whisper" tone="ink3">{g}</Text>
                          {results.filter(r => r.group === g).map(r => {
                            const i = flat.indexOf(r);
                            const on = i === active;
                            return (
                              <Link
                                key={r.id}
                                id={`desk-${r.id}`}
                                href={r.href}
                                role="option"
                                aria-selected={on}
                                onClick={() => onOpenChange(false)}
                                onMouseEnter={() => setActive(i)}
                                style={{
                                  display: 'block',
                                  minHeight: TARGET_MIN,
                                  lineHeight: `${TARGET_MIN}px`,
                                  textDecoration: 'none',
                                  color: on ? color.ink : color.ink2,
                                  fontFamily: typeScale.body.family,
                                  fontSize: typeScale.body.size,
                                  transition: `color ${duration.tick}ms ${curve.ease.toString()}`,
                                }}
                              >
                                {r.label}
                              </Link>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  {/* THE RECORD. Only while nothing is typed - a search result
                      and a history beneath it would be two answers at once. */}
                  {!q.trim() && log.length > 0 ? (
                    <div style={{ marginTop: space.rest }}>
                      <Text role="whisper" tone="ink3">The record</Text>
                      <div style={{ marginTop: space.breath }}>
                        {log.slice(0, 8).map(e => {
                          const body = (
                            <>
                              <Text role="data" tone="ink3">{e.when}</Text>
                              <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
                                {e.line}
                              </Text>
                            </>
                          );
                          const rowStyle = {
                            display: 'block',
                            paddingBlock: space.line,
                            borderTop: `${HAIRLINE}px solid ${color.edge}`,
                            textDecoration: 'none',
                          } as const;
                          return e.href ? (
                            <Link
                              key={e.id}
                              href={e.href}
                              onClick={() => onOpenChange(false)}
                              style={rowStyle}
                            >
                              {body}
                            </Link>
                          ) : (
                            <div key={e.id} style={rowStyle}>{body}</div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
