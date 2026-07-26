# AutoModz OS — Design Language

**Status: binding.** The second of two laws. Ratified 2026-07-25.

> The Constitution says **what the product is**. This says **how it feels**.
> **No screen may be implemented until it conforms to both.**

Every value here maps to a token in `app/globals.css`. If a rule cannot be expressed as a token, it is not yet a rule — it is a preference, and it does not belong in this document.

---

## 0 · The one question

Before any screen is designed:

> **How does this make the owner feel more connected to their car?**

If the answer is "it doesn't, but they need it" — it is plumbing, and plumbing lives in **You**. If the answer is "it doesn't, and it looks nice" — it does not ship.

---

## 1 · Hero philosophy

**The car is the hero. Nothing competes with it.**

- The customer's own photograph, never our catalogue, never a stock car, never a generic 3D model. A stand-in BMW that isn't *their* BMW breaks the only promise the Garage makes.
- The hero occupies **the top of the screen edge to edge** — no inset, no card, no rounded corner against the environment. It is a window, not a picture hung on a wall.
- **One hero per screen, ever.** A screen with two heroes has no hero.
- Information lives *on* the hero as glass, never beside it. The car does not share the row.
- The hero is a **renderer boundary** (`HeroVehicle`), not a picture. Today: a photograph. Tomorrow: photogrammetry, a scan, a model, AR. Nothing outside the component may know which.

### The no-photo state is designed, not defaulted

A new customer has no professional photograph. Today that renders as a small plate in a large black field, which reads as *broken*. It must read as **awaiting**:

- The full hero frame, filled — a lit graphite monument bearing the marque and the registration, using the existing `.st-chrome` brushed-metal ramp.
- One quiet line about what happens next: *"Photographed at your first visit."*
- **Never** an upload button in the hero. The studio takes this photograph; asking the owner to do it cheapens the promise.

---

## 2 · Surface philosophy

Four surfaces exist. There are no others.

| Surface | Token | What it is | Rule |
|---|---|---|---|
| **Environment** | `--st-paper` `#0A0B0D` + `Ambient` | the lit room everything floats in | fixed, never re-mounts across routes |
| **Glass** | `--st-glass` `rgba(18,20,23,0.55)` | a floating pane | must carry `--st-edge`; never nested in glass |
| **Ground** | `--st-gallery` `#131417` | a sheet's floor | sheets only |
| **Photograph** | — | the car | scrim, never a filter |

### Laws

1. **Glass never nests.** A glass card inside a glass panel produces mud and doubles the blur cost. If content needs grouping inside glass, group it with space or a hairline.
2. **Every glass surface carries the carved edge** — `inset 0 1px 0 rgba(255,255,255,0.08)`. This is what makes it read as a machined pane rather than a translucent rectangle. It is not optional.
3. **Glass over photography uses `--st-glass-on-photo`** (`rgba(12,13,14,0.64)`) — heavier, because it must stay legible over an unknown image.
4. **The environment is never painted by a screen.** `Ambient` lives at the shell and persists across navigation. A screen that paints its own background breaks the illusion of one lit space and is a bug.
5. **Almost no borders, almost no cards.** A hairline (`--st-hairline`) separates; it does not enclose. If something needs a box to be understood, the hierarchy is wrong.

---

## 3 · Lighting system

The product is lit, not coloured. This is the single biggest contributor to "luxury vehicle" over "React application".

```
key light      cool, high-left     ambient pool, barely there
fill light     warm graphite       low-right, grounds the space
vignette       seating vignette    draws the eye in
edge           inset top sheen     every glass surface, always
specular       .st-chrome-sweep    8s, monuments and marques only
bloom          radial soft-light   behind hero type, drifts slowly
```

### Laws

1. **Light comes from the environment, not from objects.** Objects catch light (`--st-edge`); they do not emit it. There are no glows on cards, no accent halos, no coloured shadows.
2. **The light is near-neutral.** Any warmth is graphite-warm, never gold. Colour comes from photographs and from state, nowhere else.
3. **Specular sweeps are for monuments only** — the wordmark, the no-photo marque, the hero light sweep. Never on a card, a chip, or a button.
4. **The hero light sweep runs every 20–30s**, and is imperceptible if you are looking for it. If a user notices it happening, it is too strong.

---

## 4 · Depth system

Elevation and z-order are **one scale**, not two. The audit found `hold`/`raise`/`lift` used ad hoc, producing three panes at three depths that read as identical — and then collided.

| Band | z | Shadow | Inhabitants |
|---|---|---|---|
| `--st-z-base` | 0 | `--st-hold` | content on the environment |
| `--st-z-raised` | 10 | `--st-raise` | cards, state cards |
| `--st-z-float` | 40 | `--st-lift` | floating chips, the Book action |
| `--st-z-nav` | 60 | `--st-lift` | the tab bar |
| `--st-z-sheet` | 70 | `--st-lift` | sheets + scrim |
| `--st-z-takeover` | 80 | — | the live visit, the immersive viewer |
| `--st-z-alert` | 90 | `--st-lift` | toasts |

**The shadow is determined by the band. A component does not choose its own.**

### The stacking contract

The audit measured four fixed layers overlapping at 375×812, with the only CTA on screen covered on first run, because three components each invented their own `bottom` offset. That may not happen again:

```css
--st-nav-h:        68px;
--st-nav-gap:      10px;
--st-stack-bottom: calc(env(safe-area-inset-bottom) + var(--st-nav-h) + var(--st-nav-gap));
--st-content-floor: calc(var(--st-stack-bottom) + var(--st-gap));
```

- **Every fixed element positions off `--st-stack-bottom`.** No component computes its own offset.
- **Every scrollable surface pads to `--st-content-floor`.** No content ends underneath chrome.
- **At most one floating element** above the nav at a time. Two floating things fighting for the same corner is a design failure, not a z-index problem.

---

## 5 · Motion language

Motion is state changing. It is never decoration — **except on the car itself**, which is the product and must feel alive rather than pasted on (Constitution Art. 13, as amended).

### Timing

| Token | Duration | For |
|---|---|---|
| `--st-tick` | 120ms | taps, state flips, chip changes |
| `--st-move` | 280ms | reveals, sheets, card entrances |
| `--st-scene` | 480ms | route transitions, act changes |
| view transition | 620ms | the hero morphing between surfaces |

**One ease:** `cubic-bezier(0.22, 1, 0.36, 1)`.
**One spring, for anything that follows a finger:** `stiffness 380, damping 34, mass 0.9`.

> **The rule that decides which:** if the finger drives it, use the spring. If the system drives it, use the ease. Today everything uses the ease, which is why drag interactions feel *authored* rather than physical.

### The hero's four motions — the only permitted ambient motion

| Motion | Value | Trigger |
|---|---|---|
| intro settle | scale `1.06 → 1.00` over `--st-scene` | screen open, once |
| scroll parallax | hero moves slower than content | scroll |
| device tilt | 5–10px perspective shift | `deviceorientation` |
| light sweep | one soft pass | every 20–30s |

Hotspots may pulse **only while their state is asking for attention** — never ambiently. A pulsing hotspot on a healthy protection is noise.

### The motion law

> **Motion decorates content. It never gates it.**

No surface may render its payload inside an entrance animation. If the animation does not run — a throttled frame, a slow device, a JS error — the content must already be there. **Animate a wrapper, never the payload.** The audit reproduced a fully-legible Stay rendering at ~2% opacity because the entire surface was wrapped in `initial={{opacity: 0}}`. That is the failure this law exists to prevent.

### Banned everywhere except the hero

Loops · pulses · glows · parallax · bounce · scale-on-hover · anything that repeats without a state change behind it.

### Reduced motion

`MotionConfig reducedMotion="user"` at the shell covers framer. The light sweep and device tilt need **explicit** guards — they are not framer animations. Under reduced motion: scenes collapse to cross-fades, the hero holds still, hotspots mark attention with ink rather than movement.

---

## 6 · Image treatment

Every photograph has a communicative job — the **evidence chain**: portrait (identity) · arrival (custody) · condition (honesty) · craft (competence) · finished (the reveal) · detail (the promise).

### Laws

1. **No filters. Scrim only.** `--st-scrim-soft` `0.24` for status-bar legibility · `--st-scrim` `0.40` for a sheet backdrop · `--st-scrim-strong` `0.55` for text over the bottom of a photo.
2. **Text never sits over the middle of an image.** Top or bottom, over a gradient scrim that fades to transparent by 46%.
3. **A photo always reserves its aspect ratio before it loads.** No layout shift, ever. The hero is a fixed frame; the image arrives into it.
4. **Images fade in; they never pop.** `--st-move`, opacity only.
5. **Degradation is typographic dignity** — the lit marque monument — never a placeholder box, never a stock car, never a broken-image glyph.
6. **The car is never cropped through its own body** in the hero. Wheels and roofline are the silhouette; losing them loses the car.

---

## 7 · Typography hierarchy

| Role | Font | Weight | Size | Use |
|---|---|---|---|---|
| **Display** | Unbounded | 620–700 | `clamp(44px, 12vw, 60px)`, tracking `-0.04em` | the car, the state — one per screen |
| **Title** | Unbounded | 620 | 26px, `-0.02em` | sheet headings |
| **Emphasis** | DM Sans | 560 | 19px | the sentence that matters |
| **Body** | DM Sans | 400 | 17px | sentences |
| **Data** | DM Mono | 400–500 | 13px, tracking `0.06–0.14em`, uppercase | registrations, amounts, dates, counts |
| **Whisper** | DM Sans | 400 | 13px, `--st-ink-3` | asides, never load-bearing |

### Laws

1. **One Display per screen.** It is the state of the car. If two things are shouting, neither is heard.
2. **Sentence case everywhere.** No title case, no ALL CAPS except the Data role.
3. **Mono is for machine facts only** — a registration, an amount, a date, a count. Never for prose. Mono on a sentence reads as a terminal, not a studio.
4. **No exclamation marks. No emoji.** (Constitution Art. 8.)
5. **`--st-ink-3` (0.38 alpha) is for hairlines and non-essential asides only.** It fails contrast at body size. Text that must be read uses `--st-ink-2` (0.62) at minimum.
6. **Numbers never carry false precision.** "47 days", never "46.8 days". "Lifetime", never "98%".

---

## 8 · Navigation philosophy

> **You do not navigate to your car. You are already there.**

- **Five entrances, one floating action.** Book floats because it is a capability, not a concept — the geometry says what the Constitution says.
- **Home is the car.** Opening the app lands on the Garage, always. The PWA `start_url` is `/app`, not the marketing site.
- **Every surface is addressable by URL.** A sheet, a state card, a moment and a chapter each have an address, so deep links and shared links both work. This is the current app's best decision and it survives.
- **Back is truthful.** It returns where you came from, not up a hierarchy you never walked.
- **Takeovers replace, they do not stack.** The live visit and the immersive viewer are full-screen and dismissible by drag; they are not a third level of navigation.
- **Minimum target 44×44.** The audit found four navigation targets at 31px while a decorative wordmark took 57% of the bar. **Chrome never outranks function.**
- **No badge that cannot be earned.** The current bell is hardcoded to zero. A control that can never change state is worse than no control.

---

## 9 · Component hierarchy

```
HeroVehicle    the car — renderer boundary, one per screen
StateCard      every protection, policy, warranty, membership — one card, ten kinds
MomentEntry    one photograph, clip or note
MomentStage    the live act rail
Chapter        a sealed visit, as an editorial spread
Sheet          the one overlay
Field          the one input
Action         the one button, in tiers
Chip           the one status object
+ Display · Emphasis · Body · Data · Whisper
```

**A new component requires a constitutional amendment** (Art. 16.6).

### The tiers of `Action`

| Tier | Look | Use |
|---|---|---|
| `primary` | filled ink | one per sheet, the commitment |
| `forward →` | text + arrow | moves within the product |
| `external ↗` | text + arrow | leaves the product |
| `quiet` | text | reversible, secondary |
| `destructive` | text, caution ink | confirms inside the sheet, never in place |
| `on-photo` | glass | over photography |

**Two primaries on one screen means the screen is wrong.** (Art. 15.5.)

---

## 10 · Spacing rhythm

8pt grid, with named rhythm — the names carry meaning that numbers do not.

| Token | px | Meaning |
|---|---|---|
| `--st-hair` | 4 | glyph to its label |
| `--st-breath` | 8 | inside a chip |
| `--st-line` | 12 | between lines of a group |
| `--st-gap` | 16 | between elements |
| `--st-inset` | 24 | **the page gutter — the only one** |
| `--st-rest` | 48 | between sections |
| `--st-movement` | 96 | between acts |

### Laws

1. **`--st-inset` is the only horizontal page gutter.** Nothing else touches the screen edge except the hero and full-bleed photography.
2. **Vertical rhythm escalates, never alternates.** Within a section: `line`. Between sections: `rest`. Between acts: `movement`. A section that uses `gap` where its neighbour uses `rest` reads as a mistake even when nobody can say why.
3. **Radius:** `--st-r-chip` 12 · `--st-r-card` 16 · `--st-r-sheet` 24 · `--st-r-stage` 32 · `--st-r-pill` 999. One radius per component; never mixed within one object.

---

## 11 · Empty-state philosophy

> **Absence renders as silence or invitation — never as an empty-state card.** (Art. 15.7.)

| Situation | Render |
|---|---|
| Nothing is happening | **nothing.** The space collapses. No "all caught up" card. |
| A thing could exist but doesn't | one quiet invitation, **once**, in one place |
| A thing is genuinely absent from history | say nothing — never a greyed placeholder implying it should be there |

**Three concrete rulings:**

- **No-photo hero** → the lit marque monument (§1), filling the frame, with *"Photographed at your first visit."*
- **Empty garage** → the invitation *is* the whole screen. Not a card on an otherwise-populated Home.
- **Historical visits with four of seven stages** → render four. Showing three greyed nodes implies work was skipped that probably wasn't — a fabricated claim about the past, and Art. 1.6 forbids it.

**Never:** an illustration of an empty box. A shrug. A "Nothing here yet!" with an exclamation mark.

---

## 12 · Loading philosophy

> **A surface only ever renders against real data — but a returning customer never waits for what we already know.**

| State | Render |
|---|---|
| Cold, nothing cached | one calm breath — the mark, dim, no spinner |
| Warm, cache present | **the cached truth immediately**, revalidated silently behind it |
| A single object loading inside a live surface | its own skeleton at the correct size — never a full-screen fallback |
| A mutation in flight | the spinner lives **inside the pressed button**, nowhere else |
| Failed, nothing cached | a human sentence, Retry, and a way to reach the studio |
| Failed, cache present | **keep the cached surface**, add one quiet line |

### Laws

1. **The only spinner in the product is inside a pressed button.** Everywhere else, a skeleton at the true size, or a calm hold.
2. **A loading state must be distinguishable from a not-found state.** The audit found the Chapter rendering *"That chapter isn't in this garage"* while its data was still loading — a false negative on every cold deep link.
3. **Never tear down truth to show a loading state.** A revalidation failure keeps what is on screen.

---

## 13 · Interaction feedback

Every touch is answered within one frame.

| Element | Response |
|---|---|
| Chrome (nav, chips, icon buttons) | `scale 0.96`, `--st-tick` |
| Cards, state cards | `scale 0.98`, `--st-tick` |
| Full-width actions | `scale 0.99`, `--st-tick` |
| Draggable (sheets, viewer) | follows the finger — **spring**, never ease |
| Disabled | never silently inert; say why, in one line |

### Laws

1. **Nothing is inert.** An element that looks tappable and does nothing is a defect. The audit found two Desk rows calling `router.replace('/app')` — closing the sheet and doing nothing.
2. **Every mutation produces a visible success moment.** Booking, rescheduling, joining, adding a car. Today none of them do — the sheet simply closes, which reads as the app forgetting.
3. **Destructive actions confirm inside the sheet**, never in a system dialog, never in place.
4. **Focus is always visible.** Inline styles cannot express `:focus-visible`; that is a reason to use a class, not a reason to skip the state.

---

## 14 · Sound & haptics *(future — specified now so it is not retrofitted)*

Silence is the default. Sound is earned, and only at the two moments that matter.

| Moment | Haptic | Sound |
|---|---|---|
| The car is ready | one soft impact | one warm, short tone — the only sound in the product |
| A visit seals | one soft impact | — |
| Tap, scroll, sheet, navigation | none | none |

**Laws:** never more than one sound per session. Respect the silent switch, always. No sound may be required to understand anything. If sound ships and the product feels *busier*, it has failed and comes out.

---

## 15 · Full-screen vs card

The question that decides most layouts.

### It deserves full-screen when

- It is **the car** — hero, immersive viewer.
- It is **happening now** and the owner would watch it — the live visit.
- It is a **record worth keeping** — a sealed Chapter reads as an editorial spread, not a receipt.
- It is a **single decision** the whole screen exists to serve — onboarding, a confirmation.

### It deserves a card when

- It is **one of several peers** — protection states, quick actions.
- It is **glanceable** — a state, a count, a date.
- It is **a summary that opens into something larger.**

### It deserves neither when

- It is a **list of internal records.** That is a CRM, and it is banned (Art. 15.6).
- It exists because **the data exists**, not because the owner asked a question.

> **The test:** would the owner *stop* and look at it? Full-screen. Would they *check* it? Card. Would they only find it if they went looking? It belongs in **You**, or nowhere.

---

## 16 · The review checklist

A screen may be implemented only when every answer is yes.

**Constitution**
1. Does it answer one of the six questions (Art. 19)?
2. Is it a view of an object, or a page pretending to be one?
3. Does it belong clearly to Garage, Studio, or You?
4. Is any individual named? *(Must be no.)*
5. Is any document, ID or internal status shown raw? *(Must be no.)*
6. Is anything faked? *(Must be no.)*

**Design Language**
7. One hero, one Display, at most one primary action?
8. Every fixed element positioned off `--st-stack-bottom`; content padded to `--st-content-floor`?
9. Every glass surface carrying `--st-edge`, and no glass nested in glass?
10. Elevation taken from the band, not chosen?
11. Does the content render fully with all animation disabled?
12. Every tap target ≥ 44px?
13. Loading distinguishable from empty distinguishable from failed?
14. Does every mutation produce a visible success moment?
15. Does absence render as silence or invitation — never as an empty-state card?
16. Finger-driven motion on the spring, system-driven on the ease?

---

## 17 · Implementation order

Immersive surfaces first, so the rest of the product **inherits** the language rather than being redesigned into it later.

| # | Surface | Establishes |
|---|---|---|
| 1 | **Home** (Garage) | `HeroVehicle`, the hero motions, the state chip row, the stacking contract, the nav |
| 2 | **Visit** (live takeover + sealed Chapter) | `MomentStage`, stage rendering, the takeover pattern, the success moment |
| 3 | **Garage** (vehicles, photo set, hotspots, Media) | the immersive viewer, `MomentEntry`, capture |
| 4 | **Profile** (You) | `Field`, settings without a settings aesthetic |
| 5 | **Shared components — extraction** | `HeroVehicle`, `StateCard`, `Action`, `Chip` formalised out of 1–4 |
| 6 | **Remaining flows** (Book, Studio, Journey index) | inherit everything above |

> **Step 5 is a scheduled task, not a hope.** Components built inside Home and Visit must be *extracted* — the failure mode of design-led sequencing is that the third screen copies the first instead of reusing it. The gate on step 5: no component definition exists in more than one file.

### Hard prerequisites before step 1

Home cannot be built first in the *absolute* sense — three Phase 1 items gate it, and skipping them means building Home twice:

| Prerequisite | Why |
|---|---|
| **The de-naming pass** (Phase 1.2) | Home renders state and transformation. Built before this, it copies the byline pattern the actor law forbids. |
| **The stacking contract** (Phase 1.6) | Home introduces the new nav. Built before this, it repeats the collision the audit measured. |
| **Stored `Protection`** (Phase 1.1) | Home's state chips *are* protections. Built on the recompute bug, every chip is a promise the catalogue can silently rewrite. |

Everything else in Phase 1 — payments, auth, location keys, the Visit migration — can proceed in parallel with Home.
