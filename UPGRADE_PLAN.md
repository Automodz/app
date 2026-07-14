# AutoModz - Master Upgrade Plan: "Daily-Driver" Release

## Context
Owner reports "the whole UI is broken" and wants an agency-grade full renewal: bulletproof flows (no silent failures, every failure recorded), consistent design, and a backend that runs a real studio daily - eventually app-store ready. Two deep audits (frontend + backend) found the true causes:

**Why the UI "breaks":** (1) **Light mode is genuinely broken** - the depth-ramp vars (`--surface/--dark/--cavern/--dim/--lifted/--peak`) never flip in `[data-theme="light"]`, so 138 usages across 16 files render dark surfaces with dark text. (2) The inline theme script in `app/layout.tsx:44` sets a `.light` **class** but CSS keys off `data-theme` → flash of wrong theme. (3) Content is **invisible until framer-motion animations run** (initial-hidden staggers) - on slow loads the app looks blank. (4) ~90 hardcoded status hexes + ~11 `catch {}` blocks that swallow errors with zero user feedback.

**Backend truth:** invoice counter, inventory, membership-wash are already transactional (good). But: **P0 - slot double-booking** (`createBooking` bookings.ts:30 is a bare addDoc; no capacity guard in transaction or rules); P1 - no Firestore offline cache (kiosk dies on flaky Wi-Fi), unbounded `getAdminStats` (admin.ts:635 fetches ALL bookings+users), promo `usedCount` increments silently swallowed (rules `==old+1` vs concurrent `increment()`), referral claim race, client-controlled booking totals, untested slot-occupancy math (bookings.ts:115-150).

**Owner decisions:** Refined Graphite (grey/white per logo) · shared component library · content-first motion · ops (admin/kiosk) first.

**Standing constraints:** free tier only (Firestore Spark + Cloudinary + Vercel), mobile-first, kiosk runs on iPad under admin session, `hello.automodz@gmail.com` = owner. Firestore rules deploy is owner-gated (`npx firebase-tools login --reauth` then `deploy --only firestore:rules,firestore:indexes`) - every phase that touches rules must END by printing the exact deploy command and telling the owner to run it.

---

## Phase 0 - STABILIZE (fix "broken UI" at the root) - do first, small diffs
1. **Theme mechanism** (`app/layout.tsx`, `components/ThemeProvider.tsx`): inline script sets `document.documentElement.dataset.theme` from the `automodz-v4` localStorage key (keep class swap for compat). ThemeProvider stays source of truth after hydration.
2. **Light-mode depth ramp** (`app/globals.css`): add `[data-theme="light"]` overrides for `--void/--abyss/--deep/--cavern/--dark/--dim/--surface/--lifted/--peak` (porcelain ramp: #F6F6F5 → #FFFFFF cards → #E8E8E6 chrome), so all 138 raw usages fix themselves. Verify admin sidebar + kiosk header in both themes.
3. **Content-first motion sweep**: kill blank-until-JS. Pattern: every framer-motion `initial={{opacity:0…}}` on page-level containers becomes `initial={false}` OR keeps animation but the element must be visible without JS (use the existing `.reveal` CSS pattern only for below-fold marketing). Priority files: `app/page.tsx`, `app/dashboard/page.tsx`, all `app/admin/*`, `app/store/*`. Keep whileTap/press feedback and sheet transitions.
4. **Tailwind alpha trap** (`tailwind.config.js`): wrap var colors with `<alpha-value>` where possible or replace the two `text-muted/60|40` uses (`app/admin/customers/page.tsx:75,78`).

## Phase 1 - FOUNDATION: component library + failure capture
5. **`components/ui/` library** (single file per component, token-driven, no inline hex): `Button` (primary/ghost/danger, loading state built-in), `Card`, `Input/Textarea/Select` (label+error slot), `Sheet` (bottom-mobile/side-desktop), `ConfirmDialog`, `Badge` (status→token map), `EmptyState`, `ErrorState` (message + Retry button), `Skeleton`, `PageHeader`, `StatCard`, `Chips` (filter row), `Toggle`, `ListRow`. Reuse existing CSS classes (`.card`, `.btn-ember`, `.input`, `.status-badge`) as the base - this is a wrapper layer, not a re-style.
6. **Failure capture - "every failure recorded"** (`lib/errors.ts`): `logError(scope, err, meta?)` → console + best-effort write to new `clientErrors` collection `{scope, message, uid, page, ts}` (rules: authed create with shape check, admin read). `attempt(fn, {toast, scope})` helper returning `{ok,data|error}`. **Replace all 11 `catch {}` / `.catch(()=>{})` sites** (worst: `dashboard/booking:76,253`, `store/new:109`, `admin/bookings:75`, `admin/subscriptions`) with `attempt()` → user sees a toast + Retry where applicable, failure is recorded.
7. **Offline resilience** (`lib/firebase.ts`): `initializeFirestore(app, { localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}) })` - kiosk survives flaky Wi-Fi with cached reads + queued writes. Add `useOnline()` hook + slim global offline banner in root layout.
8. **Status-color tokenization**: sweep ~90 hardcoded `#22C55E/#EF4444/#34D399/#F87171/#EAB308/#A78BFA` → `var(--success/--danger/--warning/--info)` (worst files: `dashboard/booking` 14, `dashboard/subscriptions` 13, `admin/employees/[id]` 11, `admin/reports` 7, `admin/inventory` 7).

## Phase 2 - BACKEND INTEGRITY (transactions, bounds, tests)
9. **P0 slot capacity - transactional booking create** (`lib/services/bookings.ts`): new `slotHolds` collection, deterministic id `{date}_{category}_{time}`, doc `{count}`. `createBooking` becomes `runTransaction`: read hold → if `count >= SLOT_CAPACITY[category]` throw `SlotTakenError` (UI: "Slot just filled - pick another") → increment + write booking. Cancel/reschedule decrement/move the hold. Rules: `slotHolds` write allowed for authed users only via the same key/count+1 shape, or simply admin+owner create paths (booking transaction runs as the customer - allow authed increment by 1 with count ≤ capacity).
10. **Promo redemption**: move `recordPromoRedemption` into a `runTransaction` (read promo, check limits, write redemption + `usedCount+1` - satisfies rules' `==old+1`), and surface failure (via `attempt`) instead of fire-and-forget at `dashboard/booking:250`.
11. **Price integrity (free-tier pragmatic)**: on admin "verify payment" (`admin/bookings`), recompute expected total from the service doc + discount + pickup fees; show an amber "price mismatch" badge when it differs from `booking.totalAmount`. (Full server-side create can come with Blaze later.)
12. **Bound the big queries**: `getAllBookings` → `limit(300)` + "load more"; rewrite `getAdminStats` with Firestore **`getCountFromServer()`** aggregations + narrow range queries (no full scans); bound `getCarLeads/listPromos/getRedemptionsForPromo`.
13. **Small fixes**: transactional referral claim (`app/api/referral/claim`), try/catch around `verifyIdToken` in `retention/run`, exclude `/api/` from SW NetworkFirst caching (`next.config.js`) so invoice status is never stale.
14. **Tests**: extract slot-occupancy math from `getBookedSlotsForDate` (bookings.ts:115-150) into pure `lib/services/slotMath.ts` + jest suite (overlaps, capacity, duration spans); invoice totals math extracted + tested. Keep 25 existing tests green.
15. **Backup**: admin Settings → "Download backup" button exporting all collections to a JSON file (client-side, admin session).

## Phase 3 - OPS REBUILD (admin + kiosk on the library)
16. Rebuild every `app/admin/*` page on `components/ui`: PageHeader + Chips + Skeleton + EmptyState + ErrorState-with-Retry + toasts on every mutation. Priority: **bookings, jobs, employees(+payroll), inventory, customers, reports** (reports currently has NO empty/error state - worst), then promos/cars/gallery/invoices/settings/subscriptions.
17. Kiosk (`app/store/*`): board gets ErrorState + reconnect indicator; `new` gets empty-service state; large-tap targets audit (min 44px); auto-retry snapshot listeners on error (re-subscribe with backoff) instead of silent stale UI.
18. Admin dashboard: rebuild stat cards on `getCountFromServer` aggregates; add "today" operational strip (jobs in progress, due deliveries, unpaid, low stock) - each item links to its filtered page.

## Phase 4 - CUSTOMER REBUILD
19. Rebuild `app/dashboard/*` + `app/cars/*` + `/invoice/[id]` on the library (same state guarantees). Booking wizard keeps its logic; UI moves to library components; every step keyboard/tap safe; `invoice/[id]` gets proper not-found/expired state.
20. Landing `app/page.tsx`: server-render text visible immediately (no animation gating); keep silver dust + parallax as enhancement only.

## Phase 5 - STORE-READY
21. Privacy policy page (`/privacy`) + **account deletion** flow in profile (required by Apple/Google): deletes user doc + vehicles subcollection, signs out; bookings/invoices are retained business records (anonymize name/phone on request).
22. Enable **App Check** (reCAPTCHA v3) + document API-key HTTP-referrer restriction (owner console steps printed at end).
23. Lighthouse mobile pass ≥90 on `/`, `/dashboard`; then packaging: **Bubblewrap TWA** for Play Store, **Capacitor** shell for iOS (separate follow-up wave; document steps in ROADMAP.md).

---

## Execution rules for the implementing session
- Work phase-by-phase in order; each phase ends with the full verification gate below before starting the next.
- Never leave a mutation without: loading state, success toast, failure toast + `logError`.
- No new hex colors anywhere - tokens only. No `initial={{opacity:0}}` on page-level content.
- Reuse: `lib/utils.ts` formatters, `lib/services/pricing.ts` (`computeBestDiscount`), existing `.card/.btn-*/.input` CSS, `attempt()` once built.
- Rules changes accumulate in `firestore.rules`; print `npx firebase-tools deploy --only firestore:rules,firestore:indexes` for the owner at each phase end that touched them.

## Verification gate (every phase)
1. `npx tsc --noEmit && npm test && npm run build` - zero errors, all tests green (suite grows in Phase 2).
2. Grep gates: zero `catch {}`/`.catch(() => {})` outside `lib/errors.ts` (after P1); zero status hexes outside globals.css (after P1); zero `initial={{ opacity: 0` on page containers (after P0).
3. Browser (mobile 375px + desktop, BOTH themes): landing renders with JS animations disabled-slow (content visible immediately); admin sidebar readable in light mode; demo flow booking → history → reschedule; kiosk lock → board with network throttled (offline banner appears, recovers).
4. Screenshot proof per phase: landing, admin bookings, kiosk board, booking review - light + dark.
