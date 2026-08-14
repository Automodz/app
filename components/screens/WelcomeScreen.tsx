'use client';
/**
 * THE FIRST ARRIVAL.
 *
 * Source: docs/AUTOMODZ-OS.md §19, §21.4, §21.6, §21.7 · ARCHITECTURE §1
 *
 * Not onboarding. One arrival, five short moments, each of which may be passed
 * over except the first - and the last one never forces a car.
 *
 * EVERY STEP IS AN ADDRESS. The forward and pass controls are LINKS to
 * `?step=`, not state changes, which is what makes the flow deep-linkable,
 * makes Back walk backwards through it, and makes a reload land where the
 * customer was rather than at the beginning. That was the defect: the step was
 * `useState`, so Back left the welcome altogether.
 *
 * The renderer holds no wording and no addresses - both arrive in the model.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MotionConfig, motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { color, space, INSET, MEASURE, duration, curve, HAIRLINE, stack } from '@/design';
import { Heading, Text, Button } from '@/components/system';
import type { WelcomeModel } from '@/lib/customer/welcome';
import { authedFetch } from '@/lib/clientSession';

/** Said the same way whichever path declined - one sentence, one place. */
const NOT_NOW = 'Not this time. You can turn it on later in You.';

export function WelcomeScreen({ model }: { model: WelcomeModel }) {
  const { panel, position, homeHref, addCarHref, hasCar, greeting } = model;
  const router = useRouter();
  const still = useReducedMotion();
  /**
   * THE ENTRANCE IS A CLIENT-ONLY ENHANCEMENT.
   *
   * Two faults, one cause. `initial={{ opacity: 0 }}` is rendered BY THE
   * SERVER, so the first screen a new customer ever sees was shipped
   * invisible and depended on JavaScript arriving to reveal it - §7.1 says
   * motion never gates content, and this gated all of it. On a slow phone
   * that is a blank screen; with JS blocked it is a permanently blank one.
   *
   * And it did not survive hydration either: the server wrote
   * `opacity: "0"` while the client computed `opacity: 0`, plus a transform
   * that existed on only one side, so React reported a mismatch it explicitly
   * would not patch. `useReducedMotion()` compounded it by answering
   * differently on the two sides.
   *
   * `initial={false}` tells the library to start AT the animate values, so
   * the server emits the visible state and the first client render agrees.
   * Once mounted, every later panel animates exactly as before - which is
   * where the motion was actually wanted, since arriving at step two is a
   * transition and arriving at step one is just the page.
   */
  const [entered, setEntered] = useState(false);
  useEffect(() => { setEntered(true); }, []);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Record the arrival, then go.
   *
   * THE WRITE MUST SUCCEED BEFORE LEAVING, and that is not pedantry: Home
   * decides whether to send someone here by reading the same flag, so leaving
   * without having written it walks straight back into the welcome. A
   * best-effort mark would have made a failed write into an inescapable loop.
   *
   * So a failure says so and offers to try again - and `router.refresh()`
   * discards the server render Home cached, or it would answer from the
   * picture it read before the flag was set.
   */
  const finish = async (href: string) => {
    setBusy(true);
    setNote(null);
    try {
      /* WAITED FOR, NOT GUESSED AT - and no longer refused when the wait
         comes back empty. This read `auth.currentUser` immediately after
         importing the SDK, and on a customer room nothing subscribes to auth
         state, so the persisted session had not been restored and it was
         reliably null: every customer saw "that didn't save", `welcomedAt` was
         never written, and the arrival greeted them again on every sign-in for
         ever. `authedFetch` carries the token when the SDK has one and lets
         the same-origin session cookie identify the customer when it does not
         - and the cookie is the very thing that rendered this screen. */
      const res = await authedFetch('/api/welcome/complete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('mark-failed');

      /* A document load. `router.refresh()` clears the cache for the CURRENT
         route - `/welcome` - while the destination is what needs re-rendering
         against the flag that was just written. Home reads that flag to decide
         whether to send the customer back here, so a stale payload would loop
         them into the arrival they have just finished. */
      window.location.replace(href);
    } catch {
      setBusy(false);
      setNote('That didn’t save. Try once more - we don’t want to greet you twice.');
    }
  };

  /**
   * Ask for notification permission.
   *
   * APPLE 4.5.4 - this is optional and always skippable, and nothing behind it
   * is gated on the answer. A refusal is not an error and is not treated as
   * one; it moves on exactly like the skip does.
   */
  const askToTell = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { pushSupported, enablePush } = await import('@/lib/services/push');
      const { currentUid } = await import('@/lib/clientSession');
      const uid = await currentUid();
      if (!pushSupported() || !uid) {
        setNote('This device can’t be told. You can still see everything here.');
      } else {
        const ok = await enablePush(uid);
        if (!ok) setNote(NOT_NOW);
      }
    } catch {
      setNote(NOT_NOW);
    } finally {
      setBusy(false);
      /* Whatever the answer, the arrival continues. */
      if (panel.forwardHref) router.push(panel.forwardHref);
    }
  };

  const isNotifications = panel.step === 'notifications';
  const isLast = !panel.forwardHref;

  return (
    <MotionConfig reducedMotion="user">
      <main
        style={{
          minHeight: '100svh',
        /* The top inset, from the token - see ServerRoom. */
        paddingTop: stack.top,
          background: color.paper,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingInline: INSET,
          paddingBlock: space.movement,
        }}
      >
        <div style={{ maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
          <AnimatePresence mode="wait">
            <motion.section
              key={panel.step}
              /* §21.6 - where you are in the arrival, for a screen reader,
                 without drawing progress dots at anybody. */
              aria-label={`Step ${position.index} of ${position.total}`}
              initial={entered ? (still ? { opacity: 0 } : { opacity: 0, y: space.gap }) : false}
              animate={{ opacity: 1, y: 0 }}
              exit={still ? { opacity: 0 } : { opacity: 0, y: -space.breath }}
              transition={{ duration: duration.move / 1000, ease: curve.ease }}
            >
              {greeting && panel.step === 'hello' ? (
                <Text role="whisper" tone="ink3" style={{ marginBottom: space.line }}>
                  {greeting}
                </Text>
              ) : null}

              <Heading level="display">{panel.title}</Heading>

              {panel.line ? (
                <Text role="body" tone="ink2"
                  style={{ marginTop: INSET, maxWidth: MEASURE }}>
                  {panel.line}
                </Text>
              ) : null}

              {panel.rooms ? (
                <div style={{ marginTop: space.rest }}>
                  {panel.rooms.map(r => (
                    <div
                      key={r.name}
                      style={{
                        paddingBlock: space.gap,
                        borderTop: `${HAIRLINE}px solid ${color.edge}`,
                      }}
                    >
                      <Heading level="title" as="h2">{r.name}</Heading>
                      <Text role="body" tone="ink2" style={{ marginTop: space.hair }}>
                        {r.line}
                      </Text>
                    </div>
                  ))}
                </div>
              ) : null}

              {note ? (
                <Text role="whisper" tone="ink3" aria-live="polite"
                  style={{ marginTop: space.gap }}>
                  {note}
                </Text>
              ) : null}

              <div style={{
                marginTop: space.rest, display: 'flex',
                gap: space.gap, flexWrap: 'wrap', alignItems: 'center',
              }}>
                {isNotifications ? (
                  <Button tier="primary" onClick={askToTell} loading={busy}>
                    {panel.forward}
                  </Button>
                ) : isLast ? (
                  <Button
                    tier="primary"
                    loading={busy}
                    onClick={() => finish(hasCar ? homeHref : addCarHref)}
                  >
                    {panel.forward}
                  </Button>
                ) : (
                  <Button tier="primary" href={panel.forwardHref}>
                    {panel.forward}
                  </Button>
                )}

                {panel.pass ? (
                  isLast ? (
                    <Button tier="quiet" onClick={() => finish(homeHref)} disabled={busy}>
                      {panel.pass}
                    </Button>
                  ) : (
                    /* A plain link, so passing over a step is a history entry
                       like taking it - Back has to work in both directions. */
                    <Link
                      href={panel.passHref ?? homeHref}
                      style={{
                        minHeight: 44, display: 'inline-flex', alignItems: 'center',
                        color: color.ink3, textDecoration: 'none', fontSize: 15,
                      }}
                    >
                      {panel.pass}
                    </Link>
                  )
                ) : null}
              </div>
            </motion.section>
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  );
}
