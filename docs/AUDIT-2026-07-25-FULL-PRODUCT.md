# AutoModz — Complete Product Audit

> **§16 (Prioritised Roadmap) is SUPERSEDED (2026-07-25).** The owner reframed the goal after this audit — from a detailing app to **AutoModz OS, the digital home for your car** — and ratified four decisions that change what gets built and in what order. The live plan is the AutoModz OS build plan; the constitutional consequences are recorded in `docs/AUTOMODZ-CUSTOMER-PRODUCT-CONSTITUTION.md` (2026-07-25 amendments), with mechanism in `VISIT-OBJECT.md`, `AUTOMODZ-OS-IA.md`, `AUTOMODZ-LIVING-STATES.md` and `JOURNEY-STAGES.md`.
>
> **§1–§15 stand**, with three exceptions the reframe supersedes:
> - **B5 / B6** (bottom-stack collision, 31px dock targets) — the component fixes die with the new five-entrance nav. The *token contract* (`--st-stack-bottom`, `--st-content-floor`) survives and must land first.
> - **B2** (in-app notification inbox) — dropped. *Never show documents, show living states* generalises to alerts; the Garage state chips are the inbox. Notification **delivery** still has to be built.
> - **B22** (dead code in `app/app/page.tsx`) — moot; the file is replaced, not cleaned.
>
> Everything else in the defect register is live, and three findings became *more* urgent under the new direction: **B1** (discounts never applied — the new Book flow would overcharge members on day one), **B7** (the 2:49 am ETA — the most-read sentence in the product), and **B12** (content gated behind an entrance animation — systemic once motion is central to the Garage).

**Date:** 25 July 2026
**Scope:** the whole product — customer app (`/app`), marketing site, staff/admin OS, data model, API, rules, automations, design system, performance, growth.
**Method:** full source read (183 TS/TSX files, 24,637 LOC in `app/ components/ lib/ context/`), production build measurement, and a live walkthrough of every customer surface via the dev-auth shim at 375×812. Every claim below is anchored to a file, a measurement, or a screenshot. Nothing is inferred where it could be checked.
**Stance:** this was audited as if a rival team had built it. Prior decisions — including ones recorded as "ratified" — are treated as hypotheses, not law.

---

## 0 · One-paragraph verdict

AutoModz has an unusually good **spine** and an unfinished **body**. The derivation engines (`lib/os/*`, `lib/cx/protection.ts`) are the best code in the repo: pure, tested, and genuinely opinionated — `ownershipState()` deciding what leads the screen is a real product idea that Tesla and Rivian do not have. The Stay (`/app/visit/[id]`) and the Chapter (`/app/chapter/[id]`) are, visually, at the benchmark. But the product **has shipped its views without shipping its object model**: 5 of the 9 objects its own constitution declares load-bearing (Party, Moment, Thread, Studio, Signal) do not exist in `lib/types.ts` at all. Beneath the surface, three revenue systems are wired to nothing — **promotions and membership discounts never apply to a customer booking**, **the referral loop has no share button**, and **in-app notifications are hardcoded to zero** — and the flagship screen has four fixed layers colliding at the bottom of a 375px viewport. The gap is not taste. It is completion.

---

# 1 · Executive Summary

### What this is today
A **single-studio operations system with a beautiful customer skin on top.** The centre of gravity is `/admin` — 27 pages, 5,946 LOC, covering jobs, bays, attendance, payroll, inventory with recipes, expenses, daily cash closing, receivables, quotes, promos, used-car listings and a walk-in kiosk. That half is complete, coherent, and clearly built by someone who runs the business. The customer half is one screen (`/app`), three sub-surfaces (welcome, visit, chapter), and five sheets.

### What it is trying to become
`docs/AUTOMODZ-CUSTOMER-PRODUCT-CONSTITUTION.md` is explicit and, in my judgement, correct: *the customer does not use an app; they own relationships — with a vehicle, with the people who care for it, with the story both accumulate.* Nine permanent objects. Three mental models ("my car", "my studio", "right now"). Built for the 355 days between visits.

### Where they differ — the five gaps that matter

| # | Gap | Evidence |
|---|---|---|
| **1** | **The object model was never built.** `Moment`, `Party`, `Thread`, `Studio`, `Signal` appear in no type, collection or rule. `MomentEntry.tsx` exists but is rendered only in `/styleguide`. Without Moment there is no memory; without Thread there is no conversation (it's a `wa.me` link); without Party there is no family, no fleet, no craftsman-as-object. | `lib/types.ts`, `grep -rn "interface Moment\|Party\|Thread"` → none |
| **2** | **Money doesn't flow.** No payment gateway anywhere. Membership = create a `pending` doc and wait for the owner to eyeball a UPI screenshot. And the discount engine (`computeBestDiscount`) is called **only from the staff kiosk** — a Gold member booking in-app pays full price while the same member walking in gets 15% off. | `lib/services/pricing.ts` used only by `components/intake/WalkInFlow.tsx:85` |
| **3** | **The 355 days are empty.** Between visits the app shows: a hero, two pills, one card, two buttons, an address. No documents, no expenses, no reminders, no insurance/PUC/FASTag, no vehicle health, no timeline of life. There is no reason to open it. | `/app` full innerText, verified live |
| **4** | **Three growth systems are dark.** In-app notifications: `const unreadCount = 0` and `getUserNotifications` is never called from any customer surface — the daily retention cron writes into a collection nobody reads. Referrals: `shareReferral()` is dead code with no caller. Quotes: `requestQuote()` has zero call sites. | `app/app/page.tsx:506`, `:333`; `grep -rn "requestQuote" app components` → none |
| **5** | **The flagship screen is broken at 375px.** Four fixed layers overlap; the primary CTA is covered on first run; dock tap targets are 31px wide. | measured in-browser, §4 |

### The five things I would do first
1. **Apply discounts at booking.** ~40 lines. Directly recovers member value and makes every promo and referral real. *(P0)*
2. **Fix the bottom-of-screen collision + dock geometry.** ~1 day. The first impression is currently a pile-up. *(P0)*
3. **Fix the "Planned finish around 2:49 am" bug.** The single most-read sentence in the product is currently absurd. *(P0)*
4. **Build `Moment` and `Record`, and give the customer a Documents surface.** This is the 355-day product. *(P1)*
5. **Add phone/OTP auth.** Google-only sign-in is an activation tax in Maninagar. *(P1)*

---

# 2 · Complete Product Audit — Architecture Map

## 2.1 Route inventory (every route, verified)

```
PUBLIC / MARKETING
  /                          Homepage (LC1 photo hero, 12.5 kB / 327 kB FLJS)
  /cars                      Used-car listings (public read)
  /cars/[id]                 Listing detail + inquiry/viewing lead form
  /invoice/[id]?t=           Public token-gated invoice (legacy destination)
  /chapter/[id]?t=           Public token-gated Chapter (money-free projection)
  /offline                   PWA offline fallback
  /styleguide                Design gallery — SHIPS TO PRODUCTION, unguarded ⚠
  /auth/login                The door. Google OAuth only.

CUSTOMER PRODUCT  (layout: app/app/layout.tsx — auth guard + boot lifecycle)
  /app                       The Glance / Home V2       ← 18.3 kB / 355 kB FLJS
    ?sheet=desk              The studio / Conversation
    ?sheet=arrange           Arrange a visit (&cat= prefill)
    ?sheet=manage            Reschedule / cancel
    ?sheet=you               Profile + notification prefs
    ?sheet=join-club         Membership purchase
    ?sheet=car-form          Add / edit car (&car-id=)
    ?focus=protection        Protection panel
  /app/welcome               3-moment onboarding (welcome → you → car)
  /app/visit/[id]            The Stay (live visit takeover)
  /app/chapter/[id]          The Chapter (owner's record of a finished visit)
  /dashboard/sell-car        Orphan: sell-your-car form, no entry point in /app ⚠

STAFF / ADMIN OS  (27 pages, 5,946 LOC)
  /admin                     Board (752 LOC) · ⌘K palette
  /admin/bookings /[id]      Approval queue + workspace
  /admin/jobs/[id]           Job workspace
  /admin/schedule            Capacity / calendar (461 LOC)
  /admin/walkin              Kiosk intake
  /admin/customers /[id]     CRM 360
  /admin/vehicles/[reg]      Vehicle history by registration
  /admin/employees /[id]     Roster, PIN, salary
  /admin/attendance          Check-in/out, breaks, corrections, CSV
  /admin/inventory /recipes  Stock + per-service consumption recipes
  /admin/expenses            Expense ledger
  /admin/close               Daily cash closing + variance
  /admin/invoices            Invoice list + receivables
  /admin/reports             Reporting
  /admin/subscriptions       Membership verification/activation
  /admin/promos              Promo authoring
  /admin/quotes              Quote pipeline
  /admin/cars /leads         Used-car inventory + leads
  /admin/gallery             Public gallery
  /admin/office              Tasks / follow-ups
  /admin/settings            Studio config
  /store                     Kiosk PIN pad (employee unlock)

API  (10 routes — all Next route handlers, no separate backend)
  POST /api/availability            auth: any signed-in
  GET  /api/cron/daily              auth: CRON_SECRET bearer
  POST /api/employee/link           auth: self (admin SDK promotes)
  GET  /api/invoice/[id]?t=         auth: publicToken (+ ?view=chapter projection)
  POST /api/membership/deduct-wash  auth: self, or staff with forUserId
  POST /api/notify/event            auth: self + document-ownership check
  POST /api/push/send               auth: admin only
  POST /api/referral/claim          auth: self
  POST /api/retention/run           auth: admin only
  POST /api/whatsapp/send           auth: admin only; no-ops without env
  GET  /firebase-messaging-sw.js    service worker shim

REDIRECTS (next.config.js) — 9 legacy customer routes, 6 legacy staff routes
```

## 2.2 State machine — the whole customer lifecycle

The product's real architecture is not routes, it's **one state machine that reorganises one screen.** This is `lib/os/ownership.ts` and it is genuinely good.

```
                       vehicleCount == 0 ──────────────► new
                              │
   live visit? ──► careAct == 'ready' ──► ready        (collect it)
              └──► otherwise ──────────► in_studio     (watch it)
   declined/no-show within 14d ───────► declined       (a note from the studio)
   agreed|proposed visit ─────────────► booked         (manage it)
   club grace|lapsed ─────────────────► membership_attention
   protection waning|expiring ────────► warranty_expiring
   0 completed ───────────────────────► unvisited
   ≥90 days since last ───────────────► dormant
   any active protection ─────────────► protected
   else ──────────────────────────────► settled
```

Each state emits a module `order[]` (status/protection/documents/activity/ownership/studio). **The order is computed and then thrown away** — `HomeV2` has a fixed composition and ignores `own.order` entirely. `ModuleKey` is imported in `app/app/page.tsx:32` and never used. The best idea in the codebase is currently inert.

## 2.3 Visit lifecycle — dual-record model

```
Booking (commercial truth)          Job (operational truth)
  pending      →  proposed            checked_in        → received
  confirmed    →  agreed              in_progress       → in_care
  vehicle_received → received         quality_check     → final_checks
  in_progress  → in_care              ready_for_delivery→ ready
  quality_check→ final_checks         completed
  ready_for_delivery → ready          cancelled
  completed    →  archived
  cancelled    →  cancelled
```
`lib/os/visit.ts` is the translation boundary and it holds cleanly: ops vocabulary never renders under `/app`. The 1:1 Booking↔Job link (`booking.jobId` / `job.bookingId`) is deliberate and correct — commercial and operational truth genuinely are different records.

**Defect:** `ACT_ORDER` has five acts but only four have ops statuses. `looked_over` is **unreachable** — no `BookingStatus` or `JobStatus` maps to it (`lib/os/visit.ts:careAct`, `actFromJobStatus`). The Stay's progress rail therefore always shows one node that can never be "current", and the fill jumps 2 steps at once from Received to In care. Either add an ops status for inspection, or delete the act.

## 2.4 State coverage matrix

| Surface | Loading | Empty | Error | Offline | Success |
|---|---|---|---|---|---|
| App shell | ✅ `StudioLoading` | ✅ preserves cache | ✅ `StudioError` + retry, distinguishes offline vs outage | ✅ `OfflineBar` | ✅ `bootReveal` |
| `/app` Home | ✅ (shell) | ✅ `AddCarInvitation` | ✅ `app/app/error.tsx` | ⚠️ stale, no staleness marker | ⚠️ **no success moment after booking** — sheet just closes |
| Arrange sheet | ✅ button spinner | ✅ "No room that day" | ✅ inline copy | ✅ pre-flight guard | ❌ **no confirmation screen** |
| Manage sheet | ✅ | ✅ "no visit to change" | ✅ | ✅ | ❌ silent close |
| Join Club | ✅ | — | ✅ | ✅ | ⚠️ closes to Home; pending state only implied |
| The Stay | ⚠️ **animation-gated** | ✅ "not in this garage" | ✅ | ✅ store-cached | ✅ `StayReveal` — the one real success moment |
| Chapter | ❌ **none** — renders "not in this garage" while jobs/invoice load | ✅ | ✅ | ✅ | n/a |
| Desk | n/a | ✅ search empty state | ✅ | ⚠️ | n/a |
| Car form | ✅ | ✅ | ⚠️ | ✅ | ⚠️ closes silently |

**Two structural holes:**
- **Chapter has a false-negative empty state.** `app/app/chapter/[id]/page.tsx` renders *"That chapter isn't in this garage"* whenever `booking` is missing from the store — which includes the entire window before `getJobsForCustomer` and `getInvoice` resolve, and any cold deep-link. A shared Chapter link opened on a cold app will show "not found" and then pop into existence. Needs a `loading` state distinct from `not found`.
- **The Stay's content is gated behind a framer entrance.** `<motion.main initial={{opacity:0}}>`. If the animation never runs — throttled rAF, a JS hiccup, an old device — the customer sees a black screen where their car should be. I reproduced exactly this in-browser (screenshot: fully legible content rendered at ~2% opacity). Content must never depend on an animation completing; animate a wrapper, not the payload.

---

# 3 · Feature Matrix

Legend — **Impl:** ●full ◐partial ○stub ✗absent

| Domain | Feature | Impl | Purpose | Where | Gap / Issue | Pri |
|---|---|---|---|---|---|---|
| **Garage** | Multiple vehicles | ● | Horizontal pager, session-remembered | `HomeV2`, `store.session.selectedVehicleId` | No vehicle *list* view; pager only | P2 |
| | Car photos + gallery | ● | Cover + ordered gallery, drag-reorder | `VehiclePhotos.tsx` | Great work | — |
| | Add/edit car | ● | | `CarForm.tsx` | Dock slot labelled "Garage" opens this form ⚠ | P0 |
| | Delete car | ◐ | | `deleteVehicle` in lib | No UI path found in `/app` | P2 |
| | VIN / make / model / year | ✗ | | | `category`/`color` marked legacy; no structured identity | P1 |
| | Odometer | ✗ | | | Constitution reserves `Signal`; nothing built | P1 |
| **Booking** | Arrange a visit | ● | 3 questions, category-grouped menu | `ArrangeSheet` | **No discount applied** ⚠⚠ | P0 |
| | Availability | ● | Resource-aware, server-computed | `/api/availability`, `lib/availability.ts` | **Fails open** → shows all slots free on API error | P0 |
| | Reschedule / cancel | ● | | `ManageVisitSheet` | Cancel has no reason capture | P2 |
| | Pickup & drop | ○ | Fields exist, hardcoded `false` | `Booking.pickupRequired` | Priced (₹50/leg) but **unreachable in the app** | P1 |
| | Server-side slot lock | ✗ | | `createBooking` writes direct | Double-booking possible; admin approval is the only backstop | P1 |
| | Quote request (PPF/Ceramic) | ○ | Service + rules exist | `requestQuote()` | **Zero call sites.** High-ticket work has no consult path | P1 |
| | Success confirmation | ✗ | | | Sheet closes. No receipt, no calendar add, no "we've got it" | P0 |
| **Membership** | Club model | ● | active/grace/lapsed/pending, honest cadence line | `lib/os/club.ts` | Excellent — `cadenceLine()` is a genuinely premium touch | — |
| | Join / rejoin | ● | | `JoinClub.tsx` | No online payment; owner must verify manually | P1 |
| | Wash deduction | ● | Transactional, server-side | `/api/membership/deduct-wash` | Correct | — |
| | % off other services | ✗ | Silver 10 / Gold 15 / Platinum 20 | `membershipDiscountPct` | **Never applied to a customer booking** ⚠⚠ | P0 |
| | Plans catalogue | ◐ | Hardcoded in `lib/types.ts:651` | | Owner cannot change price/perks without a deploy | P1 |
| | Upgrade / downgrade | ✗ | | | No path between tiers | P2 |
| | Auto-renew | ✗ | | | Every cycle is a manual repurchase | P1 |
| **Visit / Live** | The Stay | ● | Acts, studio's own notes, craftsman, photos | `/app/visit/[id]`, `lib/os/stay.ts` | Best surface in the product | — |
| | ETA line | ◐ | | `timingLine()` | **Ignores business hours → "finish around 2:49 am"** ⚠ | P0 |
| | Act rail | ◐ | 5 acts | `MomentStage.tsx` | `looked_over` unreachable; labels clip at 375px | P1 |
| | Live photos from floor | ● | before/during/after | `Job.photos` | No push when a new photo lands | P1 |
| | Approve extra work mid-visit | ✗ | | | Detailer finds swirls → no in-app approval | P1 |
| **History** | Chapter (record of a visit) | ● | Editorial spread, evidence, promise, receipt | `/app/chapter/[id]` | Beautiful | — |
| | Public share of a Chapter | ● | Money-free projection | `/api/invoice/[id]?view=chapter` | Well designed | — |
| | Story / filmstrip on Home | ✗ | | `StoryFilm` in `page.tsx:750` | **88 lines of dead code — never rendered** | P1 |
| | Before/after slider | ◐ | | `BeforeAfterSlider.tsx` | Not used in Chapter or Stay | P2 |
| **Profile** | Name / phone | ● | | `YouSheet` | | — |
| | Notification prefs | ● | 5 toggle pills, honoured by retention | `runRetentionForUser` | Good | — |
| | Sign out | ● | Full session wipe | `clearSession` | Correct on shared devices | — |
| | Install PWA | ◐ | `beforeinstallprompt` | | iOS never fires this — no A2HS instructions | P2 |
| | Delete account / export data | ✗ | | | DPDP Act 2023 exposure | P1 |
| **Notifications** | Web push | ● | FCM, token pruning | `/api/push/send`, `lib/services/push.ts` | Only admin can trigger sends | P1 |
| | In-app inbox | ✗ | | `unreadCount = 0` | **`notifications` collection is written and never read by a customer** ⚠⚠ | P0 |
| | Concierge log | ● | Derived timeline in the Desk | `lib/os/log.ts` | Good idea — but it's derived, so retention notices never appear in it | P1 |
| | WhatsApp | ◐ | `wa.me` deep links; Cloud API stub | `/api/whatsapp/send` | Off unless env set; no templates | P1 |
| **Payments** | Any online payment | ✗ | | | Cash/UPI-manual only, admin-verified | P1 |
| | Invoice archive | ◐ | Per-chapter only | | No "all my papers" surface | P0 |
| | Payment status visibility | ◐ | On the Chapter | | No "you owe ₹X" anywhere in `/app` | P1 |
| **Referral** | Claim inbound `?ref=` | ● | Server-side, dual promo | `/api/referral/claim` | Works | — |
| | **Share your code** | ✗ | | `shareReferral()` at `page.tsx:333` | **Dead function, no caller. The loop cannot start.** ⚠⚠ | P0 |
| | Referral status / earnings | ✗ | `getMyReferrals` exists | | No UI | P1 |
| | Code uniqueness | ✗ | Client-written to own user doc | `getMyReferralCode` | No constraint — codes can collide/be hijacked | P1 |
| **Documents** | Any document store | ✗ | | | No RC, insurance, PUC, warranty card, PPF certificate | P0 |
| | Desk → "Papers & records" | ✗ | | `page.tsx:312` | **`router.replace('/app')` — a no-op. Dead row.** | P0 |
| **Support** | WhatsApp / call / directions | ● | | `HomeV2` studio card | | — |
| | In-app thread | ✗ | Constitution's `Thread` object | | Every conversation leaves the product | P1 |
| **Store (used cars)** | Public listings + leads | ● | | `/cars`, `/cars/[id]` | Solid | — |
| | Sell your car | ◐ | | `/dashboard/sell-car` | **Orphan — no link from `/app`** | P2 |
| | Saved cars | ◐ | Rules + service exist | `users/{id}/savedCars` | No UI | P2 |
| **Studio (ops)** | Job board, bays, kiosk | ● | | `/admin`, `/store` | Complete and good | — |
| | Attendance / payroll | ● | Breaks, geo meta, corrections, CSV | | Complete | — |
| | Inventory + recipes | ● | Per-service consumption | | Complete | — |
| | Daily closing / variance | ● | | `/admin/close` | Complete | — |
| **Community / Concierge** | Anything | ✗ | | | Not started | P3 |

---

# 4 · UX Audit — the first-time journey, tap by tap

Walked live at 375×812 as a first-time customer.

### 4.1 The door → home

| # | Action | What happens | Verdict |
|---|---|---|---|
| 1 | Land on `/app` | Redirect → `/auth/login?redirect=/app` | ✅ deep link preserved |
| 2 | See the door | "Your studio" · one Google button | ✅ calm. ❌ **Google-only.** No phone/OTP, no email. In Maninagar this is a real drop-off — the customer base is phone-first. |
| 3 | Sign in | Popup → `ensureUserProfile` → `linkEmployeeRole` → `/app/welcome` | ⚠️ `signInWithPopup` is blocked by default in in-app browsers (Instagram, WhatsApp) — the two places a detailing studio's links get opened. Needs `signInWithRedirect` fallback. |
| 4 | Welcome: "Welcome." | Chrome-swept display type | ✅ genuinely premium |
| 5 | Tap "Begin" → "You" | Name + phone | ⚠️ Phone is optional and unvalidated; it's the field the whole retention system depends on. |
| 6 | "That's me" → car form | Name, reg, photo | ✅ right sequence — the car is the product |
| 7 | Save → `/app` | | ⚠️ **No arrival moment.** The car appears; nothing marks it. This is the single best opportunity for delight in the product and it's spent. |

### 4.2 Home — measured, not eyeballed

Measured with `getBoundingClientRect()` at 375×812:

```
CoachMark   y 630 → 732   (z 49)
Capsule     y 682 → 734   (z 50)   ← overlaps CoachMark by 50px
Dock        y 732 → 802   (z 60)   ← overlaps Capsule by 2px
HomeV2 content padding-bottom = 78 + 48 = 126px, but the stack reaches 182px
```

**Four fixed layers in 172 vertical pixels, three of them overlapping.** On first run the Priority Card's CTA ("Follow the visit" — the only action on screen) is covered by the CoachMark, which is itself covered by the Capsule. Screenshot confirms text-on-text.

Root cause: three components each own their own `bottom` offset independently — `Dock` `safe+10`, `Capsule` `safe + var(--st-dock-clear,78px)`, `CoachMark` `safe+80px` hardcoded. There is no shared stacking contract.

**Dock geometry, measured:**
```
bar width 351px
  Home    x  19  w 31
  Garage  x  50  w 31
  [mark]  x  88  w 199   ← 57% of the entire navigation bar
  Visits  x 293  w 31
  Profile x 325  w 31
```
Four navigation targets at **31px wide** (Apple HIG minimum 44, Material 48). Labels "Garage"/"Profile"/"Visits" are wider than their boxes and visually collide ("VisitsProfile" renders as one word). The wordmark pedestal — decoration — takes more room than all four functions combined.

**The "Garage" slot doesn't go to a garage.** `Dock.tsx:61` → `/app?sheet=car-form` with no `car-id`, i.e. **the blank add-a-car form.** A returning owner tapping "Garage" is asked to add a car they already have. This is the worst single interaction in the product.

**Also on Home:**
- Hero is 52vh. With no photo it is 190,000 px² of near-black holding a small plate. The empty state of the product's centrepiece is a void, not a designed absence.
- Status pills are 38px tall — under the touch minimum.
- The bell is decorative: `unread` is hardcoded `0` and tapping it opens the Desk. A bell that can never ring is worse than no bell.
- Only two quick actions ever render (`quickActions.slice(0,2)`), and one of them is "Edit details" — a settings task promoted to primary real estate.

### 4.3 The Desk (`?sheet=desk`)

Six rows. **Two are dead:**
- `Papers & records` → `router.replace('/app')` — closes the sheet, does nothing.
- `The Club` (when active) → `router.replace('/app')` — same.

Both point at Glance *layers* that were deleted when `HomeV2` replaced the old composition. The header comment in `app/app/page.tsx:3-7` still describes that composition ("portrait → Now → Protection → the story → Papers → The Club → signature") — **the file's own documentation describes a screen that no longer exists.**

Also: the sheet is titled "The studio" and contains a row called "The studio" (which opens WhatsApp). Two different meanings, one word.

### 4.4 The Stay

The strongest surface. Real defects:
- **"Planned finish around 2:49 am."** `timingLine()` = `arrivedAt + durationMinutes`, no business-hours clamp. An 8-hour ceramic checked in at 18:49 produces a 2:49am promise from a studio that closes at 19:00. This is the most trust-destroying sentence in the product.
- Act labels clip at 375px — "Looked over" wraps and is cut by the fold; "Final checks" wraps to two lines while its neighbours don't, breaking the baseline.
- Content is animation-gated (§2.4).
- Drag-to-dismiss has no visual affordance until you scroll to find "Put it down".

### 4.5 Dead ends and missing paths — complete list

| Dead end | Detail |
|---|---|
| Desk → Papers & records | no-op |
| Desk → The Club (active) | no-op |
| Dock → Garage | opens blank add-car form |
| Bell | opens Desk; badge impossible |
| Referral | no entry point exists |
| Quote request | no entry point exists |
| Sell your car | `/dashboard/sell-car` unreachable from `/app` |
| Saved cars | data model + rules exist, no UI |
| Notifications | collection written, never read |
| Pickup/drop | priced, unreachable |
| `own.order` | computed, ignored |
| `/styleguide` | public and unguarded in production |

---

# 5 · Design Audit — does it feel like a car or like React?

**Honest answer: the Stay and the Chapter feel like a car. Home feels like React.**

### What is genuinely at benchmark
- **Material.** `--st-glass` + `blur(24px) saturate(140%)` with a real `inset 0 1px 0` top edge is correct glass — most apps forget the edge highlight, which is what makes it read as a physical pane.
- **Ambient.** One fixed backdrop at the shell that never remounts across routes (`Ambient.tsx`) — this is the Rivian/visionOS move and it works.
- **Type.** Fluid display clamps, a real mono for data (`--st-data`), a `.st-chrome-sweep` metallic finish on the welcome. Better than most.
- **Voice.** "The BMW M340i is with us." "Rejoin any time — your history holds." "Running longer than planned — the work sets the pace." This is Rolls-Royce Whispers-grade copy and it is the product's strongest asset.
- **Motion tokens.** `tick 120 / move 280 / scene 480` on one `cubic-bezier(0.22,1,0.36,1)`, with `MotionConfig reducedMotion="user"` at the shell. Correctly structured.

### Where it breaks
1. **Depth is decorative, not systematic.** `--st-hold / --st-raise / --st-lift` exist but usage is ad-hoc: the Capsule uses `lift`, cards use `raise`, the Dock uses `lift`. There is no rule mapping elevation to z-order, so the bottom stack has no visual hierarchy — three panes of identical glass at three depths.
2. **No stacking contract.** The collision in §4.2 is a *design system* failure, not a CSS bug. There is no `--st-z-*` scale and no reserved-space token.
3. **Colour is inconsistent with the stated identity.** The memory of record says monochrome + graphite ink. `globals.css:1071-1078` ships a full four-hue semantic palette (`--st-ok` green, `--st-warn` amber, `--st-info` blue, `--st-urgent` red), and Home leans on it hard. Both can be right — but pick one and write it down. Today the Chip/Tone system and the "no colour accents" rule contradict each other in the same repo.
4. **Icons are inline SVG literals scattered across files.** ~12 glyphs defined inline in `app/app/page.tsx` and `HomeV2.tsx`, with a separate `ServiceIcon.tsx`. Stroke widths vary 1.6 / 1.7 / 1.8. No icon system.
5. **Styling is 100% inline `style={{}}`.** ~24k lines of it. Tailwind is installed and used only in `/admin` and marketing. Consequences: no `:hover`/`:focus-visible`/`:active` states possible without extra machinery, no media queries, no dark-mode selectors, and every style re-allocates an object on every render.
6. **The hero's empty state.** A photo-first product must design the no-photo case as an *object* (a machined plate filling the frame), not as a small centred label in a black field.
7. **Sound: zero.** For a product benchmarked against Porsche/Ferrari ownership, the absence of any audio signature at the two emotional peaks (car ready, work complete) is a missed dimension.

---

# 6 · Engineering Audit

### 6.1 Architecture

| Aspect | State | Assessment |
|---|---|---|
| Framework | Next 15 App Router, React 18 | Current |
| **Server components** | **2 of 104** `.tsx` files | ❌ **This is a client-side SPA wearing App Router clothes.** `app/layout.tsx` and `app/not-found.tsx` are the only server components. Every data fetch is a client waterfall after hydration. |
| Data layer | Firebase client SDK + a `firebaseService` barrel over `lib/services/*` | ◐ Clean module split, but the barrel `export *` defeats tree-shaking — importing one function pulls the whole graph |
| State | Zustand, session slice persisted via `SessionManager` | ✅ Well-reasoned: business objects in memory only, Firestore cache owns freshness, session on disk. The comment explaining why is exemplary. |
| Business logic | `lib/os/*` pure functions | ✅ **The best part of the codebase.** Testable, documented, no framework coupling. |
| Backend | 10 Next route handlers + Firebase Admin | ◐ Sufficient today; no queue, no webhooks, one cron |

### 6.2 Concrete debt

**Dead code in the flagship file.** `app/app/page.tsx` is 1,432 lines. Verified unused: `StoryFilm` (88 lines), `StudioCard`, `MemberCard`, `EmptyState`, `Layer`, `Fragment`, `TONE_INK`, `PHASE_LINE`, `fmtMonthYear`, `ModuleKey`, `shareReferral` (+ `refCopied` state + `REFERRAL` import), `showAllStory` (written, never read), `onAddPage`, `STORY_PREVIEW`. ≈180 lines of dead code, plus a file header describing a deleted design. **`eslint.ignoreDuringBuilds: true` in `next.config.js` is why none of this was caught.**

**A live React key warning** in the `AppLayout` subtree, reproduced on every `/app` load. Currently harmless; it will produce wrong state on reorder.

**Unbounded reads.** `getUserBookings` and `subscribeUserBookings` fetch *every* booking a user has ever made, with no `limit()` and no pagination — and hold a live listener on the full set. `getJobsForCustomer` likewise. At 3 visits/year × 5 years that's fine; at fleet scale it is not.

**Rules cost.** `isAdmin()` / `isStaff()` / `myEmployeeId()` each perform a `get()`. The `jobs` update rule can evaluate three of them in one request — three billed document reads per write, on the hottest collection in the studio.

### 6.3 Security

| Finding | Severity | Detail |
|---|---|---|
| **Any authenticated user can burn any promo** | **High** | `firestore.rules:231` allows any signed-in user to update any promo when `affectedKeys().hasOnly(['usedCount'])` and the new value is `old+1`. There is no check that the caller is redeeming it. Referral rewards have `usageLimitTotal: 1` — one loop exhausts every promo in the system. Move redemption behind an admin-SDK route. |
| **Referral codes have no uniqueness constraint** | Medium | `getMyReferralCode` writes `referralCode` to the caller's own user doc from the client; `users` update rules permit any field except `role`. Two users can hold the same code; `/api/referral/claim` does `limit(1)` and picks arbitrarily. Attribution can be silently hijacked. Mint codes server-side into a `referralCodes/{code}` doc keyed by code. |
| **Unauthenticated writes** | Medium | `feedback` and `carLeads` both allow `create` with **no auth** (shape validation only). No rate limit. Anyone can write unbounded documents to a billed database. Put both behind a route handler with a token or App Check. |
| **`/styleguide` ships to production** | Low | Unguarded internal design gallery on the public site. |
| **Admin bootstrap by email string** | Low | `isOwnerEmail()` hardcodes `hello.automodz@gmail.com` in rules. Correct pattern would be a custom claim. |
| Positive: role escalation | ✅ | Rules forbid self-escalation; `employee` is granted only via admin SDK. Correctly designed. |
| Positive: invoice sharing | ✅ | Token-gated route with a money-free `?view=chapter` projection. Genuinely thoughtful. |
| Positive: `safeDest()` | ✅ | Open-redirect protection on the login redirect. |

### 6.4 Testing

96 tests, all passing, ~0.9s. **All six suites test pure functions** (`ownership`, `os`, `pricing`, `payroll`, `session`, `utils`). Zero component tests, zero integration tests, **zero Firestore rules tests**. The rules file is 283 lines of security-critical logic with no emulator suite — and it contains the highest-severity finding in this audit.

### 6.5 Accessibility

Measured on `/app`:
- **Zero `<h1>`–`<h4>` elements.** No document outline at all. The headline "In care" is a `<button>`; the car name is a `<p>`.
- **No `<main>` landmark.** Only unlabelled `<section>`s and the dock `<nav>`.
- **`userScalable: false, maximumScale: 1`** in `app/layout.tsx` — a direct **WCAG 2.1 SC 1.4.4 (AA) failure.** Pinch-zoom is disabled product-wide.
- Tap targets: 31px (dock), 38px (pills) — below AA target size.
- `--st-ink-3` = `rgba(242,242,239,0.38)` on `--st-paper` `#111214` ≈ **3.4:1** — fails 4.5:1 for the body text it's used for.
- No focus-visible styling anywhere (inline styles can't express it).
- ✅ Good: `MotionConfig reducedMotion="user"`, `aria-label`s on icon buttons, `role="status" aria-live="polite"` on the push error.

### 6.6 PWA

- ✅ `@ducanh2912/next-pwa`, `skipWaiting`, `clientsClaim`, `/offline` fallback, FCM SW route.
- ❌ **`manifest.json` `start_url: "/"`** — installing the app opens the *marketing homepage*, not the garage. For an ownership OS this is backwards; it should be `/app`.
- ❌ `theme_color` / `background_color` `#F7F7F6` (light) while the app is always-dark → white splash flash into a black app.
- ❌ Shortcut points at `/dashboard/booking`, a deleted route (works only via 301).
- ❌ No `id`, `scope`, `display_override`, or `screenshots` (blocks rich install UI).
- ❌ Push permission is requested from a settings pill — no contextual prompt at the moment it matters ("we'll tell you when the car's ready").

---

# 7 · Backend Audit

**There is no backend service.** There are 10 Next.js route handlers, Firestore, and one Vercel cron. For a single studio that is a defensible, even smart, choice. It has three consequences worth naming:

1. **No transactional integrity across collections.** Booking creation, promo redemption and membership deduction are separate client writes. `/api/membership/deduct-wash` is correctly transactional; nothing else is.
2. **No queue.** Everything is synchronous inside a request or inside the daily cron. `/api/cron/daily` iterates **every customer sequentially** (`for (const u of users.docs)`) inside a single 60s invocation. At ~500 customers × 4 Firestore round trips each, this exceeds `maxDuration` and silently truncates. It will fail before it warns.
3. **No webhooks.** Payment, WhatsApp delivery receipts, and any partner integration have nowhere to land.

`lib/server/firebaseAdmin.ts` correctly gates on configuration and every route returns `503` rather than crashing — good discipline.

---

# 8 · Database Audit

## 8.1 Collections (reverse-engineered from rules + services)

| Collection | Key | Written by | Read by | Notes |
|---|---|---|---|---|
| `users` | uid | client (self), admin SDK | self, admin | Holds `referralCode` (unconstrained), `notificationPrefs`, `role` |
| `users/{}/vehicles` | auto | owner, admin | owner, admin | Subcollection — correct ownership |
| `users/{}/vehicles/{}/serviceHistory` | auto | admin | owner, admin | **Declared in rules, written by nothing.** Dead. |
| `users/{}/fcmTokens` | token | owner | owner, admin | Correct |
| `users/{}/savedCars` | listingId | owner | owner | No UI |
| `bookings` | auto | customer, admin | owner, admin | Root collection, not nested — correct (admin needs cross-user queries) |
| `jobs` | auto | staff | staff, own customer | 1:1 with booking |
| `services` | auto | admin | all authed | Catalogue |
| `subscriptions` | auto | customer (`pending` only), admin | owner, admin | Rules correctly forbid self-activation |
| `invoices` | auto | staff | owner, staff, public-by-token | |
| `counters` | id | staff | staff | Invoice numbering — **not transactional; concurrent invoices can collide** |
| `promos` | auto | admin, `/api/referral/claim` | all authed | `usedCount` writable by anyone ⚠ |
| `promoRedemptions` | auto | customer, admin | owner, admin | |
| `referrals` | auto | admin SDK only | participants, admin | |
| `notifications` | `ret_{uid}_{kind}_{date}` / `ops_{uid}_{kind}_{key}` | admin SDK | **customer: nobody** ⚠ | Deterministic ids = idempotent. Good design, no reader. |
| `notificationLog` | auto | admin SDK | cap accounting | **Not in `firestore.rules` at all** — falls through to deny-all. Admin SDK bypasses, so it works, but it's undeclared surface. |
| `dailyStats` | `YYYY-MM-DD` | cron | ? | Written nightly; no reader found in `/admin/reports` |
| `activity` | auto | staff | staff, own customer | Ops event log |
| `employees`, `attendance`, `payroll` | — | admin/staff | staff | Complete |
| `expenses`, `dailyClosings` | — | admin | admin | Complete |
| `inventoryItems`, `inventoryTxns`, `serviceRecipes` | — | staff/admin | staff | Complete |
| `quotes` | auto | staff, customer (`requested`) | staff, own customer | Customer path unused |
| `tasks`, `walkinCustomers`, `feedback`, `gallery`, `studioConfig` | — | — | — | |
| `carListings`, `carLeads`, `sellRequests` | — | — | — | |

**28 collections.** Two dead (`serviceHistory`, arguably `dailyStats`), one undeclared (`notificationLog`), one unread by its intended audience (`notifications`).

## 8.2 Indexes

12 composite indexes in `firestore.indexes.json`. **Missing for queries that exist in code:**
- `bookings` (`userId` + `scheduledDate` desc) — the customer's own history sort
- `jobs` (`customerId` + `date`) — `getJobsForCustomer`
- `jobs` (`status` + `paymentStatus`) — the cron's receivables sweep
- `quotes` (`customerId` + `createdAt`)
- `activity` (`customerId` + `createdAt`)
- `notificationLog` (`userId` + `date`) — used by every retention run

These currently work because collections are small. They will start throwing `FAILED_PRECONDITION` in production at scale, in the cron, at night.

## 8.3 Schema issues

- **Heavy denormalisation on `Booking`** — `userName`, `userPhone`, `userEmail`, `vehicleName`, `vehicleRegNo`, `serviceName`, `serviceBasePrice` are all copied in. Correct for an immutable commercial record; but nothing updates them when the source changes, and there's no `schemaVersion` for migration.
- **`MEMBERSHIP_PLANS` lives in `lib/types.ts`, not Firestore.** Pricing changes require a code deploy.
- **`Protection` is derived, never stored.** Elegant, but it means the promise a customer was sold depends on the *current* `services` catalogue. Change a warranty string in admin and every past customer's protection silently changes. Protection must become a stored object with the terms captured at sale.
- **No soft delete / audit trail on `users` or `vehicles`.**
- **`Timestamp` from the client SDK in shared types** couples server code to the client SDK.

## 8.4 The schema that's missing (the constitution's own model)

```
parties/{id}              Party — person or org (owner, family, fleet, craftsman)
partyVehicles/{id}        Party ↔ Vehicle with a role (owner/driver/manager)
vehicles/{id}             promote out of the user subcollection (a car can outlive an owner)
moments/{id}              vehicleId, at, authorId, kind, media[], caption   ← the memory atom
threads/{partyId}         the one conversation
threads/{}/messages/{id}  authorId, at, body, attachments[], refObject
records/{id}              vehicleId, kind (invoice|rc|insurance|puc|warranty|inspection), file, validFrom/To
protections/{id}          STORED, with terms captured at sale
signals/{id}              vehicleId, kind (odometer|fuel|health), value, at, source
studios/{id}              lift COMPANY out of lib/company.ts
```

---

# 9 · API Inventory

### Implemented
| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/availability` | ID token | Server-side because rules correctly block cross-user reads. Well built. |
| `GET /api/cron/daily` | `CRON_SECRET` | 5 jobs; will exceed 60s at scale |
| `POST /api/employee/link` | ID token (self) | Promotes + revokes. Correct. |
| `GET /api/invoice/[id]?t=` | publicToken | + `?view=chapter` money-free projection |
| `POST /api/membership/deduct-wash` | ID token | Transactional. Correct. |
| `POST /api/notify/event` | ID token + doc ownership | Anti-spoof check is good |
| `POST /api/push/send` | admin | |
| `POST /api/referral/claim` | ID token | |
| `POST /api/retention/run` | admin | |
| `POST /api/whatsapp/send` | admin | Stub — no-ops without env |

### Missing — required by features that already exist in the UI or data model

| Endpoint | Why | Needs |
|---|---|---|
| `POST /api/booking/create` | Server-authoritative slot lock + discount computation | transaction, auth |
| `POST /api/promo/redeem` | Close the `usedCount` hole | transaction, auth |
| `GET /api/notifications` + `POST /api/notifications/read` | The inbox that doesn't exist | auth, index |
| `POST /api/payments/order` + `POST /api/payments/webhook` | Any online payment | payment, **webhook**, queue |
| `POST /api/referral/code` | Server-minted unique codes | transaction |
| `POST /api/quote/request` | Customer consult path | auth, notification |
| `POST /api/moments` | The memory atom | **file storage**, auth |
| `GET/POST /api/records` | Digital glovebox | **file storage**, OCR/**AI**, cron (expiry) |
| `POST /api/thread/message` | In-app conversation | **realtime**, storage |
| `POST /api/visit/[id]/approve-extra` | Mid-visit upsell approval | auth, realtime, notification |
| `GET /api/vehicle/[id]/health` | Predictive maintenance | **AI**, analytics |
| `POST /api/account/delete` + `/export` | DPDP Act 2023 | queue, storage |
| `POST /api/whatsapp/webhook` | Inbound WhatsApp → Thread | **webhook** |
| `GET /api/search` | Cross-object search | **search index** |
| `POST /api/cron/weather` | Monsoon / rain alerts | cron, external API |

**Capability gaps across the whole API:** no queue, no webhooks, no file-storage endpoints (Storage is used client-side only), no search index, no analytics pipeline, no caching layer, and no AI surface anywhere.

---

# 10 · Automation Inventory

### Running today
| Automation | Where | Assessment |
|---|---|---|
| Membership expiry (≤3 days) | `runRetentionForUser` | ✅ logic good — ⚠️ delivered to a collection nobody reads |
| Washes-remaining nudge | same | same |
| Protection expiry (≤14 days) | same | same |
| 30-day win-back | same | same |
| Daily cap (2/user) + prefs honoured | same | ✅ genuinely thoughtful |
| Low stock → owner | `/api/cron/daily` | ✅ works (admin reads `/admin`) |
| Receivables aging (>3d) → owner | same | ✅ |
| Pending memberships → owner | same | ✅ |
| `dailyStats` aggregate | same | ⚠️ no reader found |
| Booking created/cancelled → owner | `/api/notify/event` | ✅ ownership-verified |
| Lapsed subscription expiry | `expireLapsedSubscriptions` | ⚠️ manual trigger only, not in cron |

**The core problem: every customer-facing automation terminates in a `notifications` document that the customer app never reads.** Delivery depends entirely on web push, which is off by default and unsupported on iOS Safari unless the PWA is installed. Effective reach today is close to zero.

### Missing — the automation backlog

**Trust & retention:** post-visit thank-you + photo delivery · review request 24h after collection (with the Google link already in `COMPANY`) · "your car is ready" push (exists as a state, not as a message) · abandoned-arrange recovery (sheet opened, no booking) · no-show follow-up · birthday/ownership-anniversary ("one year with AutoModz" — the copy is already written in `styleguide`) · dormant-90-day win-back with a real offer.

**Vehicle intelligence:** monsoon alerts (June–Sept, Ahmedabad — genuinely differentiated) · pre-summer paint protection · post-Diwali detail · service-interval by odometer · tyre age · document expiry (insurance/PUC/RC) · warranty-expiry ladder at 90/30/7 days rather than a single 14-day fire.

**Commercial:** membership auto-renew + dunning · upgrade nudge when wash count exceeds plan · referral reward reminder · quote follow-up at 48h/7d · price-change notice to members · receivables → customer (today only the owner is told).

**Operational:** technician assignment push · bay-conflict detection · capacity alerts · inventory auto-reorder from recipes · attendance anomaly.

---

# 11 · Missing Features — the complete list

Organised by what the constitution already promises versus what an Indian automotive ownership OS needs.

### Tier 1 — the constitution's own unbuilt objects
1. **Moment** — the memory atom. Customer-authored photos and notes (delivery day, first road trip, a scratch). *This is the 355-day product.*
2. **Thread** — one in-app conversation, forever. Today every message leaves for WhatsApp.
3. **Party** — family members, drivers, fleet managers, and **craftsmen as objects** (Ravi Sharma has a name in the data but no profile, no photo, no history, no rating).
4. **Record** — the digital glovebox: RC, insurance, PUC, PPF certificate, warranty card, inspection report.
5. **Studio** — lift `lib/company.ts` into data so multi-location becomes possible.
6. **Signal** — odometer, fuel, health readings.

### Tier 2 — India-specific ownership (the real moat)
7. **Insurance** — policy vault, expiry ladder, renewal quotes, claim assistance. Highest-value recurring reminder in Indian car ownership.
8. **PUC certificate** — 6-month expiry, legally mandatory, universally forgotten. A single push here is worth more than any detailing upsell.
9. **FASTag** — balance, recharge, toll history.
10. **RC / registration** — document + renewal.
11. **Challan check** — e-challan lookup by registration. Enormously sticky.
12. **Road tax / permit** reminders.
13. **Service history beyond AutoModz** — the customer's *other* garage visits. Become the record of the car, not the record of your relationship with it.
14. **Warranty tracker** — manufacturer + extended.
15. **Tyres** — purchase date, tread, rotation, age-based replacement.
16. **Battery** — age, replacement due.
17. **Fuel log + mileage** — with cost analytics.
18. **Expense ledger** — total cost of ownership. Nothing in India does this well.
19. **Trips** — odometer-based, optional.

### Tier 3 — care & trust
20. **Vehicle health score** — a single derived number from protection state, service recency, document validity, tyre/battery age. The Home headline the product deserves.
21. **Damage & scratch map** — a car diagram with tagged pre-existing damage, captured at intake. Directly reduces disputes.
22. **Before/after comparison in the Chapter** — the component exists, unused.
23. **Live technician profile** — photo, tenure, specialisation, jobs completed.
24. **Pickup & drop tracking** — the fields exist; add live location and ETA.
25. **Mid-visit extra-work approval** — detailer finds swirls, sends a photo and a price, customer taps approve. Pure margin.
26. **Inspection report** — a formal digital condition report per visit.
27. **Seasonal recommendations** — monsoon, summer, festive.
28. **AI assistant** — "how long does my ceramic last?", "what's this noise?", "when's my PUC due?" grounded in the customer's own objects.
29. **Predictive maintenance** — from cadence + odometer + protection terms.

### Tier 4 — commerce & growth
30. Online payment (UPI intent, cards, EMI on high-ticket PPF).
31. Membership auto-renew, upgrade/downgrade, gifting, pause.
32. Referral surface (leaderboard, earnings, status).
33. Gift cards.
34. Corporate / fleet accounts.
35. Partner offers (insurance, tyres, RSA).
36. Multi-car household plans.
37. Loyalty points / tiers beyond the three plans.
38. Waitlist for full slots.
39. Recurring bookings ("every second Saturday").
40. Marketplace: accessories, care kits.

### Tier 5 — community & platform
41. Owner community by make/model.
42. Events, cars & coffee, track days.
43. Public car profiles (a shareable page for the car).
44. Service-history-backed resale valuation — *the AutoModz-verified car sells for more* (ties directly to the existing `/cars` business).
45. Multi-studio / franchise.
46. Native iOS/Android with Wallet & Live Activities.
47. CarPlay / Android Auto glance.
48. Apple Wallet membership card.
49. Widgets.
50. Offline-first document access.

---

# 12 · Broken Flows — consolidated defect register

| ID | Severity | Defect | Location |
|---|---|---|---|
| B1 | **Critical** | Discounts never applied to customer bookings — members and promo holders are overcharged in-app but not at the counter | `ArrangeSheet` `page.tsx:1299-1321` |
| B2 | **Critical** | In-app notification inbox does not exist; all retention output is invisible | `page.tsx:506` |
| B3 | **Critical** | Referral share has no entry point — the loop cannot start | `page.tsx:333` (dead) |
| B4 | **Critical** | Any authenticated user can exhaust any promo | `firestore.rules:231` |
| B5 | **High** | Four fixed layers collide at the bottom; primary CTA covered on first run | `Dock`/`Capsule`/`CoachMark` |
| B6 | **High** | Dock: 31px tap targets; "Garage" opens a blank add-car form | `Dock.tsx:61` |
| B7 | **High** | "Planned finish around 2:49 am" — ETA ignores business hours | `lib/os/stay.ts:timingLine` |
| B8 | **High** | Desk rows "Papers & records" and "The Club" are no-ops | `page.tsx:312,318` |
| B9 | **High** | Chapter shows "not in this garage" during load — false negative on every cold deep link | `chapter/[id]/page.tsx` |
| B10 | **High** | Availability fails open — API error shows every slot as free | `ArrangeSheet` / `ManageVisitSheet` catch blocks |
| B11 | **High** | No success moment after booking, rescheduling, joining the Club, or adding a car | all sheets |
| B12 | **Medium** | The Stay's content is gated behind a framer entrance — black screen if it doesn't run | `visit/[id]/page.tsx` |
| B13 | **Medium** | `looked_over` act is unreachable | `lib/os/visit.ts` |
| B14 | **Medium** | PWA `start_url: "/"` opens marketing, not the garage | `manifest.json` |
| B15 | **Medium** | `userScalable: false` — WCAG 1.4.4 failure | `app/layout.tsx` |
| B16 | **Medium** | No headings, no `<main>` on the flagship screen | `/app` |
| B17 | **Medium** | Referral codes have no uniqueness constraint | `getMyReferralCode` |
| B18 | **Medium** | `feedback` and `carLeads` accept unauthenticated writes | `firestore.rules:174,254` |
| B19 | **Medium** | Cron iterates all users sequentially in a 60s budget | `/api/cron/daily` |
| B20 | **Medium** | `signInWithPopup` blocked in in-app browsers | `lib/services/auth.ts` |
| B21 | **Low** | React key warning in `AppLayout` subtree | runtime |
| B22 | **Low** | ~180 lines of dead code + a file header describing a deleted design | `app/app/page.tsx` |
| B23 | **Low** | `/styleguide` public in production | route |
| B24 | **Low** | `own.order` computed and discarded | `page.tsx:233` |
| B25 | **Low** | Google Fonts via render-blocking `<link>` instead of `next/font` | `app/layout.tsx` |
| B26 | **Low** | `eslint.ignoreDuringBuilds: true` | `next.config.js` |
| B27 | **Low** | Missing composite indexes for 6 live queries | `firestore.indexes.json` |
| B28 | **Low** | Invoice counter is not transactional | `counters/{id}` |
| B29 | **Low** | `/dashboard/sell-car` orphaned; saved-cars UI missing | routes |
| B30 | **Low** | `theme_color` light while the app is always-dark | `manifest.json` |

---

# 13 · Performance

**Measured** (`next build`, production):

| Route | Page | First Load JS |
|---|---|---|
| `/app` | 18.3 kB | **355 kB** |
| `/app/visit/[id]` | 8.3 kB | 317 kB |
| `/app/chapter/[id]` | 2.4 kB | 311 kB |
| `/` | 12.5 kB | 327 kB |
| shared | — | 104 kB |

**355 kB of JavaScript to see your own car.** On a mid-range Android on Ahmedabad 4G that is roughly 3–5s before the first pixel of content, because `/app` is marked static but is a `'use client'` shell — the HTML contains nothing. The sequence is: download 355 kB → hydrate → Firebase auth → Firestore reads → render. Every step is serial.

**Root causes, in order of impact:**
1. Firebase client SDK v10 imported through a barrel (`export *` in `firebaseService.ts`) that defeats tree-shaking.
2. 99/104 components are client components — no server rendering of any content.
3. `framer-motion` (full) + `lenis` + `vaul` all on the critical path.
4. Google Fonts loaded via a third-party render-blocking `<link>` — extra DNS + TLS + CSS round trip before any text paints. `next/font` would self-host and eliminate it.
5. No route-level code splitting of the sheets — `ArrangeSheet`, `ManageVisitSheet`, `YouSheet`, `JoinClub`, `Desk` all ship with Home even though none is visible on load.

**Perceived performance** is better than actual, and deliberately so: `StudioLoading` holds a calm breath, the session restores synchronously so a returning customer's garage is on screen immediately, and cached truth survives a failed revalidate. That design work is real and should be preserved.

**Motion/jank:** `MomentStage`'s progress fill animates `width` (layout-triggering) rather than `transform: scaleX` — the one animation on the hero surface that will jank. `Ambient` uses a fixed layer with soft-light blend + blur, which on low-end Android forces a large composited layer for the life of the session; worth profiling. `st-bloom` uses `mixBlendMode: soft-light`, expensive on mobile GPUs.

**Layout shift:** the hero is `52vh` with a `HeroMedia` that swaps a plate for an image — no reserved aspect ratio means a CLS hit on every Home load with a photo.

---

# 14 · Growth Strategy

### The activation funnel, as built
```
Land → Google-only sign-in → welcome → name/phone → add car → Home
```
**Leaks:** Google-only (phone-first market); `signInWithPopup` fails in Instagram/WhatsApp browsers; phone is optional yet load-bearing for every downstream reminder; no value shown before the sign-in wall; no arrival moment after the car is added.

**Fixes:** phone/OTP as the primary path · redirect fallback · make phone required with validation · show the studio, the work and the prices *before* the door · a real "your garage is open" moment.

### Retention — the honest picture
The product's stated goal is the 355 days between visits. Today those days contain: a hero, two pills, one card, two buttons and an address. **There is no reason to open the app.** And the one system built for those days — retention notifications — writes to a collection the app never reads.

**The three highest-leverage retention builds, in order:**
1. **In-app inbox** (1 day). Turns four already-built automations on.
2. **Digital glovebox + document expiry** (2 weeks). PUC and insurance reminders create *recurring, legally-motivated* opens that have nothing to do with detailing. This is the single biggest retention idea available.
3. **Moments** (2 weeks). The customer adds their own photos. Now the app holds something only they can lose.

### Viral loops
- **Referral: built and disconnected.** Claim works; share doesn't exist. Connecting `shareReferral()` to a button is ~1 hour of work and turns on a dual-sided reward that's already server-side.
- **Chapter sharing: the best untapped asset.** `/api/invoice/[id]?view=chapter` already returns a money-free, photo-led record of a beautiful car. That is inherently shareable and currently surfaced only if an invoice exists. Make every finished visit produce a shareable Chapter, add an OG image, and each completed job becomes a marketing artefact.
- **Review request: absent.** `COMPANY.googleReviewUrl` exists. A prompt 24h after a 5★-worthy collection is free local SEO.

### Revenue opportunities, ranked by effort:impact
| Opportunity | Effort | Impact |
|---|---|---|
| Apply membership % + promos at booking | **hours** | recovers member value, makes every promo real |
| Mid-visit extra-work approval | days | pure margin, zero acquisition cost |
| Online payment (UPI intent) | 1 week | removes the manual-verification bottleneck on every membership |
| Membership auto-renew | 1 week | churn is currently a manual repurchase decision every 30 days |
| Quote request for PPF/Ceramic | days | the high-ticket funnel has no entry |
| Insurance / tyre partner referrals | weeks | recurring commission on documents you already hold |
| AutoModz-verified resale | weeks | ties `/cars` to the service history — genuinely defensible |

### Engagement loops worth building
`Document expires → reminder → renew → logged → next reminder` ·
`Visit → Chapter → share → referral → new customer` ·
`Moment added → memory accumulates → switching cost` ·
`Protection ages → proposal → visit → protection renewed` (this one is **already built** in `proposalFor()` — it just needs a delivery channel).

---

# 15 · Design System Specification

The tokens in `globals.css` are a genuine system. This is what needs to be added or fixed to make it *one* operating system.

### Space — 8pt with named rhythm (keep)
```
--st-hair 4 · --st-breath 8 · --st-line 12 · --st-gap 16
--st-inset 24 · --st-rest 48 · --st-movement 96
```
Rule: `inset` is the only page gutter; `gap` is intra-component; `rest` separates sections; `movement` separates acts.

### Radius (keep, add one)
```
--st-r-pill 999 · --st-r-chip 12 · --st-r-card 16 · --st-r-sheet 24
--st-r-stage 32   ← ADD: full-bleed takeovers (Stay, Chapter masthead)
```

### Elevation — **needs a contract**
Today `hold/raise/lift` are used ad-hoc. Bind each to a z-band:
```
--st-z-base      0     flat on paper, --st-hold
--st-z-raised    10    cards,          --st-raise
--st-z-float     40    capsule/pills,  --st-lift
--st-z-dock      60    dock
--st-z-sheet     70    sheets + scrim
--st-z-takeover  80    Stay
--st-z-alert     90    toasts
```
**And a reserved-space contract, which is the actual fix for the collision:**
```
--st-dock-h        68px
--st-dock-gap      10px
--st-capsule-h     52px
--st-stack-bottom  calc(env(safe-area-inset-bottom) + var(--st-dock-h) + var(--st-dock-gap))
--st-content-floor calc(var(--st-stack-bottom) + var(--st-capsule-h) + var(--st-gap))
```
Every fixed element positions off `--st-stack-bottom`; every scrollable surface pads to `--st-content-floor`. No component invents its own offset again.

### Glass — one material, three states
```
--st-glass          rgba(18,20,23,0.55)      panel on ambient
--st-glass-on-photo rgba(12,13,14,0.64)      over photography
--st-glass-chrome   rgba(24,25,27,0.72)      the dock (heavier — it's hardware)
--st-glass-blur     blur(30px) saturate(150%)
edge: inset 0 1px 0 rgba(255,255,255,0.08)   ← mandatory on every glass surface
```

### Motion (keep, add spring)
```
--st-tick 120ms    state flips, taps
--st-move 280ms    reveals, sheets
--st-scene 480ms   route transitions, act changes
--st-ease cubic-bezier(0.22, 1, 0.36, 1)
```
Add, for anything the finger moves (sheets, pager, drag-dismiss):
```
spring: { type:'spring', stiffness: 380, damping: 34, mass: 0.9 }
```
**Rule:** anything that follows a finger uses the spring; anything the system initiates uses the ease. Currently everything uses the ease, which is why drag interactions feel authored rather than physical.

### Colour — resolve the contradiction
Two systems ship today: monochrome ink (`--st-ink`, `--st-ink-2/3`) and a four-hue semantic palette (`--st-ok/warn/info/urgent`). Pick a law and write it into the constitution:

> **Recommended:** colour is reserved for *state that changes*, never for identity, decoration or hierarchy. A maximum of **one** hued element may be visible per screen. Everything else is ink on paper. On Home today there are four (two pills + card accent + chip) — reduce to one.

### Typography
```
--st-display  Unbounded   620–700, tracking -0.02 to -0.04em   the car, the state
--st-text     DM Sans     400–560                               sentences
--st-data     DM Mono     400–500, tracking 0.06–0.14em, upper  registrations, amounts, dates
```
Scale (fluid): `Display clamp(44,12vw,60)` · `Title 26` · `Emphasis 19` · `Body 17` · `Data 13` · `Whisper 13/ink-3`.
**Fix:** `--st-ink-3` at 0.38 alpha fails contrast for body-sized text. Raise to 0.52 for text; keep 0.38 for hairlines only.

### Icons — needs a system
One grid (24), one stroke (**1.6**, currently 1.6/1.7/1.8), round caps and joins, `currentColor`, no fills. Extract the ~12 inline glyphs into `components/os/icons/` with a single `<Glyph name/>` API.

### Interaction law
- Minimum target **44×44** (violated by dock at 31 and pills at 38).
- `whileTap: 0.96` for chrome, `0.98` for cards, `0.99` for full-width — already consistent, keep.
- Every sheet is addressable via `?sheet=` — **excellent, keep**; extend it to every future surface.
- Destructive actions always confirm inside the sheet (`ManageVisitSheet` does this correctly — make it the law).
- Every mutation must produce a visible success state. Currently none do.

### Visual hierarchy law (per screen)
```
1. the car (photograph, full bleed)
2. the state (one display sentence)
3. the one thing that matters (priority card)
4. up to two actions
5. the studio
```
Nothing else on a screen. `HomeV2` already implements this — it is the right composition; it just needs the layers below it to stop colliding with it.

---

# 16 · Prioritised Roadmap

### P0 — this and next week (correctness, trust, money)

| # | Item | Impact | Diff | Effort | Depends on |
|---|---|---|---|---|---|
| 1 | Apply membership % + eligible promos in `ArrangeSheet`; record redemption | **Very high** — stops overcharging members, activates every promo and referral | Low | 0.5d | — |
| 2 | Move promo `usedCount` behind an admin-SDK route; close the rules hole | **Very high** (security) | Low | 0.5d | 1 |
| 3 | Bottom-stack contract (`--st-stack-bottom`, `--st-content-floor`); rewire Dock/Capsule/CoachMark | Very high | Low | 1d | — |
| 4 | Dock: shrink pedestal to ≤88px, 4 slots ≥64px wide; **"Garage" → a real garage view** | Very high | Low | 1d | 3 |
| 5 | Fix `timingLine()` — clamp to business hours, roll to next open day | High (trust) | Low | 0.5d | — |
| 6 | Referral share button in the You sheet — wire the existing `shareReferral()` | High | Trivial | 1h | — |
| 7 | In-app notification inbox (list + read + badge); bell becomes real | Very high | Med | 2d | index |
| 8 | Success moments: booking confirmed, visit moved, Club joined, car added | High | Low | 1d | — |
| 9 | Chapter loading state (stop showing "not in this garage" while loading) | High | Trivial | 2h | — |
| 10 | Availability must fail **closed** — show an error, not an empty calendar | High | Trivial | 2h | — |
| 11 | Delete dead code in `page.tsx`; fix the file header; turn ESLint back on in builds | Med (velocity) | Low | 0.5d | — |
| 12 | `manifest.json`: `start_url: "/app"`, dark theme colour, fix shortcuts | Med | Trivial | 1h | — |
| 13 | Remove `userScalable:false`; add `<h1>`/`<main>` to `/app`; raise `--st-ink-3` for text | Med (a11y/legal) | Low | 0.5d | — |
| 14 | Guard `/styleguide`; gate `feedback`/`carLeads` writes | Med (security) | Low | 0.5d | — |

**P0 total ≈ 9 developer-days.** Items 1, 6 and 7 alone turn on three revenue systems that are already fully built underneath.

### P1 — the next quarter (the 355 days)

| # | Item | Impact | Diff | Effort | Depends on |
|---|---|---|---|---|---|
| 15 | **`Record` object + digital glovebox** (RC, insurance, PUC, warranty, invoices) with expiry ladder | **Very high** | High | 3w | storage, cron, index |
| 16 | **`Moment` object** + customer-authored timeline | Very high | High | 3w | storage |
| 17 | Phone/OTP auth + `signInWithRedirect` fallback | Very high | Med | 1w | Firebase phone auth |
| 18 | Online payment (UPI intent + cards) + webhook | Very high | High | 2w | gateway, queue |
| 19 | Membership auto-renew + dunning | High | Med | 1w | 18 |
| 20 | Quote request flow for PPF/Ceramic | High | Low | 3d | notify |
| 21 | Mid-visit extra-work approval | High | Med | 1w | realtime, push |
| 22 | Server-authoritative booking (slot lock + pricing) | High | Med | 1w | 1 |
| 23 | Push at the right moments (ready, photo added, doc expiring) + contextual permission prompt | High | Med | 1w | 7 |
| 24 | Documents surface wired to the Desk's dead "Papers & records" row | High | Med | 1w | 15 |
| 25 | Server-minted unique referral codes + referral status UI | Med | Low | 3d | 6 |
| 26 | Store `Protection` as an object with terms captured at sale | Med (correctness) | Med | 1w | migration |
| 27 | Convert marketing + `/cars` to server components; `next/font`; per-route metadata; sitemap/robots/OG | Med (growth) | Med | 1w | — |
| 28 | Firestore rules test suite (emulator) | Med | Med | 3d | — |
| 29 | Cron → batched/queued; add missing indexes | Med | Med | 3d | — |
| 30 | Review request automation | Med | Low | 2d | 7 |
| 31 | Account delete + data export (DPDP Act 2023) | Med (legal) | Med | 1w | queue |
| 32 | Pickup & drop, surfaced and tracked | Med | Med | 1w | — |
| 33 | Icon system; spring motion for gestures; elevation contract | Med (craft) | Low | 3d | 3 |

### P2 — 6 months (the moat)

Vehicle health score · `Party` object (family, fleet, craftsman profiles) · `Thread` (in-app conversation + WhatsApp webhook) · damage/scratch map · seasonal & monsoon automations · fuel + expense ledger · tyre & battery tracking · challan and FASTag integrations · service history import · AI assistant grounded in the customer's objects · Apple Wallet membership card · widgets · waitlist · recurring bookings · `own.order` actually driving the Home composition · code-split sheets · native shell.

### P3 — 12 months+ (the platform)

Multi-studio / franchise · community & events · partner marketplace (insurance, tyres, RSA) · AutoModz-verified resale valuation · corporate fleet · predictive maintenance from `Signal` · public car profiles · CarPlay/Android Auto · loyalty economy.

---

# 17 · The Future — AutoModz at 1,000,000 users

### What stays
The **object model** (once it's actually built), the **derivation engines**, the **voice**, the **Stay**, the **Chapter**, the **`?sheet=` addressability**, the **session/boot lifecycle**, and the **one-screen-that-reorganises** idea. These are the assets. Everything else is replaceable.

### What changes
- **`/app` stops being one screen.** `ownershipState()` starts driving real module composition (`own.order` finally used), so a dormant owner, a member mid-cycle, and an owner whose car is in a bay get genuinely different products — not the same layout with different words.
- **The car becomes the root object, not a user subcollection.** A car outlives an owner; the history is the asset; that history is what makes an AutoModz-verified car worth more at resale. This single schema change is the bridge between the service business and the `/cars` business.
- **The studio becomes data.** `lib/company.ts` → `studios/{id}`. Franchise becomes a config change.
- **Firestore stops being the whole backend.** Reads move behind an edge-cached API; writes go through server-authoritative routes; a queue handles fan-out.
- **Rendering inverts.** Server components render the shell and the car; the client hydrates only what moves. 355 kB → under 120 kB.

### What disappears
- **The booking flow.** At scale, care is proposed and confirmed — the sheet becomes a fallback, not the front door. `proposalFor()` already knows how.
- **The Desk's shelf.** A navigation list is a failure of derivation. If the system knows what matters, it shows it.
- **Settings.** Every preference becomes an inference with an override.
- **The notification inbox** (once built, then outgrown). Notifications become the car speaking on the timeline, not a second store.
- **Manual payment verification.**
- **The distinction between "detailing app" and "ownership app."**

### What becomes AI
- **The concierge.** Grounded strictly in the customer's own objects — visits, protections, documents, moments. Never a generic chatbot. "When does my PUC expire?" "Should I renew the ceramic or top it up?" "What did you find last time?"
- **Damage detection** from intake photos → auto-populated condition report.
- **Health scoring and predictive maintenance** from `Signal` + cadence + protection terms.
- **Automatic Chapter authoring** — the studio takes photos; the record writes itself.
- **Document OCR** — photograph the insurance paper, the expiry ladder configures itself.
- **Demand forecasting** for bay scheduling.

### What becomes automated
Every reminder. Every renewal. Every follow-up. Every review request. Every reorder. Every dunning sequence. The owner's job becomes exceptions only.

### What becomes invisible
Booking (it becomes confirming). Payment (it becomes a saved instrument and a receipt). Membership (it becomes a standing, not a purchase). Documents (they become *valid* or *expiring*, never a file list). The app itself — on the 355 quiet days, it should send one notification a month and otherwise say nothing at all.

### The three assumptions I would challenge hardest

1. **"The customer opens the app."** They mostly won't. **The product's primary surface is the notification, and the app is where the notification lands.** Today the notification system writes to a void. Fixing that isn't a feature — it's the whole distribution strategy.

2. **"Ownership is about care."** Ownership in India is about **compliance and cost**: insurance, PUC, challans, FASTag, service, resale. Detailing is a pleasure purchase layered on top. A product that only handles the pleasure will always be opened three times a year. A product that handles the compliance gets opened monthly and *earns the right* to sell the pleasure.

3. **"The constitution is ratified and the architecture is frozen."** The constitution is the best product thinking in this repository and it should be defended — but "frozen" has, in practice, meant the *views* were built and the *objects* were not. A ratified document that describes five objects which do not exist isn't law; it's a debt register. **Unfreeze it, and build Moment, Record, Party and Thread — or amend it to admit they aren't coming.** Do not leave the gap.

---

**Bottom line:** the hard part — taste, voice, and a defensible object model on paper — is done and it is genuinely at benchmark. The remaining work is unglamorous: connect three systems that already exist, fix a stacking contract, build four objects, and make the notification actually arrive. That is roughly one quarter of focused work between here and a product that has no peer in Indian automotive ownership.
