# AutoModz - Customer Experience V3 Reboot
## Product Audit & Vision (from the approved V2 foundation)

**Baseline:** commit `efe03db` - "CX-2: My Garage - every vehicle becomes a passport."
Everything after it (`a3168be`…`a3ed6bf`, the exploratory "CX V3 Phases 0–5") is out of scope and considered discarded. This document audits V2 as it actually is and proposes V3 from first principles.

**No code was modified to produce this document.**

---

# 1 · IA Audit

Every customer-facing route at V2:

| Route | Purpose today | Verdict | Why |
|---|---|---|---|
| `/` | Public homepage (LC1 photo-hero, 10 sections) | **Keep** | Recently rebuilt, honest, on-brand. Only entry-point polish needed. |
| `/auth/login` | Google sign-in | **Keep** | Fine. Should feel like a threshold, not a form. |
| `/dashboard` | Home: greeting, 3-stat row, membership gauges, service grid, booking lists | **Replace** | It's a dashboard. The car isn't the subject; numbers are. |
| `/dashboard/booking` | 6-step wizard (Vehicle → Service → Schedule → Review → Payment → Done), 1,085 lines | **Replace** | Longest file in the customer app; a form marathon, not a decision flow. |
| `/dashboard/history` | Filterable booking list + status sheet + cancel/reschedule + 7-dot timeline | **Merge → split** | Conflates two different things: *live tracking* (an experience) and *the past* (a record). They deserve opposite treatments. |
| `/dashboard/vehicles` | Garage: vehicle cards + vehicle sheet + add/edit sheet | **Replace (promote)** | Right instinct ("passport"), wrong altitude - it's a CRUD list with a detail sheet. In V3 the vehicle *is* the app's centre, not a sub-page. |
| `/dashboard/subscriptions` | Membership: plans, UPI/cash payment, wash-count bars | **Keep, redesign** | Real revenue feature. Currently reads as a pricing table + payment form. |
| `/dashboard/profile` | Stats row, links to garage/history/notifications, edit form, WhatsApp/maps | **Merge** | Half of it duplicates Home's stats and nav. Shrink to identity + settings. |
| `/dashboard/notifications` | Notification list | **Merge** | A standalone inbox is CRM furniture. Fold into activity on Home / booking detail. |
| `/dashboard/offers` | Offers list | **Merge** | Offers with no context are spam. Surface them where they apply (booking, membership). |
| `/dashboard/refer` | Referral page | **Merge** | One card inside Profile/Club, not a route. |
| `/dashboard/cars` | Used-car listings (auth'd copy) | **Delete** | Near-duplicate of `/cars`. One canonical marketplace surface. |
| `/cars`, `/cars/[id]` | Public used-car marketplace | **Keep** | Real business line. Keep public; link from app. |
| `/dashboard/sell-car` | Sell-my-car form | **Keep (demote)** | Reachable from marketplace + garage, not a nav destination. |
| `/store` | Merch/products | **Keep (park)** | Separate always-dark surface per store convention; not part of the ownership loop. |
| `/invoice/[id]` | Shareable invoice + rating | **Keep** | Good artifact. Should mature into the "care record" document. |
| `/offline`, `/not-found`, `/error` | System pages | **Keep** | Fine. |

**IA summary:** 13 authenticated destinations collapse to **4**: Home (the car), Care (book + track + record), Club (membership + referral + offers), You (profile + settings). Everything else is a sheet, a card, or a link.

---

# 2 · UX Audit (screen by screen)

### `/dashboard` - Home
- **Solves:** orientation - "what's my status?"
- **Emotion it creates:** *accounting.* The first render is a greeting, a bell, and a 3-up stat grid (SERVICES / VEHICLES / SPENT). Telling a customer how much they've spent, in the header, every day, is a CRM instinct.
- **Broken:** the car - the emotional object - appears nowhere above the fold. Membership renders as twin gauges (instrument-cluster metaphor for a *subscription counter*). Service grid is a catalogue pitch to someone who already converted.
- **Disappears:** stat row, gauge cluster, service-catalogue grid, bell icon.
- **Becomes:** the customer's actual car, photographed, full-bleed, with one line of state ("Protected · Ceramic, 212 days left" / "In studio · polishing") and one contextual action.

### `/dashboard/booking` - Booking
- **Solves:** scheduling a service.
- **Emotion:** *paperwork.* Six labelled steps with a progress header and a Next button - a government form with nicer shadows.
- **Broken:** 1,085 lines of intertwined state (`step`, `data`, `bookedSlots`, `fullDates`, `membership`, `discount`…). Step 0 asks which vehicle even when the customer has one. Payment (UPI txn-id entry) sits inside the same wizard as service choice - decision and transaction glued together.
- **Disappears:** the stepper, the Review screen (review should be implicit in a summary card), the "Done" step as a page.
- **Becomes:** one decision per screen, defaults pre-answered (their car, their usual service, next open slot), and a confirmation that starts the care story - not a receipt.

### `/dashboard/history` - History + Tracking
- **Solves:** two problems at once - "where is my car right now?" and "what have I done before?"
- **Emotion:** *admin queue.* Filter chips (`All / Upcoming / Active / Cancelled`) are an operator's mental model, not an owner's. Live progress is a row of 7 dots inside a list card.
- **Broken:** the single most emotional moment AutoModz owns - *my car is inside the studio* - is rendered at the same visual weight as a cancelled booking from March.
- **Disappears:** filter chips, the status-badge taxonomy on customer surfaces, the dot strip.
- **Becomes:** live care gets its own full-screen experience (see Vision); the past becomes the car's story on its passport, not a list of transactions.

### `/dashboard/vehicles` - Garage
- **Solves:** managing vehicles.
- **Emotion:** *inventory.* Category/colour pickers, add/edit sheets - the customer maintains records for us.
- **Broken:** the passport idea is present in comments but not in the experience; the "car's story" is a sheet, capped at 88vh, dismissed with a swipe.
- **Becomes:** the Vehicle Passport as a primary full-screen surface - photo, protection state, care history, documents, value. Add/edit stays as a sheet but is a one-time onboarding, not a recurring chore.

### `/dashboard/subscriptions` - Membership
- **Solves:** selling and servicing wash plans.
- **Emotion:** *pricing page + bank form.* Four internal views (`dashboard | plans | payment | done`) inside one component; UPI transaction-ID entry is the climax of joining a "club."
- **Broken:** membership has no ongoing experience - after purchase it's a progress bar of washes used. No privileges, no recognition, no reason to feel *inside* anything.
- **Becomes:** Club - a membership card (Apple-Wallet-grade object), benefits as lived moments ("your wash on Thursday is covered"), renewal as a quiet nudge, referral folded in.

### `/dashboard/profile` - Profile
- **Solves:** identity + settings + escape hatch to WhatsApp/Maps.
- **Broken:** re-renders the same 3 stats as Home, then a link-list to pages the bottom nav already reaches. Two navigation systems to the same places.
- **Becomes:** small. Name, phone, sign-out, install-app, contact. One screen, no stats.

### `/dashboard/notifications`, `/offers`, `/refer`
Three list pages, three headers, three empty states - for content that is contextual by nature. All three dissolve into the surfaces where they mean something.

### `/cars` + `/dashboard/cars`
Same listings rendered twice with different chrome. The authenticated copy exists only so the bottom-nav had a fifth idea at some point. One surface, saved-cars state carried by auth.

---

# 3 · Design Audit - what still feels like business software

**Typography.** Three families (display / body / mono) is right, but mono is used as a *labelling system*: `SERVICES`, `LOADING SYSTEM`, `0.10em`-tracked micro-caps everywhere. Tracked mono caps on every card label is terminal aesthetics - ops-room, not lounge. Sizes are hardcoded inline (`fontSize: '9px'`, `'10px'`, `'11px'`, `'13px'`, `'20px'`, `'26px'`) with no scale; per-page drift is guaranteed.

**Spacing.** No system. `px-4 pt-14 pb-6`, `px-5 pt-6`, `p-3`, `gap-2.5` chosen per page. Cards touch different edge insets on Home vs Garage vs History.

**Hierarchy.** Numbers outrank photography. Home leads with stats; Garage leads with a list; History leads with filters. In a premium product the object leads, then state, then action - controls last. V2 is controls-first almost everywhere.

**Motion.** Multiple dialects: `stagger()` helpers redefined per page, a bespoke `EASE = [0.22,1,0.36,1]` in Garage, `duration: 0.2` fades in the layout, `animate-ember-pulse` on the book button, Lenis smooth-scroll on the homepage only, `vaul` installed but sheets hand-rolled with `motion.div fixed bottom-0`. There is no single motion language - every page has an accent.

**Photography.** Excellent on the homepage (LC1), nearly absent inside the app. The customer's own car is never photographed by the product; MEDIA service images are stock-style category tiles. The single biggest design gap.

**Cards.** At least four card idioms: `.card` class, inline `background: var(--cavern); border: 1px solid var(--border)`, `rounded-xl` vs `rounded-2xl` vs `rounded-3xl`, StatCard component. Same content, different skins.

**Buttons.** `GradientButton`, `.btn-ghost`, inline-styled `motion.button`s, `SlideToAction` - four button languages.

**Bottom navigation.** The raised centre "+" book button is food-delivery grammar. It says *the app's job is to make you transact.* An ownership product's nav names places, not actions.

**Sheets.** Vehicle sheet, add/edit sheet, history detail sheet, confirm dialog - each a hand-rolled `AnimatePresence + fixed bottom-0` with its own backdrop, radius, max-height, and scroll behaviour. `vaul` sits in package.json unused. This is the clearest "no sheet system" symptom.

**Forms.** Raw labelled inputs with `data-label` mono captions - admin-panel form language, used for emotional acts (adding your car).

**Tracking.** Seven statuses (`pending → confirmed → vehicle_received → in_progress → quality_check → ready_for_delivery → completed`) exposed to the customer verbatim via `getStatusLabel`, with `getStatusColor` badge classes. Internal state machine leaking straight into customer copy.

**History / Membership / Garage / Profile / Booking** - covered above; the shared pattern is: **list + filter + badge + sheet**, i.e., the admin board's grammar reused on customers.

**A note on theme:** project memory says customer surfaces are light-first grey/white ("Studio White", globals.css v9), yet the V2 app shell runs on `--void` near-black with dark aliases. V3 must resolve this deliberately - one answer, applied everywhere (recommendation in §7).

---

# 4 · Technical Audit - what should disappear

**Duplicate surfaces**
- `/dashboard/cars` vs `/cars` - same listings, two pages.
- Profile stats block ≡ Home stats block (computed twice from the same store).
- Membership state fetched independently on Home (`getUserSubscription`) and Subscriptions page - two loaders, two spinners, no shared cache.

**Duplicate patterns (should be one primitive each)**
- **Sheets:** ≥4 hand-rolled bottom sheets (Garage ×2, History detail, ConfirmDialog) + unused `vaul`.
- **Staggers/eases:** `stagger()` redefined in Home; `EASE` const in Garage; ad-hoc `transition` objects everywhere.
- **Status timeline:** dot-strip rendered in History list *and* History sheet with different colour logic (`--ember` vs `--silver`).
- **Currency compaction:** the `₹…L / ₹…K` ternary appears in Home and Profile as copy-pasted logic - belongs in `formatCurrency`.
- **Empty states:** bespoke per page despite `EmptyState.tsx` existing.

**Dead / questionable weight**
- `vaul` - installed, unused (V2 tree).
- `react-intersection-observer` - homepage-era; verify usage, likely removable.
- `lenis` - homepage only; must not leak into the app shell.
- `CountUp`, `StatCard`, `GaugeRing` - stat-dashboard primitives; V3 deletes the dashboards, so these die with them.
- `CommandPalette` - admin primitive; confirm it is never imported on customer surfaces (role-visibility law).
- Legacy token aliases: the entire `--ember-*` alias layer over `--accent-*` and dual naming (`--void`/`--bg`) - one name per token, delete the aliases.
- `docs/` still carries pre-reboot plans (`MASTER_PLAN.md`, `UPGRADE_PLAN.md`, `INFORMATION-ARCHITECTURE.md`) that no longer describe the product - mark superseded or delete.

**Structural debt**
- `booking/page.tsx` (1,085 lines) and `subscriptions/page.tsx` (732 lines) are multi-screen state machines inside single components - untestable, unreusable.
- Inline `style={{}}` typography on nearly every text node - the design system exists as CSS variables but not as components, so every page re-implements it slightly differently.
- Customer status vocabulary imported from `lib/utils` ops helpers (`getStatusStep/Label/Color`) - customer copy and ops states need a translation layer, not shared functions.

---

# 5 · Experience Audit - the journey and its emotional gaps

**Arrival.** Homepage is cinematic; login is functional; then `/dashboard` opens on statistics. *Gap: the product's first authenticated frame demotes you from "owner of a beautiful car" to "account holder."*

**Booking.** Six steps, ending in a payment form and a confirmation page. *Gap: no sense of occasion. Booking premium car care should feel like reserving a table at a place that knows you - instead it feels like filing.*

**Waiting (before the visit).** Nothing. No preparation, no anticipation, no "we're ready for the AMG on Thursday." *Gap: dead air between confirmation and drop-off - the cheapest place to create delight and reduce no-shows.*

**Vehicle inside the studio.** The peak moment. Today: a list item in History with 7 dots. *Gap: this is Domino's-Tracker territory and V2 treats it as a table row. No photos from the floor, no "what we found," no craftsman presence, no notion of care happening to *your* car.*

**Collection.** Status flips to `ready_for_delivery`, then `completed`. *Gap: no handover ritual - no before/after (the `BeforeAfterSlider` exists and is unused here), no summary of work, no "next due." The invoice page is the closest thing to a keepsake and it's framed as billing.*

**Ownership (between visits).** The app has no reason to be opened. *Gap: this is the entire thesis. Protection expiry, wash cadence, the car's accumulating story - none of it surfaces. The product only exists at transaction time.*

**Repeat visit.** Booking starts from zero every time - pick vehicle, pick service, pick slot. *Gap: zero memory. A regular should be one tap: "Same as always, Thursday 10am?"*

**Membership.** Purchase via UPI-txn-ID form, then a wash counter. *Gap: no belonging. No card, no recognition at the studio, no member moments.*

**Emotional arc summary:** V2 spends all its craft on *acquisition* (homepage) and *administration* (dashboard), and none on *possession* - the phase where the customer actually lives.

---

# 6 · Competitive Benchmark (interaction quality, not visuals)

**Apple Wallet.** A pass is an *object*, not a record: one glanceable state, updates itself, appears when relevant. → V2's membership is a page you visit; V3's membership must be a card you *hold*. Same for the vehicle: passport-as-object.

**Uber.** One decision per screen; everything else defaulted; state changes narrated live ("Your driver is arriving"). Never shows you its dispatch state machine. → V2's booking shows all six decisions and its raw status enum. V3: defaults + narration ("Arjun has started polishing").

**Airbnb.** Anticipation design: the time between booking and arrival is programmed (itinerary, host message, "your trip is coming up"). → V2 has literally nothing between confirm and drop-off.

**Domino's Tracker.** Proves that watching a mundane process is *entertainment* when it's named, staged, and human ("Carlos is making your pizza"). → The studio floor is far more cinematic than a pizza oven, and V2 renders it as 7 grey dots.

**Porsche / Rivian / Tesla apps.** The app opens on *your* car - rendered, current, alive. Controls are secondary; the vehicle's state is the interface. Service is framed as care for the machine, not orders against an account. → This is V3's Home, exactly.

**The shared lesson:** all six products put **one object with live state** at the centre and translate internal machinery into **human narration**. V2 puts *lists of records* at the centre and exposes machinery raw.

---

# 7 · Vision - Customer Experience V3

> **The car is the product. The app is its companion.**
> Every screen answers one owner question. Photography first, content second, controls last.

## 7.1 Structure - four places, no dashboard

Bottom navigation: **Car · Care · Club · You** (flat, four tabs, no raised action button - booking is reached *through the car*, because you book care *for* it).

### CAR (home)
Opens on the customer's vehicle, full-bleed. One photograph (customer-uploaded; upgraded over time with studio-shot photos captured at visits - the studio becomes the source of the car's best portraits). Below the image, exactly three lines:
1. **State** - "Protected · Ceramic coat, healthy" / "Care due · last wash 34 days ago" / "In studio · being polished now" (live).
2. **Next** - the single most relevant action, defaulted: "Book your usual wash - Thu 10:00 free."
3. **Story** - entry to the passport.

The **Vehicle Passport** (full-screen push, not a sheet): the car's photographic timeline, every service as a chapter (date, work, craftsman, before/after where captured), active protections with real expiries, documents (invoices reframed as *care records*), and - since AutoModz also sells cars - an optional "value & sell" chapter linking the marketplace. Multi-car owners swipe between passports; add-a-car is a one-time sheet, never a management screen.

### CARE (book · live · handover)
Three modes of one surface, chosen by state - never shown as tabs:

- **Book** (no active visit): a conversation, not a wizard. Card 1: "The [car]?" (pre-answered). Card 2: service - the usual first, alternatives behind it. Card 3: a slot - next available highlighted. Confirm. Payment intent is captured, transaction happens at the studio or via Club coverage; the UPI-txn form leaves the critical path entirely. Under 20 seconds for a repeat customer.
- **Live** (visit active): the app's hero. Full-screen care experience: a staged narrative mapped from the 7 ops statuses into 4 human moments - **Received → In care → Final checks → Ready** - each with copy naming the work and the person ("Deepak is hand-finishing the hood"), floor photos when the studio posts them, and honest time expectations. This is the screen customers show friends.
- **Handover** (ready/just completed): the ritual. Before/after slider, the work summary, the craftsman's note, the care record saved to the passport, next-due seeded ("ceramic top-up recommended in March"). Rating asked once, here, in context.

The past lives in the passport, not in a filterable History list. Cancel/reschedule are quiet actions inside the booking card.

### CLUB (membership · privileges · referral)
Membership becomes an object: a full-width member card (name, tier, member-since) that would be at home in Apple Wallet - and eventually *is* a Wallet pass. Below it: privileges as lived facts ("Thursday's wash is covered - 5 left this cycle"), renewal as one line when it matters, offers only when applicable to *you*, and referral as a single card ("A friend's first detail, on us"). Joining: choose tier → pay at studio or UPI → pending state is honest and warm. No `dashboard|plans|payment|done` machine.

### YOU
One quiet screen: identity, phone, notification preferences, install app, WhatsApp/visit-us, sign out. No stats, no link farm.

### Outside the tabs
- `/cars` marketplace stays public; the app links to it from the passport's value chapter. `/dashboard/cars` is deleted. `/sell-car` reachable from both.
- `/store` stays parked as its own dark surface.
- `/invoice/[id]` restyled as the shareable **Care Record**.

## 7.2 The one design system

- **Theme:** resolve the light/dark contradiction: **customer surfaces go Studio White** (light-first, grey/white, graphite ink) per the standing identity; admin/store remain always-dark ops. The car's photography does the drama; the chrome stays gallery-quiet.
- **Typography:** one modular scale (11/13/15/17/22/28/34), display for headlines, body for everything else, mono demoted to *data only* (plates, VINs, dates) - never labels.
- **Spacing:** 4-pt grid, one page inset (20px), one card radius (20px), one gap scale.
- **Components:** exactly one Button (3 variants), one Card, one Sheet (vaul-based, one radius, one backdrop, one drag behaviour), one EmptyState, one Field. Everything inline-styled today gets replaced or deleted.
- **Motion:** one ease (`[0.22,1,0.36,1]`), three durations (120/240/420ms), one page transition, one sheet transition, one stagger. No pulses, no glows, no per-page dialects. Lenis stays on the marketing homepage only.
- **Status language:** ops statuses never reach customer copy; a single translation layer maps 7 internal states → 4 narrated moments.

## 7.3 What gets deleted outright
Bottom-nav "+" button · Home stat grid & gauges · History filter chips & badges · notification/offers/refer routes · `/dashboard/cars` · `StatCard`, `GaugeRing`, `CountUp` · the `--ember-*` alias layer · all hand-rolled sheets · per-page stagger/ease definitions · the 6-step wizard · the `view` state machines in Subscriptions.

## 7.4 Honesty constraints
Everything derives from real Firestore data: real bookings, real protections (derived from completed services + their warranty durations), real membership state, real photos. Where data doesn't exist yet (floor photos, craftsman names), the design degrades gracefully - the moment still narrates, just without the photo - it never fakes.

## 7.5 Suggested build order (after approval)
1. **System** - tokens (Studio White), Button/Card/Sheet/Field, motion constants, status-translation layer.
2. **Shell** - 4-tab nav, route collapse, deletions.
3. **Car** - home + Vehicle Passport.
4. **Care** - book flow, then Live, then Handover.
5. **Club** - member card + join flow + referral fold-in.
6. **You + Care Record** - profile shrink, invoice restyle, final sweep for dead code.

---

*End of audit. Awaiting approval before any implementation.*
