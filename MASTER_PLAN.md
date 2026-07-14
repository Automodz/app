# AutoModz - Master Renovation Plan (v1.0)

> **How to use this file:** hand it to Claude with "execute Phase N of MASTER_PLAN.md".
> Phases are ordered by dependency; each ends with a **Gate** - hard pass/fail checks
> that must be green before the next phase starts. Never skip a gate.
> Grounded in the full-codebase audit of July 2026 (build: 40 routes clean, 25 unit tests passing -
> so every defect below is runtime/flow/visual, not compile-level).

---

## 0. Context

AutoModz (Bhairavnath Rd, Maninagar, Ahmedabad 380028 · +91 95126 05088) runs a
Next.js 15 + Firebase installable PWA with two faces:

- **Customer** (`/dashboard/*`, Google sign-in): booking wizard, reschedule, history,
  vehicles, memberships, offers, referral, cars browse/inquiry, sell-car, notifications + push.
- **Internal** (`hello.automodz@gmail.com`): admin panel (`/admin/*`, 15 sections) and
  iPad kiosk **Store Mode** (`/store/*`, per-employee PIN, attendance, walk-in jobs,
  invoices → WhatsApp).

**Locked decisions (do not relitigate):** PWA only · owner-managed staff via PIN kiosk
(no staff Firebase accounts) · cars = showcase + leads · payments = manual UPI + cash ·
images = Cloudinary unsigned (Firebase Storage intentionally removed) · everything on
free tiers · theme = **Graphite v6** grey/white monochrome matching the logo, var-driven
accents (`--accent`, `--accent-grad`, `--on-accent`, muted status tokens
`--success #5FBF8F / --warning #D9A94A / --danger #E06C75 / --info #6FA8C9`),
fonts Outfit / DM Sans / DM Mono.

**Why this plan exists:** the theme migration left ~150 hardcoded status hexes and
68 non-flipping backgrounds ("the UI broke"); three customer flows are hard-broken by
Firestore rules mismatches; several loaders can hang forever; promo accounting is not
atomic; and daily-ops primitives (no-show, job edit, invoice void, customer merge) are
missing. This plan fixes all of it in gated phases and installs regression tripwires so
it cannot silently break again.

---

## 1. Non-negotiable engineering rules (apply to EVERY phase)

1. **No hardcoded colors outside `app/globals.css`.** All color goes through CSS vars.
   Status colors go through the shared helpers built in Phase 2. Gate-enforced by grep.
2. **Every async UI action has all three states:** loading, success, error. `finally`
   clears spinners; `.then` without `.catch` is banned; empty `catch {}` is banned except
   for localStorage/sessionStorage persistence.
3. **Fallback policy (record it, don't invent it):** every flow's failure behavior is
   listed in §7 Failure & Fallback Matrix. When you add or change a flow, update the matrix
   in the same commit.
4. **Multi-document writes that must agree use `runTransaction` or a WriteBatch** -
   the invoice counter (`lib/services/invoices.ts:34`) is the reference implementation.
5. **Every Firestore access added or changed is cross-checked against `firestore.rules`
   and `firestore.indexes.json` in the same commit.** A denied write in production is a P0.
6. **Verify before done:** `npm run build` + `npx jest` + the phase Gate checklist,
   plus a real click-through of touched flows in the dev preview (customer as Google user,
   internal as hello.automodz@gmail.com, kiosk with a test PIN).
7. Keep demo mode untouched. Keep the services-barrel pattern (`lib/firebaseService.ts`).
8. After each phase: update `ROADMAP.md` status (it is stale - still says theme v5) and
   the Failure & Fallback Matrix here.

---

## Phase 1 - STOP THE BLEEDING: rules, indexes, stuck spinners (P0/P1, ~1 day)

The three rules denials are the concrete "flow is breaking" reports.

### 1.1 Membership wash booking is DENIED (P0)
`lib/services/subscriptions.ts:44-46` (`deductMembershipWash`) writes `washesUsed` as the
customer; `firestore.rules` only allows customer self-update of
`['status','updatedAt'] && status=='cancelled'`. Members literally cannot book their
included washes (`app/dashboard/booking/page.tsx:200` → catch at `:316` → "Booking failed").
**Fix (choose the server route, safer):** move wash deduction into a new
`app/api/membership/deduct-wash/route.ts` using the admin SDK (copy auth pattern from
`app/api/push/send/route.ts` but verify the *customer's own* token + subscription ownership,
decrement in a transaction with a `washesUsed < washesTotal` re-check). Client calls it from
the booking flow. Alternative if you must stay client-side: extend the subscriptions rule to
allow owner updates whose `affectedKeys` ⊆ `['washesUsed','updatedAt']` with
`washesUsed == resource.data.washesUsed + 1` and `<= washesTotal`.

### 1.2 Subscription auto-expiry silently nukes memberships (P1)
`lib/services/subscriptions.ts:21-25,63-72` writes `status:'expired'` as the customer → denied →
every caller swallows → lapsed members see NO membership card at all, and the denied write
re-fires on every page load. **Fix:** stop writing from `getUserSubscription`; compute
"expired" client-side from `endDate` for display, and let the expiry WRITE happen in
(a) the admin subscriptions page on load, and (b) `app/api/retention/run` (already admin-SDK).
Rule stays tight.

### 1.3 Customer promo redemption-count read is admin-only (P1)
`lib/services/promos.ts:36-42` queries `promoRedemptions` as the customer; rules allow
admin-only read → per-customer-limited promos never auto-apply and typed codes throw.
**Fix:** rules - allow `read` on `promoRedemptions` where `resource.data.userId == request.auth.uid`
(plus admin), AND add the matching composite index `promoRedemptions(promoId, userId)` if needed.

### 1.4 Missing composite index kills retention job (P1)
`app/api/retention/run/route.ts` queries `bookings(userId ==, status ==, orderBy scheduledDate desc)`;
`firestore.indexes.json` lacks it. **Fix:** add `bookings(userId ASC, status ASC, scheduledDate DESC)`.

### 1.5 Stuck spinners - add `.catch` + error UI (P1)
`app/admin/bookings/page.tsx:117`, `app/admin/invoices/page.tsx:15`, `app/admin/jobs/page.tsx:24`,
`app/cars/page.tsx:25`, `app/store/page.tsx:20`, `app/admin/schedule/page.tsx:27`,
`app/admin/settings/page.tsx:20`. Pattern to install everywhere (and reuse in Phase 3):
a tiny `useAsyncLoad` hook or `try/catch/finally` with a shared `<ErrorState retry={load} />`
component (message + retry button, styled with tokens).

### 1.6 onSnapshot listeners get error callbacks (P1)
`lib/services/jobs.ts:65` (`subscribeTodaysJobs`), `lib/services/bookings.ts:44`
(`subscribeUserBookings`): add the error callback param, surface a reconnect banner + retry.

### 1.7 Lock `/api/retention/run` to admin (P2, one-liner while here)
Add the same role check used by `app/api/push/send/route.ts`.

### 1.8 DEPLOY. The hardened rules are still not live.
`npx firebase-tools login --reauth` then
`npx firebase-tools deploy --only firestore:rules,firestore:indexes --project automodz`
(or paste rules into the console). **Nothing in this plan matters while local rules ≠ live rules.**

**GATE 1**
- [ ] Build + all jest tests pass.
- [ ] Manual: Google-customer books a membership wash end-to-end → booking created, washesUsed +1.
- [ ] Manual: expired-date subscription renders as expired (no console permission errors).
- [ ] Manual: per-customer-limited promo auto-applies once, blocks the second time.
- [ ] Kill network mid-load on /admin/bookings → error state with working Retry (no infinite spinner).
- [ ] `firebase deploy` executed; live rules match repo (verify one denied-before write now succeeds in prod).

---

## Phase 2 - DESIGN SYSTEM RENEWAL: one source of truth (P1, ~2 days)

Root cause of the visual breakage: 1,084 inline `style={{}}` blocks mean colors live in
JSX, not tokens, so every theme change misses some. Fix the SYSTEM, then sweep.

### 2.1 Build the token bridge (do this FIRST)
- In `app/globals.css`: confirm/complete the semantic set - `--success/--warning/--danger/--info`
  each with `-haze` (12–15% alpha) and `-mist` (6–8%) variants for chip backgrounds, both themes.
  Add `--whatsapp: #4FAE6E` (muted to fit Graphite) as the single WhatsApp-action token.
- New `lib/theme.ts` exporting typed helpers used by ALL components:
  ```ts
  statusColor(status: BookingStatus | JobStatus | LeadStatus | 'paid' | 'pending' | ...)
    → { color: 'var(--success)', bg: 'var(--success-mist)', border: 'var(--success-haze)' }
  ```
  plus `chip(status)` returning a ready style object. Booking/job/lead/payment/stock statuses
  all map here - **one file to retune the palette forever**.
- New shared primitives in `components/ui/`: `PageHeader` (title/subtitle/actions),
  `StatusChip`, `EmptyState` (icon/message/CTA), `ErrorState` (from Phase 1), `ConfirmSheet`
  (standardize on the in-UI confirm pattern already used by booking-cancel at
  `app/dashboard/history/page.tsx:245`). All token-styled.

### 2.2 The sweep (mechanical, file-by-file - use the audit hit-list)
Replace in every file, worst offenders first:
`app/dashboard/booking/page.tsx` (16 hexes + 9 rgba), `app/dashboard/subscriptions/page.tsx` (13+2),
`app/admin/employees/[id]/page.tsx` (13), `app/admin/reports/page.tsx` (10),
`app/admin/inventory/page.tsx` (9), `app/store/job/[id]/page.tsx` (8), then the rest of the ~30 files.
- (a) bright status hexes `#34D399 #F87171 #EAB308 #D97706 #22D3EE #A78BFA #22C55E #EF4444 #FB923C`
  → `statusColor()`/tokens.  `#FF6B00` fallback at `app/admin/schedule/page.tsx:104` → `var(--accent)`.
- (b) `#25D366`/`rgba(37,211,102,…)` → `var(--whatsapp)` (4 files:
  `app/admin/customers/[id]/page.tsx:127,232`, `app/admin/invoices/page.tsx:77`, `app/admin/cars/leads/page.tsx:55`).
- (c) 68 non-flipping `rgba(255,255,255,…)`/`rgba(5,5,7,…)`/`rgba(0,0,0,…)` backgrounds →
  theme vars (`--glass`, `--surface`, `--border`…). Hit list: `app/dashboard/page.tsx:144,268,272,325`,
  `booking/page.tsx:550,699,715,725,991`, `dashboard/layout.tsx:113,116`,
  `subscriptions/page.tsx:309,426`, `auth/login/page.tsx:176,178,344,345`, `app/page.tsx:240`,
  `admin/bookings/page.tsx:196,438`, + remainder via grep.
- (d) hardcoded `white` text on accent surfaces → `var(--on-accent)`:
  `app/layout.tsx:57`, `admin/bookings/page.tsx:196`, `admin/gallery/page.tsx:96`,
  `dashboard/booking/page.tsx:662`, `dashboard/vehicles/page.tsx:115`, `cars/[id]/page.tsx:94`,
  `components/cars/CarCard.tsx:52`, `invoice/[id]/page.tsx:52`.
  (EXCEPTION: `components/invoice/InvoiceDocument.tsx` is print-first and deliberately light - leave its literals.)
- (e) Tailwind color classes → tokens: `admin/schedule/page.tsx:143`, `admin/bookings/page.tsx:248,373,454`.
- (f) Fix the one undefined var: `app/admin/settings/page.tsx:90` `var(--background-2)` → `var(--bg-2)`.
- (g) `app/dashboard/profile/page.tsx:226` pink `#FF6680` → `var(--danger)`.
- Google logo hexes in `auth/login/page.tsx:329-332` stay (brand mark).

### 2.3 Light theme certification
Toggle `[data-theme="light"]` and walk EVERY route (all 40). Fix anything invisible/muddy.
Raise focus-ring contrast (`globals.css:177`) - use a 2px solid `var(--accent)` outline in
both themes, not the low-alpha glow. Spot-check WCAG AA on muted text (`--steel`) over `--dark`.

### 2.4 Install the tripwires (so this NEVER regresses)
- `scripts/check-theme.sh`: greps `app/ components/` (excluding `globals.css`,
  `InvoiceDocument.tsx`, the Google-logo block) for
  `#[0-9A-Fa-f]{6}`, `rgba(255,69,0`, `rgba(255,255,255`, `rgba(5,5,7`, `rgba(0,0,0`,
  `text-(orange|emerald|yellow|red|green|blue)-[0-9]`, `'white'`/`"white"` in style props,
  and CSS-var names not defined in globals (`grep -o "var(--[a-z0-9-]*)"` diffed against definitions).
  Non-empty output = exit 1.
- Add `"check:theme": "bash scripts/check-theme.sh"` to package.json and chain it into `"build"`.

**GATE 2**
- [ ] `npm run check:theme` exits 0.
- [ ] Build + tests pass.
- [ ] Screenshot pass of 10 key screens in BOTH themes (landing, login, dashboard home,
      booking review step, history, subscriptions, /store lock, /store/board, admin dashboard,
      admin bookings) - no invisible text, no off-palette color.
- [ ] Focus ring visibly outlines every interactive element via keyboard-tab in both themes.

---

## Phase 3 - FLOW HARDENING: every flow gets its three states + fallback (~2 days)

Systematically apply the Phase-1 pattern (`ErrorState`, `EmptyState`, `ConfirmSheet`,
`finally`-cleared loading) to every flow, and make money-adjacent writes atomic.

### 3.1 Atomicity (backend)
- **Promo redemption → one transaction** (`lib/services/promos.ts:94-95`): re-read `usedCount`
  inside `runTransaction`, enforce `usageLimitTotal` there, write redemption doc + increment
  together. Kill the fire-and-forget `.catch(()=>{})` at `booking/page.tsx:253` - if the
  redemption transaction fails after booking creation, show a toast and write a
  `promoRedemptionFailed: true` flag on the booking for admin reconciliation (recorded fallback).
- **Booking submit ordering** stays booking-first (customer must never lose a booking to promo
  bookkeeping) - that IS the fallback; document it in §7.
- Inventory consumption + job completion already tolerate partial failure by design
  (fire-and-forget with console error) - upgrade the silent console.error to also write a doc
  `opsAlerts/{id} {type:'inventory_consumption_failed', refId, at}` and surface count on admin
  dashboard (recorded fallback instead of invisible one).

### 3.2 Destructive-action confirms (use `ConfirmSheet`)
Vehicle delete (`app/dashboard/vehicles/page.tsx:82`), admin: car listing delete, promo disable?,
inventory item deactivate, employee deactivate, job cancel (`store/job/[id]`), booking cancel from
admin drawer. Keep booking/membership-cancel flows (already have confirm) but migrate them to the
shared component.

### 3.3 Empty states everywhere a list can be empty
Audit found most exist; verify + add missing on: admin schedule (no bookings day), customer
history filters, store board columns (exists), notifications (exists), reports month with no data.

### 3.4 Offline & PWA resilience
- Reconnect banner component listening to `online/offline` events, mounted in dashboard, store,
  admin layouts ("You're offline - showing last loaded data").
- Kiosk: if PIN verify fails from network (not wrong PIN), show "Connection issue - retry"
  instead of "Wrong PIN" (distinguish error paths in `verifyPin` caller `app/store/page.tsx`).

### 3.5 Form validation feedback
Standardize: invalid fields get `--danger` border + helper text (not just a toast). Apply to:
walk-in wizard, employee form (PIN length live feedback), promo form, car listing form,
sell-car form, profile edit sheet.

**GATE 3**
- [ ] Build + tests pass; `check:theme` still green.
- [ ] Chaos pass: with DevTools offline mode, exercise booking wizard, kiosk unlock, job board,
      admin bookings - every screen shows a designed error/offline state, zero infinite spinners,
      zero white screens.
- [ ] Concurrency test: two tabs redeem the same 1-limit promo simultaneously → exactly one wins.
- [ ] Delete a vehicle → confirm sheet appears; cancel keeps the vehicle.
- [ ] §7 matrix updated to match reality.

---

## Phase 4 - BACKEND SCALE & COST DISCIPLINE (~1–2 days)

Free tier survives year one only if reads stop being O(all-documents).

- **Admin dashboard** (`lib/services/admin.ts:6-7`): replace read-everything with
  (a) today's bookings query by `scheduledDate`, (b) counters via `getCountFromServer()`
  (free-tier friendly aggregate) for totals, (c) revenue from a `dailyStats/{yyyy-MM-dd}`
  rollup doc updated incrementally on completion events (booking/job complete handlers).
- **Paginate** `getAllBookings` (`bookings.ts:60`) with `limit(50)` + `startAfter` cursor +
  "Load more" in `/admin/bookings`; same for invoices, jobs history, customers list.
- **Low stock** (`inventory.ts:33`): keep client filter (small collection) but cap with
  `where('active','==',true)` + document the decision; move reports aggregation to query the
  month window only (it already windows bookings/jobs - extend to inventoryTxns via a
  `createdAt >=` range query + index instead of full-collection fetch at `admin/reports/page.tsx`).
- **Fix error swallowing**: `app/admin/page.tsx:74`, `app/admin/subscriptions/page.tsx:29`,
  `app/store/layout.tsx:33` → route to ErrorState/toast. `lib/services/services.ts:10` static-services
  fallback: keep the fallback (it's a good one) but `console.warn` + show a subtle "catalog offline"
  badge in admin settings so a broken services collection is visible.
- Add indexes for any new range queries introduced above; deploy again.

**GATE 4**
- [ ] Admin dashboard loads with ≤ ~30 document reads on a seeded 500-booking dataset
      (check via Firestore usage tab or emulator).
- [ ] /admin/bookings paginates; scrolling a 200-booking seed never fetches all.
- [ ] Build/tests/check:theme green; rules+indexes deployed.

---

## Phase 5 - DAILY-OPS COMPLETENESS: the missing primitives (~2–3 days)

What a real day at the studio needs that the model can't express today.

1. **No-show handling**: add `no_show` to `BookingStatus` (types, `getStatusLabel/Color`,
   admin status grid, rules' allowed transitions if constrained). Auto-suggest: admin dashboard
   flags yesterday's `confirmed` bookings never progressed.
2. **Job editing**: `updateJobServiceItems(jobId, items, byEmployee)` service (recompute
   subtotal/total, append statusHistory audit entry `{action:'edited'}`), kiosk job page
   "Edit services" sheet reusing `ServicePicker`. Allowed only while status ≠ completed/cancelled.
3. **Invoice void & regenerate**: add `status: 'active' | 'void'` to Invoice (default active),
   `voidInvoice(id, reason)` (admin-only; keeps number, marks VOID watermark on the document
   component), "Regenerate" = void + create new from source job/booking. Public invoice page
   renders VOID banner. Update admin invoices list with void action + filter.
4. **Customer merge (walk-in ↔ Google account)**: admin Customer 360 gains "Link walk-in
   history" - searches `jobs` by phone where `customerId == null`, batch-writes `customerId`.
   Also auto-link going forward: `createWalkInJob` already matches by phone (keep), and on
   Google sign-in, if profile has phone, backfill-link jobs by phone via a server route
   `app/api/customer/link-jobs` (admin SDK, self-scoped).
5. **Expense ledger** (roadmap Tier-3, needed for true P&L): `expenses/{id}`
   {date, category: rent|utilities|equipment|marketing|misc, amount, note, byAdmin} + admin
   page (add/list/month filter) + reports page includes expenses in net. Rules: admin-only.
6. **Stock take**: inventory page "Stock take" mode - enter counted qty per item, writes
   an `adjustment` txn with note `stock-take` for each delta, all in one batch.
7. **Data export**: reports page gains "Export all data" - client-side JSON/CSV dump of
   bookings/jobs/invoices/customers for the selected range (owner's backup story on free tier).
8. **Protection-expiry tracker** (roadmap Tier-1, revenue): on job/booking completion of
   PPF/Ceramic/Coating, compute `protectionExpiresAt` from service warranty field onto the
   vehicle's serviceHistory entry; retention route (already running) messages 30 days before
   expiry; customer vehicle card shows "Protected until …".

**GATE 5**
- [ ] Each feature demoed end-to-end in preview (seed data), including rules-denial checks
      as the wrong role.
- [ ] Reports net = revenue − salaries − materials − expenses verified against hand math.
- [ ] New collections/fields added to firestore.rules + indexes and DEPLOYED.
- [ ] Unit tests added for: invoice void state machine, job edit recompute, expense-inclusive
      net calc (pure functions). Jest suite fully green.

---

## Phase 6 - UX POLISH & STRUCTURE (~2 days)

1. **Admin nav regroup** (`app/admin/layout.tsx:17-31`, 15 flat items): group into sections -
   OPERATE (Dashboard, Store Mode, Bookings, Walk-Ins, Schedule), PEOPLE (Customers, Employees),
   MONEY (Invoices, Reports, Promos, Memberships), CATALOG (Services, Inventory, Cars, Gallery) -
   collapsible headers on desktop sidebar; mobile gets a 2-level sheet.
2. **Shared `PageHeader` + page shell** rolled across all admin pages (kills the inconsistent
   inline header/padding duplication; shrinks the 1,084 inline-style count as a side effect).
3. **Touch targets** ≥44px audit on kiosk + customer bottom nav.
4. **Micro-states**: skeletons standardized (existing `shimmer` is fine - ensure every list uses it).
5. **Performance pass**: `next/image` for car/gallery/job photos (Cloudinary domain already
   allowed), lazy-load below-fold landing sections, verify Lighthouse ≥90 PWA/Perf/A11y/Best-Practices
   on landing + dashboard (roadmap hygiene item).
6. **Copy pass**: consistent tone (short, confident, no lorem), Indian-English, ₹ formatting via
   `formatCurrency` everywhere (grep for raw `₹` string concatenations).

**GATE 6**
- [ ] Lighthouse ≥90 across categories on / and /dashboard (throttled mobile).
- [ ] Admin nav usable one-handed on a 375px viewport.
- [ ] check:theme + build + tests green.

---

## Phase 7 - LAUNCH & OPERATE (ongoing)

1. **Deploy pipeline**: Vercel project with env vars from `.env.example` (all values documented
   in `FIREBASE_GUIDE.md`); `firebase deploy --only firestore` in the release checklist;
   smoke script: after each deploy, hit `/`, `/cars`, `/api/invoice/x?t=y` (expect 404 JSON),
   sign in demo, confirm no console errors.
2. **Monitoring on free tier**: Vercel logs for API routes; add a tiny `logError(scope, err)`
   util that writes `opsAlerts` docs (capped: only P0 scopes - payment marking, invoice create,
   wash deduction) surfaced as a red badge on admin dashboard. That is the owner's error inbox.
3. **Backups**: weekly manual "Export all data" (Phase 5.7) until/unless Blaze enables scheduled
   Firestore exports.
4. **App-store packaging** (owner goal): after two stable weeks - TWA via Bubblewrap for Play
   Store (free, ₹2,100 one-time dev fee to Google), Capacitor wrapper for iOS later (needs
   Apple's $99/yr - decide then). PWA remains the source of truth.
5. **Roadmap next waves** (from ROADMAP.md, in value order once the above is done): festive
   packages + loyalty tiers, before/after slider on gallery, bay/queue ETA board, employee
   scorecards, WhatsApp Cloud API activation (infra already env-gated at
   `app/api/whatsapp/send/route.ts`).

---

## 7. FAILURE & FALLBACK MATRIX (keep current - update with every flow change)

| Flow | Failure mode | Designed fallback (after this plan) |
|---|---|---|
| Google sign-in | popup blocked/network | toast + retry; no partial profile writes |
| Booking submit | Firestore write fails | wizard stays on payment step, data intact, toast + retry |
| Booking submit | promo redemption txn fails post-booking | booking KEPT; `promoRedemptionFailed` flag; admin reconciles from dashboard badge |
| Membership wash | server deduct route fails | booking not created; wizard offers full-price fallback toggle |
| Sub expiry | write denied/unavailable | UI computes expiry from endDate; persistence deferred to admin/retention |
| Promo auto-apply | eligibility read fails | silently books at full price (never blocks a sale); code entry still available |
| Kiosk PIN | wrong PIN vs network error | distinct messages; relock timer unaffected |
| Job board | onSnapshot drops | reconnect banner, auto-resubscribe on `online` |
| Job complete → inventory | recipe/stock write fails | job still completes; `opsAlerts` doc + dashboard badge |
| Invoice create | counter txn conflict | transaction retries; on hard fail job keeps "Generate" button, nothing half-written |
| Invoice WhatsApp | wa.me blocked | invoice link copyable from invoice card |
| Photo upload | Cloudinary env missing/network | explicit "uploads not configured/failed" toast; job/gallery flow continues without photo |
| Push enable | permission denied/unsupported | toggle reverts with guidance toast; in-app notifications unaffected |
| Push send | token dead | server prunes token; in-app notification already written first |
| Referral claim | invalid/dup/self code | server rejects with reason; sign-in continues normally |
| Public invoice link | bad token | JSON 404 → friendly "not found/expired" page |
| Offline (any) | no network | offline banner + last-loaded data; `/offline` fallback for cold loads |
| Admin lists | query error/index missing | ErrorState with Retry; error logged with scope |

---

## 8. Definition of DONE for the whole plan

- All 7 gates checked.
- `npm run build` (includes `check:theme`), `npx jest` - green.
- Live Firestore rules/indexes byte-match the repo.
- One full "day in the life" rehearsal executed without touching code:
  morning kiosk check-in → 2 walk-ins (one phone-matched member w/ discount) → photos →
  complete → invoices → WhatsApp; customer books a wash w/ membership + reschedules another +
  refers a friend who signs up and sees ₹200 off; admin verifies payment, marks salary advance,
  records an expense, checks reports, exports CSV; lapsed member sees expired card;
  one no-show closed out; one invoice voided & regenerated.
