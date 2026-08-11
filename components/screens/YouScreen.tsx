'use client';
/**
 * YOU
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §3.1, §3.5, §5.1, §5.2, §8.2, §8.3, §8.6,
 *         §9.5, §10.4, §15.2, §15.3, §15.6, §17.3, §18.1, §21.1, §21.3, §21.6
 *         design "AutoModz App.dc.html" — screen 1l
 *
 * §5.2 — Profile is about "the person", and holds "name, contact, how they are
 * reached, devices, sign-out".
 *
 * ── THE MONOGRAM, AND WHY §2.2 DOES NOT FORBID IT ────────────────────────
 * This file used to state: "no hero, no avatar and no monogram", citing §2.2 —
 * "no individual is ever named on any customer surface." That reading was too
 * wide, and the design corrects it.
 *
 * §2.2 is about the STUDIO's people. Its purpose is that confidence attaches
 * to the place rather than to a technician, so a customer's trust survives
 * that person's day off. The customer is not one of the studio's individuals;
 * their own initials on their own screen name nobody but themselves. What
 * remains forbidden is unchanged: no photograph of a person, no staff name,
 * no face anywhere in the product.
 *
 * ── ONE LINE ABOUT THE CAR, AND ONLY WHILE IT IS TRUE ────────────────────
 * §5.2 says this room holds nothing about the car. The design puts exactly one
 * sentence here — "Ceramic curing · ready today, 6:20 pm" — and it earns its
 * place by being a DOORWAY (§17.3) rather than a detail: it exists only while
 * the studio physically has the car, says one thing, and opens the live visit.
 * The moment the work ends it is gone. That is state surfacing as state
 * (§17.1), not the car leaking into the person's room.
 *
 * ── ROWS, NOW ────────────────────────────────────────────────────────────
 * This screen used to argue against rows: "a settings list is a pile of
 * switches the customer has to audit." The design uses rows, and it is right —
 * the sentences-with-links form made eight administrative entries read as
 * eight paragraphs of prose, which is harder to scan, not easier. What the old
 * note was actually protecting against is kept: there are no icons, no boxes
 * around each row, and no toggles for things that are not toggles.
 *
 * §10.4 — there is NO primary control. Identity is not a task. Sign-out is
 * quiet, alone, at the end (§15.6 — leaving is easy and not defended).
 */
import { color, space, TARGET_MIN } from '@/design';
import { OfflineNote } from '@/components/system';
import {
  Screen, Pane, Label, Rail, Pulse, Row, Chevron,
} from '@/components/os';
import Link from 'next/link';

/** A sentence, and the one way onward from it. */
export interface YouEntry {
  line: string;
  action: { label: string; href: string };
}

export interface YouModel {
  /** §5.2 — the person's name. The one Display (§9.5). */
  name: string;
  /** §5.2 — how they are reached. One line, mono, never a form. */
  reachedAt: string;
  /** "Gold · since 2023". Absent for a customer who holds no membership. */
  standing?: string;
  /**
   * §17.3 — the one quiet line. Present ONLY while the studio has the car,
   * and it opens the live visit. See the note above.
   */
  state?: { line: string; href: string };
  /**
   * How many cars they own. A fact about the PERSON's ownership, not about any
   * car — §5.2's "never anything about the car" bars a car's state from this
   * room, not the customer's own count of them.
   */
  garage: YouEntry;
  /**
   * §15.3 — what a member must always know: that they have one and which tier,
   * what remains, when it renews, and what it has been worth. The fourth is
   * "the one most products omit and the one that decides renewal".
   * §18.1 — no membership, nothing shown. Never an invitation to buy one.
   */
  membership?: { lines: readonly string[]; action: { label: string; href: string } };
  /**
   * §10.5 — "If there is no destination yet, there is no control yet."
   * Each of these opens a real surface: the preference sheet, the referral
   * sheet, and the published privacy policy.
   */
  notifications?: YouEntry;
  ownership?: YouEntry;
  privacy?: YouEntry;
  /** Editing name and phone. */
  details?: YouEntry;
  /** Terms of service — published, and required for an App Store listing. */
  terms?: YouEntry;
  /** §5.1.1(v) — deleting the account, in-app, with nothing to request. */
  deletion?: YouEntry;
  /** §20.1 — a way to reach a human. */
  support: YouEntry;
  /* ── DESIGN SCREEN 19's OWN ROWS ────────────────────────────────────── */
  /** "UPI · okhdfc" when one is saved, and an invitation when none is. */
  payment?: YouEntry;
  /** "2 saved" — where the studio collects from. */
  addresses?: YouEntry;
  /** The papers a customer may want: invoices and warranties. */
  papers?: YouEntry;
  /**
   * QUIET MODE. A row with a switch rather than a door, because it is one
   * decision with one answer, and a panel for it would be a room containing a
   * single control.
   */
  quiet?: { line: string; on: boolean };
  /** Consent is per CAR; the privacy panel needs them. */
  consentCars?: { id: string; name: string; registration: string; granted: boolean }[];
}

/** Two letters at most, from the customer's own name. Never a photograph. */
const monogram = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'A';

export function YouScreen({
  model, onSignOut, quietOn = false, quietBusy = false, onQuietMode,
}: {
  model: YouModel;
  /**
   * §5.2, §15.6 — plainly worded, not defended. An ACTION, not an href: this
   * was `signOutHref: '/auth/login'`, which navigated to the sign-in page and
   * left the session intact.
   */
  onSignOut: () => void;
  /** Quiet mode is a switch, so its state and its handler come from the room. */
  quietOn?: boolean;
  quietBusy?: boolean;
  onQuietMode?: () => void;
}) {
  const {
    name, reachedAt, standing, state, garage, membership,
    details, notifications, ownership, privacy, terms, deletion, support,
    payment, addresses, papers,
  } = model;

  /* The administrative end, as one list. Ordered by how often it is opened,
     which is the opposite of how it is usually ordered.

     Each row carries its SENTENCE under its name. §8.6 — a fact is a line of
     text, and "One car lives here." is the fact; "Your garage" is only the
     door. Dropping the sentence for a tidier list would be tidying away the
     information and keeping the furniture. */
  const rows = [
    garage, papers, payment, addresses,
    details, notifications, ownership, privacy, terms,
  ].filter(Boolean) as YouEntry[];

  return (
    <Screen top={space.rest}>
      <OfflineNote />

      {/* ── IDENTITY ────────────────────────────────────────────────────
          §21.6 — the one top-level heading. The monogram beside it, not over
          a photograph: see the note at the top of this file. */}
      <header style={{ display: 'flex', alignItems: 'center', gap: space.gap }}>
        <span
          aria-hidden
          className="am-display"
          style={{
            width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 300,
            background: 'linear-gradient(150deg, rgba(232,217,190,0.35), rgba(224,164,92,0.18))',
            border: '1px solid rgba(232,217,190,0.3)',
          }}
        >
          {monogram(name)}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h1
            className="am-display"
            style={{ margin: 0, fontSize: 22, fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            {name}
          </h1>
          {standing ? (
            <Label style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(232,217,190,0.75)' }}>
              {standing}
            </Label>
          ) : null}
        </span>
      </header>

      {/* ── THE ONE QUIET LINE ──────────────────────────────────────────
          §17.3 — a doorway. It exists only while the work does. */}
      {state ? (
        <Pane
          tone="warm"
          as={Link}
          {...{ href: state.href }}
          style={{
            marginTop: space.gap + space.breath,
            padding: `${space.gap}px ${space.gap + 2}px`,
            display: 'flex', alignItems: 'center', gap: space.line,
            textDecoration: 'none',
          }}
        >
          <Pulse size={7} />
          <span style={{ fontSize: 13.5, color: color.ink, flex: 1 }}>{state.line}</span>
          <Chevron size={16} />
        </Pane>
      ) : null}

      {/* ── HOW THEY ARE REACHED ────────────────────────────────────────
          §5.2. One line, mono, never a form — editing it is a row below. */}
      <Pane style={{ marginTop: space.gap, padding: `${space.line + 2}px ${space.gap + 2}px` }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: color.ink2 }}>
          {reachedAt}
        </span>
      </Pane>

      {/* ── THE MEMBERSHIP ──────────────────────────────────────────────
          §15.3's facts, as lines, with the room behind them one tap away.
          §18.1 — silence when there is none; a room about the person is not a
          place to sell one. */}
      {membership ? (
        <Pane
          tone="cool"
          as={Link}
          {...{ href: membership.action.href }}
          style={{
            marginTop: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line, textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {membership.lines.map((line, i) => (
              <span
                key={line}
                style={{
                  fontSize: i === 0 ? 14.5 : 12.5,
                  color: i === 0 ? color.ink : color.ink2,
                  lineHeight: 1.45,
                }}
              >
                {line}
              </span>
            ))}
          </span>
          <Chevron />
        </Pane>
      ) : null}

      {/* ── EVERYTHING ELSE ─────────────────────────────────────────────
          Rows. No boxes, no icons — each is a name and a way onward, and the
          whole row is the target (§21.3). */}
      <section
        aria-labelledby="you-account"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="you-account" style={{ margin: 0 }}><Rail>Your account</Rail></h2>
        <div>
          {rows.map((e, i) => (
            <Row key={e.action.href + e.action.label} href={e.action.href} last={i === rows.length - 1}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>{e.action.label}</span>
                <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>{e.line}</Label>
              </span>
            </Row>
          ))}

          {/* ── QUIET MODE ────────────────────────────────────────────
              Design 19. A SWITCH, not a door: one decision with one answer,
              and a panel for it would be a room containing a single control.
              Its sentence says exactly what still gets through, because a
              customer who cannot tell will not turn it on. */}
          {model.quiet && onQuietMode ? (
            <button
              type="button"
              role="switch"
              aria-checked={quietOn}
              aria-busy={quietBusy || undefined}
              onClick={onQuietMode}
              disabled={quietBusy}
              className="am-tap"
              style={{
                appearance: 'none', width: '100%', background: 'none', border: 'none',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: space.line, paddingBlock: space.line, paddingInline: 2,
                textAlign: 'left', font: 'inherit',
                cursor: quietBusy ? 'default' : 'pointer',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14.5, color: color.ink }}>Quiet mode</span>
                <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>{model.quiet.line}</Label>
              </span>
              {/* §21.6 — the word carries the state, not only the shape. */}
              <span style={{
                /* Yields rather than crushing the label beside it — see
                   `Value` in components/os/parts. */
                fontFamily: 'var(--font-mono)', fontSize: 12,
                marginLeft: 'auto', textAlign: 'right', overflowWrap: 'anywhere',
                color: quietOn ? color.champagne : color.ink3,
              }}>
                {quietOn ? 'ON' : 'OFF'}
              </span>
            </button>
          ) : null}
        </div>
      </section>

      {/* §20.1 — a way to reach a human, and the studio's own number beside
          it rather than behind it. The design puts the number ON the row,
          because a number you can read is faster than a link you must open. */}
      <section
        aria-labelledby="you-support"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="you-support" style={{ margin: 0 }}><Rail>The studio</Rail></h2>
        <div>
          <Row href={support.action.href} last>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>{support.action.label}</span>
              <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>{support.line}</Label>
            </span>
          </Row>
        </div>
      </section>

      {/* ── LEAVING ─────────────────────────────────────────────────────
          §15.6's principle, applied to the account: plainly worded, alone, and
          not defended by a maze. Quiet, because a filled control here would be
          the screen urging the customer out of it. */}
      <div
        style={{
          marginTop: space.rest, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', gap: space.line,
        }}
      >
        <button
          type="button"
          onClick={onSignOut}
          className="am-tap"
          style={{
            minHeight: TARGET_MIN, background: 'none', border: 'none',
            cursor: 'pointer', color: color.ink2, fontSize: 14.5, font: 'inherit',
            paddingInline: 0,
          }}
        >
          Sign out
        </button>

        {/* DELETING THE ACCOUNT sits below signing out and last of all. Not
            hidden — Apple 5.1.1(v) and plain decency both require it to be
            findable — but furthest from the top, because it is the one act
            here that cannot be undone. */}
        {deletion ? (
          <Link
            href={deletion.action.href}
            className="am-tap"
            style={{
              minHeight: TARGET_MIN, display: 'flex', alignItems: 'center',
              color: color.ink3, fontSize: 13.5, textDecoration: 'none',
            }}
          >
            {deletion.action.label}
          </Link>
        ) : null}
      </div>

      {/* The studio's mark at the foot, barely there. The design closes the
          person's room with the wordmark the way a letter closes with a
          signature — it says who is holding all this. */}
      <span
        aria-hidden
        className="am-display"
        style={{
          marginTop: space.rest, textAlign: 'center',
          fontSize: 22, letterSpacing: '0.34em', textTransform: 'uppercase',
          color: 'rgba(237,235,231,0.16)',
        }}
      >
        AutoModz
      </span>
    </Screen>
  );
}
