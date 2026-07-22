# CUSTOMER EXPERIENCE V3 - FINAL BLUEPRINT
### The constitution for the AutoModz ownership platform

**Status:** awaiting approval. No code exists against this document.
**Supersedes:** `CX-V3-REBOOT-AUDIT.md` §7 (the four-tab vision is revoked by Revisions 2–8).
**Baseline for implementation:** V2 tree (`efe03db`). Everything after it is discarded.

---

## 1 · Product Philosophy

AutoModz is not an app the customer uses. It is a **relationship the customer owns** - with their car, and with the studio that cares for it.

Three sentences govern every decision:

1. **The car is the product.** Not bookings, not services, not the studio. The customer's own vehicle, photographed and alive.
2. **Every screen answers "what is happening with my car?"** - never "which feature do you want?" If a screen requires the customer to choose a feature before it means anything, the screen is wrong.
3. **Ownership is daily; booking is occasional.** A customer books 4–10 times a year and owns their car every day. The product is built for the 355 days between visits, and booking is a 20-second gesture inside it.

The feeling to build: *Instagram meets Apple Wallet* - large photography, minimal chrome, information layered over imagery, one precious object always at the centre. Closer to a passport than a portal.

**The anti-goals** (each one a firing offence in review): dashboards, statistics for their own sake, filter chips, status badges, feature grids, list-of-records screens, any surface that would look at home in a CRM.

---

## 2 · Information Architecture

### 2.1 From features to concepts

The IA is not built from features (History, Garage, Membership, Tracker, Profile). It is built from six concepts, and the UI emerges from them:

| Concept | Meaning | Where it lives |
|---|---|---|
| **Ownership** | This is *my* car, and this platform knows it | The Car - the root and only permanent surface |
| **Care** | What is being done, has been done, and is due for the car | The Now layer + Care Takeover + Chapters |
| **Protection** | What shields the car right now (coatings, PPF, plans - later insurance, warranty) | The Protection layer |
| **Memories** | The car's accumulating photographic story | The Memories layer + Chapter pages |
| **Identity** | The car's papers and facts (plate, VIN, documents - later RC, insurance docs) | Inside the Car, below the fold |
| **Relationship** | The bond with AutoModz: membership, recognition, concierge, referral | The Relationship layer + Concierge thread |

Note what is absent: "Booking" is not a concept. It is a *verb* inside Care.

### 2.2 The structural idea: one scroll, not many screens

The entire product is **one vertical narrative - the Car** - plus state-driven takeovers and sheets. There is no hub-and-spoke, because there is no hub to leave: the car is both the home and the content.

```
THE CAR  (root - the only permanent screen)
│  vertical scroll = depth into ownership
│
├── Portrait        (full-bleed photograph + one line of truth)
├── Now             (current care / next care - collapses to nothing when idle)
├── Protection      (what shields the car, with honest expiries)
├── Memories        (photographic timeline of every visit)
├── Identity        (plate · VIN · documents · value)
└── Relationship    (member card · concierge · refer)

← horizontal swipe on Portrait = other cars (garage as a gesture, not a screen)

TAKEOVER:  Live Care        (auto-presents while the car is in the studio)
PUSH:      Chapter          (one visit's full story - the shareable care record)
SHEETS:    Book · Join Club · You · Add Car · Reschedule/Cancel
```

Four navigable surfaces. Five sheets. Nothing else.

### 2.3 What this kills - explicitly (Revision 8)

- **Home disappears.** There is no home screen. The Car *is* home. A separate home would only summarize the car - a summary of the thing you're already looking at.
- **Garage disappears.** Multiple cars are a horizontal swipe on the portrait, with a page indicator. A list of your own cars is inventory management; swiping between them is ownership. Add-a-car is a sheet at the end of the swipe.
- **History disappears.** The past is the Memories layer - photographs first, facts second. A filterable list of transactions has no reason to exist when every visit is a chapter in the car's story.
- **Tracker (as a page) disappears.** Live care is not a destination you navigate to; it is a state the product enters. When the car is in the studio, the product transforms.
- **Membership (as a page) disappears.** The member card lives in the Relationship layer; joining is a sheet; privileges appear where they apply ("Thursday's wash is covered"). A membership *section* is a pricing page wearing a lanyard.
- **Profile disappears.** A "You" sheet (name, phone, notification preferences, install, sign out) opens from a quiet avatar. Settings are maintenance, not a place.
- **Notifications / Offers / Refer (as pages) never exist.** Notifications become the Concierge thread and OS pushes. Offers appear only attached to the thing they discount. Referral is one card in Relationship.
- **Booking becomes a sheet.** Stated plainly: the six-step wizard is deleted and replaced by a bottom sheet with at most three pre-answered questions. Booking is the *least* important thing the product does well.
- **`/dashboard/cars` is deleted**; the used-car marketplace stays public at `/cars`, linked from Identity ("value & sell"). `/store` remains a separate parked surface. `/invoice/[id]` becomes the public share target of a Chapter.

### 2.4 Why each surviving screen deserves to exist (Revision 8, inverse)

- **The Car** - because ownership needs exactly one canonical place, and merging anything *into* it is the whole design. It cannot merge upward; it is the top.
- **Live Care takeover** - because a time-critical, emotionally peaked, minutes-granular narrative cannot share a scroll with a passport. It is the same *place* (the car) in a different *state* - a transformation, not a second screen. If it were a section of the scroll it would be either too small during the visit or dead weight the other 355 days.
- **Chapter** - because a completed visit is a document: shareable, permanent, addressable (it *is* the invoice/care-record URL). Sheets are transient; documents deserve a page. Merging chapters into the timeline would cap their depth at a thumbnail.
- **Onboarding** - because the first session must produce a photographed car before the root screen can exist. It runs once, then never again. (It is the Add Car sheet wearing a welcome.)
- Every sheet earns its place by being a *task with an end* (book, join, edit) - tasks end, so their UI must dismiss. Anything without an end state is a layer of the Car, not a sheet.

The test applied throughout: **a screen exists only if it is (a) a different state of the car, or (b) a document. Everything else is a layer or a sheet.**

---

## 3 · Navigation Model

**There is no tab bar.** From first principles:

- Tabs exist to switch between peers. This product has no peers - it has one object with depth. Tabs would manufacture destinations and re-create feature thinking.
- **Primary navigation is scroll** (depth into ownership) and **swipe** (between cars).
- **Secondary navigation is state**: the product itself moves you (Live Care presents when the visit starts; Handover presents when the car is ready). The best navigation is the kind the customer never performs.
- **Tertiary navigation is two persistent quiet controls**, floating over the portrait, no bar behind them:
  - top-right: **avatar** → You sheet.
  - bottom-centre: the **Concierge capsule** - a slim floating pill that always shows the single most relevant line and action: idle → "Book care · Thu 10:00 free"; booked → "Thursday 10:00 · confirmed"; live → "In care · polishing now" (tap = takeover); ready → "Ready for collection". The capsule is the product's heartbeat and its only global control. It is adaptive navigation: one control whose meaning follows the car's state.
- **Within the scroll**, layer headers act as landmarks; a long-press on the capsule offers direct jumps (Protection, Memories, Relationship) for power users. No visible menu.
- **Back** is always down (sheets) or left-edge (pushes). Nothing is ever more than one gesture from the car.

Screens with no navigation at all: Live Care (only a collapse-down gesture) and Onboarding (forward only). Full-bleed moments earn full-bleed chrome.

---

## 4 · Screen Map (buildable spec)

### 4.1 THE CAR - root

**Portrait.** Full-bleed photograph, ~92vh. Customer's photo at first; replaced over time by studio-shot portraits captured at visits (the studio becomes the car's photographer - a service differentiator that costs one phone photo per visit). Gradient scrim bottom 30% only. Overlaid, bottom-left, three text lines maximum:
- Name line: "Mercedes-AMG C 43" (display type, large).
- Truth line - one sentence of current state, chosen by priority: in studio > ready > booked > protection expiring ≤ 30 days > care due > protected. Never two.
- The Concierge capsule floats beneath.
Swipe horizontally for other cars; final page is "Add a car" (quiet, centered, no card).

**Now.** Exists only when it has something true to say. Booked: date, service, one-line prep note, reschedule/cancel as text links. Care due: "Last washed 34 days ago" + capsule action. Idle and healthy: **this layer renders nothing** - absence is the design.

**Protection.** Each active protection as a full-width photographic band (detail shot of *that car's* coated panel when available; typographic band when not): "Ceramic coat · applied Mar 2026 · healthy · 212 days". Expired/expiring states are honest and calm, with one action. This layer is architected as a *registry* (see §17): today it holds coatings/PPF/wash plans; tomorrow insurance and warranty slot in as new protection types with zero structural change.

**Memories.** The car's story as photography: a vertical rhythm of full-width images (best shot per visit), date + work as a caption. Tap → Chapter. Interleaved rare "milestone" entries (car added, membership joined, 1 year with AutoModz). No thumbnails-in-a-grid; this is a photo essay, not a gallery app.

**Identity.** The quietest layer. Plate and VIN in mono, documents as a simple stack (care records today; RC/insurance/PUC later), "estimate value · sell" linking `/cars` flow. Edit via sheet.

**Relationship.** The member card as a physical-feeling object (tier, name, member since; non-members see a single invitation line - not a pitch grid). Privileges as facts. Referral as one line. "Message the studio" opens the Concierge thread (WhatsApp deep-link at launch; native thread later). Ends with the AutoModz mark and address - the signature at the bottom of the letter.

### 4.2 LIVE CARE - takeover state

Presents automatically (with a soft transition from the portrait) when status enters the live band; collapsible down to the capsule; re-expands from it.
- The screen is a **stage**: full-bleed floor photo or the car's portrait dimmed, with the current moment narrated in large type.
- Internal 7-state machine maps to four human moments - **Received → In care → Final checks → Ready** - via a single translation layer (`careMoment(status)`); ops vocabulary never reaches the customer.
- Each moment: one sentence naming the work and, when staff data exists, the person ("Deepak is hand-finishing the hood"). Progress is shown as the moment sequence, not percentages or dot strips.
- Studio floor photos appear as they're posted, timestamped, building the visit's chapter in real time.
- **Ready** becomes Handover: before/after slider, work summary, craftsman note, amount (settled or due at desk), collection details. On completion the takeover dissolves into the new Chapter with a single continuous animation - the visit literally *becomes* a memory.
- Rating: asked once, on the Chapter, within 24h, one tap + optional line. Never a modal ambush.

### 4.3 CHAPTER - the care record (push page)

One visit, permanently. Hero photo, date, the work performed (in human language), photos from the floor, before/after, craftsman, amount, protections applied (with their expiry - linking back to the Protection layer), and share. The public share URL is the restyled `/invoice/[id]` - one document, two audiences (owner sees more; recipient sees the beautiful record). This *is* the invoice; billing language is demoted to a line item.

### 4.4 ONBOARDING - once

Welcome (one screen, the brand's voice) → name confirmation → add your car (make/model/year/plate - 4 fields, one screen) → **photograph it** ("Take a photo of your car. It becomes your home screen.") → done, landing on the Portrait they just created. If they skip the photo, a dignified typographic portrait (model name, large, on graphite) holds the frame and the capsule offers "Add a photo" - never a broken-image placeholder.

### 4.5 SHEETS (one sheet system, all vaul-based)

- **Book** - three stacked questions, pre-answered: this car → the usual service (alternatives behind "something else") → next open slot (calendar behind "another time"). One confirm. Payment is *intent only* (pay at studio / covered by Club / UPI later); no transaction forms in the critical path. Target: repeat booking in under 20 seconds and under 4 taps.
- **Join Club** - tier choice (cards, swipeable) → how to pay (at studio / UPI with clear pending state) → member card animates into Relationship.
- **You** - identity, phone, notification preferences (see §14), install app, sign out.
- **Add / Edit Car** - the onboarding car form, reused verbatim.
- **Adjust visit** - reschedule/cancel, calm, no guilt copy.

---

## 5 · User Journeys (the six that matter)

1. **First open** - Login → onboarding → their own car fills the screen with their name under it. Time to "this is mine": under 2 minutes. The first frame after onboarding must never be empty; the photo they just took guarantees it.
2. **Daily glance** (the 355-day journey) - open → portrait → truth line → close. Three seconds, zero taps. The product succeeds when this glance is worth doing: the truth line must always be *true and current* (protection countdowns, care cadence, booked state).
3. **Booking** - capsule tap → Book sheet → confirm. The Now layer materialises with the visit; a prep note arrives the evening before ("We're ready for the C 43 tomorrow at 10"). Anticipation is programmed, not left to chance.
4. **The visit** - drop-off → Live Care presents itself → moments advance with narration and floor photos → Ready → Handover ritual → chapter created → next-due seeded. The customer should *want* to open the app during the visit; this screen is the growth engine (it gets shown to friends).
5. **Collection + afterglow** - chapter shared or not, rating given once, protection layer updated with anything applied. A week later, one concierge line if relevant ("The ceramic needs its first maintenance wash within 3 weeks - shall we?").
6. **Renewal / repeat** - membership ending or care due surfaces as the truth line + capsule action, one tap into the pre-filled sheet. The product remembers everything: their car, their usual, their slot habits.

---

## 6 · Motion Philosophy

One sentence: **motion is state changing, never decoration.**

- One easing curve everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Three durations: **120ms** (micro: press, toggle), **280ms** (element: sheet, layer reveal), **480ms** (scene: takeover present/dismiss, chapter dissolve).
- One entrance rule: content is visible immediately; scroll-linked reveals may add opacity/8px-rise on layer boundaries only, `once: true`, no stagger choreography.
- Sheets: one spring (vaul default tuned once), one backdrop (40% graphite blur), one drag-to-dismiss.
- The two signature moves (the only "designed" animations allowed):
  1. **Takeover breath** - portrait scales 1.00→1.04 and dims as Live Care presents (480ms).
  2. **Visit → Memory dissolve** - Handover's hero photo travels into its position atop the Memories layer (480ms shared-element).
- Banned: pulses, glows, shimmer-on-everything, parallax inside the product (Lenis stays on the marketing homepage only), looping animation of any kind, per-page dialects.
- Reduced-motion: all scene transitions become cross-fades; nothing is information-bearing through motion alone.

---

## 7 · Design Language

**Theme:** Studio White. Customer surfaces are light-first - paper white, warm greys, graphite ink - per the standing brand identity. The photography carries all drama; the chrome is a gallery wall. (Admin and `/store` remain always-dark; the boundary is absolute.)

- **Surfaces:** `paper #FAFAF8` (page), `gallery #F2F2F0` (recessed), `graphite #16181A` (ink, and the surface for photographic overlays/Live Care), plus the scrim gradient. That's the entire surface palette.
- **Borders: almost none.** Separation comes from whitespace, type scale, and photography. Hairline (`1px, 8% graphite`) is permitted only on: the member card edge, input underlines, and sheet grab-handles. No outlined cards, no bordered chips.
- **Cards: almost none.** The only literal card in the product is the member card (deliberately object-like). Everything else is typography and imagery in open space.
- **Elevation:** one soft shadow, used only by sheets and the member card.
- **Color accents: none.** State is communicated in language and tone ("healthy", "due", "expiring"), with graphite/grey weight shifts. Semantic colour exists only as a last-resort pair (success/danger) inside sheets for irreversible confirms.
- **Radius:** one value, 24px, sheets and photographs only.
- **Spacing:** 4pt grid. Page inset 24px. Layer gap 96px (layers must breathe like magazine spreads). Text block gap 12px. These four numbers are the whole spacing system.

## 8 · Photography Language

Photography is the interface, so it gets its own law:

- **Sources**, in ascending quality: customer upload → studio portrait (shot at each visit: ¾ front, natural light, consistent height) → detail shots (panels, coatings) → floor photos (live, candid, honest).
- **Treatment:** no filters, no duotones, no overlays except the bottom scrim (graphite, 0→55%, bottom 30%). Never place text over the middle of a photograph.
- **Aspect discipline:** Portrait 4:5 minimum height 92vh; Memories full-width natural aspect capped 4:3; Protection bands 21:9; Chapter hero 3:2.
- **The studio's obligation:** every visit produces at least one portrait and one detail shot. This is a product requirement, not a nicety - the Memories layer and the truth of the app depend on it. (Ops-side capture flow is an admin feature to be scheduled in the roadmap.)
- **Degradation:** missing photography degrades to typographic treatments on graphite - model name set large, chapter as a typeset record. Elegant absence, never grey placeholder boxes, never stock images of other cars.

## 9 · Typography Language

- **Two families in the product:** the display face for the car's name, moments, and chapter titles; the text face for everything else. The mono face is demoted to *data glyphs only* - plate, VIN, dates, amounts - never labels, never tracked-caps section headers.
- **One scale:** 12 / 14 / 16 / 19 / 24 / 32 / 44 (display use ≥ 24 only). Line-height 1.45 text, 1.1 display.
- **Case law:** sentence case everywhere. ALL-CAPS is reserved for the plate itself. The V2 habit of mono tracked micro-caps labels (`SERVICES`, `SPENT`) is abolished.
- **Ink:** graphite at 100 / 62 / 38% opacities - three text colours, no more. On photography: paper-white at 100 / 70%.
- Implemented once as text components (`<Display>`, `<Body>`, `<Data>`, `<Whisper>`); raw `fontSize` inline styles are banned in review.

## 10 · Component Language

The entire product is built from **eleven components**; a twelfth requires amending this document:

`Portrait` · `TruthLine` · `Capsule` (the concierge pill) · `Layer` (section wrapper: header + 96px rhythm) · `PhotoBand` · `MemoryEntry` · `MomentStage` (Live Care) · `MemberCard` · `Sheet` · `Field` (underline input) · `Action` (the one button: filled-graphite / ghost / destructive-text).

Deleted from V2 and never rebuilt: StatCard, GaugeRing, CountUp, GradientButton, SlideToAction, StatusChip, PageHeader, EmptyState-as-component (see §12), CommandPalette (admin only), all bespoke sheets.

## 11 · Interaction Language

- **Tap** acts; **long-press** offers (capsule jump-menu; photo → save/share); **swipe horizontal** moves between cars; **swipe down** dismisses; **scroll** is the primary navigation.
- One control per decision on screen at a time. If a screen needs two primary buttons, the screen is wrong.
- Destructive acts (cancel visit, remove car): sheet confirm with plain language - no "Are you sure?" double-negatives, no red panic. "Cancel Thursday's visit" / "Keep it".
- Every touch target ≥ 44px; press feedback is the 120ms scale-to-0.97, nothing else.
- Haptics (PWA-permitting): one soft tick on moment changes in Live Care and on booking confirm. Nowhere else.

## 12 · Empty States

Doctrine: **an empty state is either an invitation or it is silence.**

- Empty layers render *nothing* - Now, Protection with no protections, and Relationship extras simply don't occupy space. No "Nothing here yet" cards. The scroll gets shorter; that's honest.
- The two legitimate invitations, written in the concierge voice:
  - No photo: typographic portrait + "Add a photo of your car - it becomes your home screen."
  - No visits yet: Memories opens with "The C 43's story starts with its first visit." + capsule.
- The marketplace/`/cars` and Club invitation lines follow the same one-sentence pattern. No illustrations, no sad icons.

## 13 · Loading States

- **First paint:** the portrait loads progressively (tiny blurred inline placeholder → full image). Text renders instantly from cache (zustand persists last-known car + truth line); the app opens on *yesterday's truth* and silently corrects, rather than on a spinner.
- Layers below the fold load lazily; no skeleton theatre - content appears in its final typography, images fade in over 280ms.
- The only spinner permitted in the product is inside a pressed `Action` (14px, inline). Full-screen "LOADING SYSTEM" screens are abolished; the auth gate shows the wordmark on paper, nothing animated.
- Failures degrade to cached truth + one whisper line ("Offline - last updated 7:40 pm"), never an error card.

## 14 · Notification Philosophy

Notifications are **the concierge speaking, rarely and personally** - never the system emitting events.

- Hard budget: a customer receives at most ~2 pushes per week outside live visits.
- Allowed: visit-eve prep note · live-care moment changes (Received / Ready always; In-care photo drops optional, user-controlled) · handover/chapter ready · protection expiring (once at 30 days, once at 7) · membership renewal (once) · care-cadence nudge (at most monthly).
- Banned: marketing blasts, generic offers, "we miss you", anything not about *their* car.
- Every push deep-links to the exact state (Live Care, Chapter, Book sheet pre-filled).
- In-app, there is no inbox. The capsule + truth line *are* the notification surface; history of concierge messages lives in the (future) thread.
- Preferences in the You sheet are plain sentences with switches: "Message me while my car is in care."

## 15 · Concierge Voice & Copywriting Rules

The product speaks as **one person: a calm, expert studio host.** Not a brand, not a system.

- Always about *the car by name*: "The C 43 is ready." - never "Your booking #1042 status has been updated."
- Sentence case, short declaratives, no exclamation marks, at most one per screen-moment.
- First person plural for the studio ("We've started on the interior"), second person for the customer, the car referred to by model name.
- Numbers are honest and specific ("212 days of coating left"), never gamified ("87% protected!").
- Never: "features", "dashboard", "manage", "submit", "transaction", "error occurred", emoji, urgency tricks, guilt ("don't miss out").
- Ops vocabulary is quarantined behind the translation layer; the words `pending`, `in_progress`, `quality_check` must never render on a customer surface.
- Hindi-adjacent warmth is welcome in marketing, but product copy stays neutral-international; currency is ₹ with Indian grouping.

## 16 · Data Honesty (constitutional constraint)

Everything renders from real Firestore data: real bookings, real photos, protections *derived* from completed services + warranty durations, real membership state. No fabricated activity, no fake reviews, no placeholder chapters, no invented craftsman names - absence degrades per §8/§12. If the studio hasn't posted a photo, the moment narrates without one.

## 17 · Future Scalability - the Vehicle OS roadmap

The architecture grows into a vehicle operating system without new top-level structure, because the six concepts are already the OS's schema. **Nothing below is built now**; the contract is that adding it later changes *data*, not *architecture*:

- **Protection registry** - a protection is `{type, source, appliedOn, expiresOn, evidence}`. Today: ceramic, PPF, wash plans. Later rows: **insurance** (policy = a protection with a renewal), **warranty**, AMC. The Protection layer renders any row; renewal notifications reuse the same expiry engine.
- **Identity vault** - a document is `{kind, file, expiry?}`. Today: care records. Later: RC, insurance papers, PUC - with the same expiry engine surfacing "PUC expires in 12 days" as a truth line.
- **Care graph** - a chapter is `{work[], photos[], amounts, protections applied, odometer?}`. Adding odometer at visits unlocks **maintenance reminders**, **tyre/fluid cadence**, and a genuine **digital service history** - which directly powers **resale** (`/cars` listing generated from the passport: verified history is the differentiator no marketplace has).
- **Relationship channel** - the concierge capsule/thread is the rail for **fuel partnerships, accessories, tyre replacement offers** - always framed as care for *this car*, never as a store. (`/store` merch remains separate.)
- **Multi-studio** - the studio is already an implicit party on every chapter; a `studioId` field scales the same product to locations.
- Sequencing principle for all of it: a new capability ships only when it can be *true* (real data source) and *quiet* (fits the truth-line/layer grammar). Anything needing a new tab is by definition wrong.

## 18 · Implementation Roadmap (post-approval)

Each phase ships as one commit-series, leaves the app releasable, and deletes its legacy counterpart in the same phase - never keep two generations alive.

- **Phase 0 - Constitution in code.** Studio White tokens (final, no aliases); the 11 components; motion constants; `careMoment()` translation layer; text components. Delete: GradientButton, StatCard, GaugeRing, CountUp, SlideToAction, StatusChip, bespoke sheets, `--ember-*` aliases. *Gate: a styleguide route renders all 11 components; zero inline fontSize in new code.*
- **Phase 1 - The Car (root) + navigation model.** Portrait, TruthLine, Capsule, multi-car swipe, layer skeleton (Now/Protection/Memories/Identity/Relationship with real data), avatar → You sheet. Delete: `/dashboard` home, bottom nav, profile page, notifications/offers/refer routes, `/dashboard/cars`. *Gate: daily-glance journey works in 3s from cold start.*
- **Phase 2 - Book sheet + Now layer.** The three-question sheet, prep-note scheduling, adjust-visit sheet. Delete: the 1,085-line wizard. *Gate: repeat booking ≤ 4 taps, ≤ 20s.*
- **Phase 3 - Live Care + Handover.** Takeover, four moments, floor photos, handover ritual, chapter creation, the two signature animations. Delete: history page tracker UI. *Gate: full visit simulated end-to-end with the dev shim; ops statuses never visible.*
- **Phase 4 - Memories + Chapter + care record.** Timeline, chapter page, share URL absorbing `/invoice/[id]`, rating-in-context. Delete: history route entirely. *Gate: a past V2 booking renders as a dignified chapter (data migration for existing bookings).*
- **Phase 5 - Protection + Identity.** Registry rendering, expiry engine + its two notifications, documents stack, value/sell link to `/cars`. *Gate: a completed ceramic service auto-creates its protection row.*
- **Phase 6 - Relationship + Club.** MemberCard, join sheet, privileges-as-facts, referral line, concierge deep-link. Delete: subscriptions page. *Gate: join → pending → active loop verified with admin.*
- **Phase 7 - Onboarding + polish.** First-run flow, photo capture, empty/loading doctrine sweep, reduced-motion audit, notification budget wiring, performance pass (portrait LCP < 2.5s on 4G). Delete: any remaining V2 customer code; `docs/` superseded plans marked.
- **Ops enablement (parallel, admin-side):** floor-photo capture flow + moment advancement in the studio board; visit portrait capture prompt at handover. Without this, Phases 3–4 run in degraded (photo-less) mode - acceptable, but the studio habit is what makes the product sing.

Definition of done for V3 overall: a customer with one car, one membership, and one visit in progress can experience journeys 1–6 of §5 with zero screens outside this document, and `grep` finds no surviving import of any deleted component.

---

*This document is the constitution. Deviations require editing this file first. Awaiting approval - no implementation has begun.*
