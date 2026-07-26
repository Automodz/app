# AutoModz OS — Information Architecture

**Status: binding.** Companion to the Constitution, Art. 2 and Art. 18. Ratified 2026-07-25.

> Three concepts. Five entrances. One question on every screen:
> **how does this make the owner feel more connected to their car?**

---

## 1 · The three concepts

Internally the object model keeps its names. Externally the customer sees three plain words.

| Concept | Holds | Objects underneath |
|---|---|---|
| **Garage** | everything about the car | Vehicle · Visit · Protection · Record · Moment |
| **Studio** | everything between AutoModz and the customer | Studio · Visit (being arranged) · Thread |
| **You** | everything that supports the relationship | Party · Membership · payment methods · preferences |

Adding an entrance is a design decision. Adding a **concept** is a constitutional amendment.

---

## 2 · The five entrances

```
┌─────────┬──────────┬───────────┬──────────┬─────────┐
│ Garage  │ Journey  │   Book    │  Studio  │   You   │
│Your Car │   What   │   Next    │ AutoModz │ Account │
│         │ Happened │   Visit   │          │         │
└─────────┴──────────┴───────────┴──────────┴─────────┘
   Garage ─── Garage ──── Studio ─── Studio ─── You
        └── concept each entrance belongs to ──┘
```

**No time model.** An earlier draft labelled these Current / Past / Future / Present / Identity. It read elegantly and it was wrong: Studio is a *place*, not a tense, and forcing it into one made the model lie. The labels above are what the entrance actually is.

**Book is a capability, not a concept** (Art. 2). It earns an entrance because arranging a visit is frequent and deliberate; it does not earn a concept, and when AI scheduling and pickup mature it may nearly disappear without the product losing meaning.

**A live visit is not an entrance.** While the car is with us it surfaces as the Garage's *current state* and opens as a full-screen takeover. It is the Garage transformed by state — never a sixth tab.

---

## 3 · The Garage hierarchy

The order is fixed. No surface may invert it.

```
┌────────────────────────────────────┐
│                                    │
│                                    │
│        1 · THEIR OWN CAR           │   full-bleed photograph
│        photographed by us          │   the largest element on screen
│                                    │
│   ····· invisible hotspots ·····   │   hood · roof · doors · glass · wheels
│                                    │
├────────────────────────────────────┤
│  2 · CURRENT STATE                 │   "Being Protected" · "Ready for Pickup"
├────────────────────────────────────┤
│  3 · LATEST TRANSFORMATION         │   the most recent finished work
├────────────────────────────────────┤
│  4 · PROTECTION                    │   living states — never documents
│     ● PPF          Lifetime        │
│     ● Insurance    47 days         │
│     ● PUC          18 days         │
│     ● Ceramic      Active          │
│     ● FASTag       Low balance     │
├────────────────────────────────────┤
│  5 · JOURNEY                       │   what happened, stage by stage
└────────────────────────────────────┘
            no employee anywhere
```

Notice what is *not* here: no invoice numbers, no job IDs, no booking references, no internal statuses, no technician. And notice that every important document is represented without a single document on screen — that is the living-states law (`AUTOMODZ-LIVING-STATES.md`).

**The no-photo state must be designed, not defaulted.** A brand-new customer has no professional photograph of their car. Today that renders as a small plate in a large black field, which reads as broken. It must read as *awaiting* — a deliberate, beautiful invitation, with the capture happening at the first visit.

---

## 4 · What lives where

| Entrance | Contains | Does **not** contain |
|---|---|---|
| **Garage** · Your Car | hero, current state, latest transformation, protection states, entry to Journey and Media | settings, payments, anything about AutoModz-the-business |
| **Journey** · What Happened | every visit as a transformation with photos and clips; the sealed Chapter as detail view | live visits (those are Garage state) |
| **Media** *(inside Garage)* | every photo and clip ever taken of this car, ours and theirs, chronological | anything not about this car |
| **Book** · Next Visit | service → vehicle → time → confirm, priced and paid | a studio picker (until studio #2 exists) |
| **Studio** · AutoModz | the place: credentials, equipment, latest transformations, seasonal advice, gallery, showcase, announcements, pickup availability | a staff roster · any named individual |
| **You** · Account | membership, addresses, payments, preferences, notifications, support, security, referral, downloads | anything about the car |

---

## 5 · The acceptance test

Every surface is judged against the six questions people actually ask:

| Question | Answered by |
|---|---|
| Is my car safe? | Garage — current state |
| Is the work finished? | Garage — current state → live takeover |
| How does it look? | Garage — hero + latest transformation; Media |
| When can I collect it? | Live takeover — the timing line |
| What warranty do I have? | Garage — protection states |
| What did you actually do? | Journey — stages; any photo resolves to its Visit |

**Every one is answerable within one tap of the Garage.** That is the test. Nobody asks which technician polished the bonnet.

---

## 6 · What is removed from customer view

Internal vocabulary is a hard, grep-enforceable boundary (Art. 16.2, extended by the actor law in Art. 8):

| Removed | Because |
|---|---|
| Invoice IDs, job IDs, booking IDs, Firestore IDs, order numbers | plumbing |
| Internal statuses — `quality_check`, `ready_for_delivery`, `vehicle_received` | ops vocabulary; translated to stages |
| Technician names, assignments, "applied by", "cared for by" | the actor law — AutoModz is the craftsman |
| Any raw PDF as a primary surface | the living-states law |
| Empty-state cards | absence renders as silence or invitation (Art. 15.7) |

**Kept:** the registration number. It is the customer's own plate — identity, not jargon.

---

## 7 · Navigation mechanics

- **Five slots, one floating action.** Book is a floating primary action, not an equal tab — it is a capability, and the geometry should say so.
- **Every surface stays addressable by URL.** The current app's `?sheet=` pattern is one of its better decisions and it survives: a sheet, a state card, a moment and a chapter each have an address, so a deep link and a shared link both work.
- **The nav must be built on the stacking contract** (`--st-stack-bottom`, `--st-content-floor`). The audit measured four fixed layers overlapping at 375×812, with the only CTA on screen covered on first run. No fixed element invents its own offset again.
- **Tap targets ≥ 44px.** The current dock gives four navigation targets 31px each while a decorative wordmark takes 57% of the bar. Chrome does not outrank function.

---

## 8 · What this replaces

| Retired | Was | Now |
|---|---|---|
| The Glance (`app/app/page.tsx`) | one adaptive screen | Garage |
| The Desk (`?sheet=desk`) | the conversation's index + object shelf | dissolved into the five entrances; the object shelf was where two dead rows lived |
| The Capsule | the one global control | the live takeover is reached from Garage state |
| The Dock | 4 slots + a wordmark pedestal | five entrances + floating Book |
| `?sheet=you` | a sheet | You, an entrance |

The Stay and the Chapter **survive**. They are the two surfaces the audit found already at benchmark; the Stay becomes the live takeover from Garage state, the Chapter becomes the sealed-Visit detail view inside Journey.
