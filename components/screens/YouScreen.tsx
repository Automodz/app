'use client';
/**
 * YOU
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §3.1, §3.5, §5.1, §5.2, §8.2, §8.3, §8.6,
 *         §9.5, §10.4, §15.2, §15.3, §15.6, §18.1, §21.1, §21.3, §21.6
 *
 * §5.2 — Profile is about "the person", and holds "name, contact, how they are
 * reached, devices, sign-out". It never holds anything about the car.
 *
 * ── THIS IS THE ONE ROOM WITH NO PHOTOGRAPH ──────────────────────────────
 * §3.1 makes a photograph the interface of any VEHICLE surface. This is not
 * one — §5.1 puts it under a different concept entirely — and the only thing
 * that could be photographed here is a person, which §2.2 forbids for a reason
 * that has nothing to do with taste: confidence must attach to the place, not
 * to a face. So there is no hero, no avatar and no monogram. The room opens on
 * the customer's own name, at the size of a title page.
 *
 * ── NOT A SETTINGS SCREEN ────────────────────────────────────────────────
 * Every entry is a SENTENCE with one way onward hanging off it, not a row with
 * a chevron. No dividers, no icons, no boxes, no toggles, no repeated row unit
 * — those are what make a settings list, and a settings list is a pile of
 * switches the customer has to audit. §8.6: a fact is a line of text.
 *
 * The air is not uniform, and that is the hierarchy. What belongs to the person
 * breathes at `movement`; the administrative end sits closer at `rest`. Nothing
 * here is a peer of anything else, so nothing is spaced like one.
 *
 * §10.4 — there is NO primary control. Nothing on this screen is "the thing
 * this screen exists to let you do"; identity is not a task. Sign-out is
 * `quiet`, alone, at the end (§15.6's spirit — leaving is easy and not
 * defended by a maze).
 */
import { color, space, column, stack } from '@/design';
import { Heading, Text, Button, OfflineNote, Glass } from '@/components/system';

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
  /**
   * How many cars they own. A fact about the PERSON's ownership, not about any
   * car — §5.2's "never anything about the car" bars a car's state from this
   * room, not the customer's own count of them.
   */
  garage: YouEntry;
  /**
   * §15.3 — what a member must always know: that they have one and which tier,
   * what remains, when it renews, and what it has been worth. The fourth is
   * "the one most products omit and the one that decides renewal", so it is
   * not optional here.
   *
   * §15.2 places a membership with the car's protections as well; this is the
   * relationship's own reading of it, and the entrance to its room.
   * §18.1 — no membership, nothing shown. Never an invitation to buy one.
   */
  membership?: { lines: readonly string[]; action: { label: string; href: string } };
  /**
   * §10.5 — "If there is no destination yet, there is no control yet."
   *
   * These three used to point at `/you`, the address they were already on, and
   * were omitted rather than left inert. Each now opens a real surface: the
   * preference sheet, the referral sheet, and the published privacy policy.
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
}

/** A sentence with one way onward. Deliberately not a row. */
function Entry({ entry, gap }: { entry: YouEntry; gap: 'rest' | 'movement' }) {
  return (
    <section style={{ ...column, paddingTop: space[gap] }}>
      {/* Each account entry is its own card. As bare text on the ground these
          read as one long column of sentences with links in it; in glass each
          becomes a distinct thing a customer can act on. */}
      <Glass pad="gap">
      {/* The STATEMENT is secondary ink and the ACTION is primary — the
          opposite of the obvious arrangement, and rendered it is the only one
          that works. At equal weight a `forward` link looks exactly like the
          sentence above it and stops reading as something you can touch, and
          the alternatives are all chrome: a chevron, an underline, an icon.
          The context is quiet; the live thing is bright. */}
        <Text role="body" tone="ink2">{entry.line}</Text>
        <div style={{ marginTop: space.breath }}>
          <Button tier="forward" href={entry.action.href}>{entry.action.label}</Button>
        </div>
      </Glass>
    </section>
  );
}

export function YouScreen({
  model, onSignOut,
}: {
  model: YouModel;
  /**
   * §5.2, §15.6 — plainly worded, not defended. An ACTION, not an href: this
   * was `signOutHref: '/auth/login'`, which navigated to the sign-in page and
   * left the session intact. The customer tapped "Sign out", saw a sign-in
   * screen, went back and was still signed in — on a shared device that is not
   * a copy problem.
   */
  onSignOut: () => void;
}) {
  const {
    name, reachedAt, garage, membership,
    details, notifications, ownership, privacy, terms, deletion, support,
  } = model;

  return (
    <main
      style={{
        background: color.paper,
        minHeight: '100svh',
        paddingBottom: stack.contentFloor,
      }}
    >
      {/* §20.3 — the room was rendered on the server and is still true; only
          what happens NEXT needs a connection. One implementation (§22.2). */}
      <OfflineNote />
      {/* ── IDENTITY ────────────────────────────────────────────────────
          The name, at the size a name deserves. §21.6 — the one top-level
          heading. The top safe area is respected here rather than by a hero,
          because this room has no hero to absorb it. */}
      <section
        style={{
          ...column,
          paddingTop: `calc(${stack.top} + ${space.movement}px)`,
        }}
      >
        <Heading level="display">{name}</Heading>
        <Text role="data" tone="ink2" style={{ marginTop: space.line }}>
          {reachedAt}
        </Text>
      </section>

      {/* ── WHAT THEY OWN, AND THEIR RELATIONSHIP ───────────────────────
          The two things that are theirs. Spaced at `movement`, the step §8.3
          reserves for where the eye is meant to pause. */}
      <Entry entry={garage} gap="movement" />

      {/* §15.3 — all four facts, as lines. §18.1 — silence when there is no
          membership; a room about the person is not a place to sell one. */}
      {membership ? (
        <section style={{ ...column, paddingTop: space.movement }}>
          {membership.lines.map((line, i) => (
            <Text
              key={line}
              role="body"
              tone="ink2"
              style={{ marginTop: i === 0 ? 0 : space.line }}
            >
              {line}
            </Text>
          ))}
          <div style={{ marginTop: space.breath }}>
            <Button tier="forward" href={membership.action.href}>
              {membership.action.label}
            </Button>
          </div>
        </section>
      ) : null}

      {details ? <Entry entry={details} gap="movement" /> : null}
      {notifications ? <Entry entry={notifications} gap="rest" /> : null}

      {/* ── THE ADMINISTRATIVE END ──────────────────────────────────────
          Closer together, on purpose. These are things a customer needs to be
          able to find and almost never opens; spacing them like the three
          above would claim they matter equally, which is the flattening §3.5
          warns about. */}
      {ownership ? <Entry entry={ownership} gap="movement" /> : null}
      {privacy ? <Entry entry={privacy} gap="rest" /> : null}
      {terms ? <Entry entry={terms} gap="rest" /> : null}
      <Entry entry={support} gap={ownership || privacy ? 'rest' : 'movement'} />

      {/* ── LEAVING ─────────────────────────────────────────────────────
          §15.6's principle, applied to the account: plainly worded, alone, and
          not defended by a maze. `quiet` because §10.4 gives that tier to
          "dismiss, cancel, secondary paths" — and because a filled control
          here would be the screen urging the customer out of it. */}
      <section style={{ ...column, paddingTop: space.movement }}>
        <Button tier="quiet" onClick={onSignOut}>Sign out</Button>
      </section>

      {/* DELETING THE ACCOUNT sits below signing out and last of all. It is
          not hidden — Apple 5.1.1(v) and plain decency both require it to be
          findable — but it is the furthest thing from the top, because it is
          the one act here that cannot be undone. */}
      {deletion ? (
        <section style={{ ...column, paddingTop: space.rest }}>
          <Button tier="quiet" href={deletion.action.href}>{deletion.action.label}</Button>
        </section>
      ) : null}
    </main>
  );
}
