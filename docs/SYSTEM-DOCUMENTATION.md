# AutoModz — Complete System Documentation (Reverse-Engineered)

_Generated 2026-07-18 from the repository at commit `1f059fa`. This document is the single source of truth for an architect who will never open the code. It documents reality only — no recommendations._

---

# 1. PROJECT OVERVIEW

**What it is.** AutoModz is a full-stack web platform (Next.js 15 + Firebase, PWA) for a single premium car-detailing studio: **AutoModz, Bhairavnath Rd, Maninagar, Ahmedabad, Gujarat 380028** (phone 9512605088). Version `4.0.0`, package name `automodz-app`.

**Business it serves.** One physical workshop with exactly **two physical resources**: a Wash Bay (capacity 1) and a Protection Bay (capacity 1, for PPF / ceramic / coating / correction). Services range from ₹400 headlight buffing to ₹220,000 12-year PPF. Side businesses: monthly wash memberships (Silver/Gold/Platinum), a used-car marketplace (buy/sell), and referral marketing.

**Users.**
- **Customers** — car owners who book services, hold memberships, browse the car marketplace, refer friends.
- **Employees** — detailers, washers, helpers, managers working the floor and clocking attendance.
- **The single owner/admin** — `hello.automodz@gmail.com` (hard-coded in Firestore rules as the only account allowed to bootstrap the `admin` role).

**Goals.** Run the entire business as an "internal OS": booking → check-in → job execution → QC → delivery → payment → invoice → review, plus attendance/payroll, inventory, expenses, daily cash close, monthly P&L, CRM, and marketing.

**Core mental model — three operating modes, one platform** (from `docs/INFORMATION-ARCHITECTURE.md` and the admin layout comment):

| Mode | Route root | Who | Chrome | Theme |
|---|---|---|---|---|
| **Studio OS / Owner OS** (Admin) | `/admin` | Owner/manager (role `admin`) | Sidebar + top bar + ⌘K command palette; sidebar shows only the active mode's groups (STUDIO = production, OWNER = money & decisions) | Always dark |
| **Front Desk OS** | `/store` | Reception/floor staff (role `employee` or admin) | Single top strip: Floor · Check-In · Attendance; kiosk PIN lock | Always dark |
| **Customer App** | `/dashboard` (+ `/`, `/cars`, `/invoice/[id]`) | Customers | 5-tab bottom nav; PWA install prompt | Light-first |

**Core workflows** (each detailed in §9):
1. Customer books online → admin approves → vehicle check-in creates a Job → floor executes → QC → ready → delivery gated on payment → invoice → review ask.
2. Walk-in intake at the kiosk (no account needed) → same job pipeline.
3. Employee attendance (check-in/break/checkout with GPS/device/IP capture) → payroll.
4. Membership purchase (pending until admin verifies payment) → wash deduction per visit.
5. Quotes pipeline for premium services (PPF/ceramic).
6. Daily cash close, monthly reports, inventory consumption via service recipes.
7. Marketplace: car listings, inquiry/viewing leads, sell-your-car requests.

---

# 2. TECH STACK

| Concern | Technology |
|---|---|
| Framework | **Next.js ^15** (App Router, all pages `'use client'`; API routes for server work), React 18.3, TypeScript 5.4 |
| Backend | **Firebase**: Firestore (`asia-south1`, default DB), Firebase Auth (Google sign-in + email/password for admin), Firebase Storage (photos), Firebase Cloud Messaging (web push) |
| Server SDK | `firebase-admin` ^13 in API routes (`lib/server/firebaseAdmin.ts`), configured via `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`; every route degrades gracefully if unconfigured |
| Hosting | **Vercel** (deploys from GitHub `Automodz/app`); `vercel.json` defines one cron: `/api/cron/daily` at 03:30 UTC daily |
| State management | **Zustand** ^4.5 (`lib/store.ts`, single `useAppStore`), `persist` middleware storing **only `theme`** under localStorage key `automodz-v5`. Kiosk employee mirrored to `sessionStorage` key `automodz-kiosk`. |
| Auth context | `context/AuthContext.tsx` — the only React context; feeds Zustand |
| Styling | **Tailwind CSS 3.4** + a large custom CSS-variable design system in `app/globals.css` ("Studio White" identity v9: grey/white monochrome, graphite-ink accent; customer surfaces light-first, admin/store always dark). Fonts via Google Fonts: Unbounded (display), Outfit, DM Sans (body), DM Mono. `clsx` + `tailwind-merge` via `cn()`. |
| Animations | **framer-motion** ^11 (page transitions, layout animations, sidebar), **lenis** (inertial scroll, homepage only via `SmoothScroll`), `react-intersection-observer` |
| Icons | **lucide-react** exclusively (an "icons+emoji sweep" removed all emoji); `ServiceIcon` maps service categories to glyphs |
| Charts | None — no chart library. Reports are stat tiles + CSV export; gauges are custom (`GaugeRing`). |
| Toasts | `react-hot-toast` (Toaster mounted in root layout) |
| Bottom sheets | **vaul** ^0.9 (`components/ui/Sheet.tsx`) |
| Dates | `date-fns` ^3 |
| PWA | `@ducanh2912/next-pwa` — service worker in `public/sw.js`, offline fallback `/offline`, `skipWaiting`+`clientsClaim` (fresh-first), manifest + icons, iOS standalone meta, custom `InstallPrompt` |
| Images | `next/image` with remote patterns: res.cloudinary.com, i.ibb.co, images.unsplash.com, lh3.googleusercontent.com, firebasestorage.googleapis.com. Client-side resize/compress before upload (`lib/services/storage.ts`). |
| Notifications | Three channels: in-app Firestore `notifications` docs; FCM web push (tokens at `users/{uid}/fcmTokens/{token}`, service worker route `app/firebase-messaging-sw.js/route.ts`); WhatsApp — free `wa.me` deep links by default, optional Meta WhatsApp Cloud API via `/api/whatsapp/send` when `WHATSAPP_TOKEN`+`WHATSAPP_PHONE_NUMBER_ID` set |
| Testing | Jest + ts-jest + jsdom; three suites: `__tests__/payroll.test.ts`, `pricing.test.ts`, `utils.test.ts` |
| Build | `next build`; ESLint ignored during builds; `removeConsole` in production; React strict mode on |
| Scripts | `scripts/backfill-assignments.mjs` — one-off admin-SDK migration giving legacy jobs `assignments`/`assignedIds` |

**Folder architecture**

```
app/            Next.js App Router routes (all client components + /api server routes)
components/     ui/ (23 primitives) · workspace/ · studio/ · store/ · intake/ ·
                cars/ · invoice/ · pwa/ · home/ · ThemeProvider
context/        AuthContext.tsx (only context)
lib/            types.ts · availability.ts · store.ts · utils.ts · constants.ts ·
                reviews.ts · firebase.ts (client init) · firebaseService.ts (barrel)
lib/services/   26 domain modules (client Firestore SDK)
lib/server/     firebaseAdmin.ts · notify.ts · retention.ts (admin SDK only)
lib/config/     bookingConfig.ts · storeConfig.ts
docs/           SETUP, INFORMATION-ARCHITECTURE, PRD_ASSESSMENT, UPGRADE_PLAN,
                MASTER_PLAN, FIREBASE_GUIDE, ROADMAP
__tests__/ · scripts/ · public/ · firestore.rules · firestore.indexes.json
```

`lib/firebaseService.ts` is a pure barrel re-exporting every `lib/services/*` module plus `constants.ts`; nearly all pages import from the barrel, not the individual modules.

---

# 3. COMPLETE ROUTE MAP

## Public / customer routes

| Route | Purpose | Guard | Key data | Notes |
|---|---|---|---|---|
| `/` | Marketing homepage (LC1 photo-hero): Hero with slide-to-book → Services → Membership → Before/After → Find us + reviews → Footer | none | `STATIC_SERVICES`, `MEMBERSHIP_PLANS`, `lib/reviews.ts` (⚠️ scaffold review data, real Google profile link) | Forced dark via root-layout inline script; Lenis smooth scroll; WhatsApp float |
| `/auth/login` | Single sign-in (Google). Stashes `?ref=` referral code before auth. Routes by role: admin→`/admin`, employee→`/store`, customer→`/dashboard` | none | `signInWithGoogle`, `ensureUserProfile`, `linkEmployeeRole` | Email/password (`adminLogin`) exists in `lib/services/auth.ts` but Google is the UI path |
| `/dashboard` | Customer home: greeting, active booking tracker, quick actions, membership card, offers | role customer (admin redirected to `/admin`) | zustand-cached vehicles/bookings/notifications + live `subscribeUserBookings` | |
| `/dashboard/booking` | 6-step booking wizard: Vehicle → Service → Schedule → Review → Payment → Done | customer | services, `/api/availability`, membership, promos | Deep-linkable `?cat=`, `?vehicleId=&serviceId=` (skips to step 2). Also hosts the "request a quote" sheet. |
| `/dashboard/history` | All bookings with status timeline, cancel (>4h before slot), reschedule (pending/confirmed), invoice links | customer | bookings, invoices | |
| `/dashboard/vehicles` | Garage: CRUD own vehicles (name, reg no, category, color) | customer | `users/{uid}/vehicles` | |
| `/dashboard/cars` | Marketplace browse inside app + saved (♥) tab | customer | active `carListings`, `users/{uid}/savedCars` | Duplicates `/cars` browsing with app chrome |
| `/dashboard/sell-car` | Sell-your-car form with photos | customer | writes `sellRequests` | |
| `/dashboard/subscriptions` | Membership: view/purchase plan (lands `pending`), usage ring, cancel | customer | `subscriptions`, `MEMBERSHIP_PLANS` | 732 lines; largest customer page after booking |
| `/dashboard/offers` | Active promos targeted to the user | customer | `promos` | |
| `/dashboard/refer` | Referral code, share links, my referrals list | customer | `referrals`, profile `referralCode` | |
| `/dashboard/notifications` | In-app inbox, mark read, enable push toggle | customer | `notifications`, FCM token registration | |
| `/dashboard/profile` | Profile edit, notification prefs, theme toggle, logout | customer | `users/{uid}` | |
| `/cars` | PUBLIC marketplace browse (logged-out OK) | none | active `carListings` (public read in rules) | |
| `/cars/[id]` | Listing detail: gallery, specs (reg no masked), inquiry + viewing-request forms | none | `carListings`, writes `carLeads` (shape-validated public create) | |
| `/invoice/[id]` | PUBLIC token-gated invoice (`?t=publicToken`) with before/after photos + `RatingCard` review capture | token | `/api/invoice/[id]` (admin SDK) | 4–5★ → Google review page; 1–3★ → private `feedback` doc |
| `/offline` | PWA offline fallback | none | static | |

## Admin routes (`role === 'admin'` enforced by `app/admin/layout.tsx`)

| Route | Mode | Purpose |
|---|---|---|
| `/admin` | STUDIO | **Studio Operations Board** — the landing page. Live floor: clock, bay states, alerts (bay freeing / late / customer waiting / ready-to-call), waiting queue, two resource cards, QC/ready tail, technicians, capacity. All derived from `useFloor`. |
| `/admin/schedule` | STUDIO | Planning surface, 4 views: Day (drag-to-reschedule agenda), Week, Board (by pipeline stage), Technicians (drag between lanes to reassign). Includes `BayStrip`. |
| `/admin/bookings` | STUDIO | Operational booking queue; rows open the workspace |
| `/admin/bookings/[id]` | STUDIO | **Booking Operational Workspace** — commercial mode; at check-in creates the linked Job and expands in place to operational mode (stage rail, assignments, photos, activity, payments, invoice) |
| `/admin/walkin` | STUDIO | Walk-in intake — thin wrapper (8 lines) around shared `WalkInFlow` |
| `/admin/jobs/[id]` | STUDIO | Walk-in job workspace (same `workspace/parts` components); **booking-linked jobs redirect to `/admin/bookings/[id]`** |
| `/admin/jobs` | — | **Redirect stub → `/admin`** (6 lines, keeps old links) |
| `/admin/workspace` | — | **Redirect stub → `/admin`** (6 lines) |
| `/admin/office` | OWNER | Owner OS home: intelligence strip (revenue, outstanding, approvals, staff, stock, leads), approval queue, follow-up tasks |
| `/admin/quotes` | OWNER | Quote pipeline: requested → draft → sent (WhatsApp deep link) → accepted (→ start job) / declined / expired |
| `/admin/cars/leads` | OWNER | Marketplace leads (inquiries + viewing requests) + sell requests; status new→contacted→closed |
| `/admin/customers` | OWNER | Customer list/search |
| `/admin/customers/[id]` | OWNER | **Customer 360** — chronological timeline of bookings/walk-ins/invoices/memberships + rail (garage, membership, promos, admin notes, tags) |
| `/admin/subscriptions` | OWNER | Membership admin: verify pending payments → activate; auto-persists expiry of lapsed subs on load (`expireLapsedSubscriptions`) |
| `/admin/invoices` | OWNER | Recent invoices, share links, mark paid |
| `/admin/expenses` | OWNER | Expense entry (10 categories) + month list |
| `/admin/close` | OWNER | **Daily Close**: expected cash/UPI from payment ledger vs counted drawer, variance, cash expenses, note; writes `dailyClosings/{date}` |
| `/admin/reports` | OWNER | Monthly P&L + throughput (see §16) with CSV download |
| `/admin/inventory` | OWNER | Stock items, purchases, adjustments, low-stock, txn history |
| `/admin/inventory/recipes` | OWNER | Per-service material recipes (drives auto-consumption) |
| `/admin/employees` | OWNER | Roster: create (with kiosk PIN), edit, salary config, deactivate/reactivate, reset PIN |
| `/admin/employees/[id]` | OWNER | Employee detail: attendance month view, wash performance stats, payroll compute/draft/mark-paid |
| `/admin/promos` | OWNER | Promo CRUD: percent/flat, scope (all/category/services), target (all/specific customers), validity, usage limits, auto-apply |
| `/admin/gallery` | OWNER | Homepage gallery images (upload/delete, public read) |
| `/admin/cars` | OWNER | Marketplace listing CRUD + photos + featured/status |
| `/admin/settings` | OWNER | Service catalogue CRUD + seed + **studio resource config (wash capacity)** |
| `/admin/vehicles/[reg]` | drill-down | **Vehicle 360** — history of one car by reg no (bookings, jobs, invoices, photos). Never in nav; reached by tapping any reg-no. |

## Front Desk routes (`role in ('admin','employee')` enforced by `app/store/layout.tsx`)

| Route | Purpose |
|---|---|
| `/store` | Kiosk **lock screen**: employee picker + `PinPad` (SHA-256 hash compare). Managers and personal employee sessions are auto-redirected to `/store/board`. |
| `/store/board` | **Floor** — live kanban (CHECKED IN → IN PROGRESS → QUALITY CHECK → READY) via `subscribeTodaysJobs` with stream-down detection/resubscribe; rail: today's arrivals (booked cars not yet in), my-shift check-in/break controls, payments-pending counter, daily-close shortcut (admin only); "mine only" filter |
| `/store/new` | Check-In — thin wrapper (7 lines) around shared `WalkInFlow` |
| `/store/job/[id]` | Job workspace for the desk: advance stages, photos, ledger payments (partial/advance), membership-wash deduction, invoice generation, delivery handover (payment-gated `completed`) |
| `/store/attendance` | Team attendance: whole crew's day; employee self check-in/break/checkout; manager force-checkout/reopen/correct-times/status-override; month CSV export |

## API routes (all under `app/api`, all `dynamic = 'force-dynamic'`)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/availability` | POST | Firebase ID token | Resource-aware slot availability `{dates, category, durationMinutes} → {fullSlots, fullDates}`. Server-side because customers can't read others' bookings/jobs. Reads bookings + walk-in jobs + `studioConfig/resources` with `LOOKBACK_DAYS=6` history. |
| `/api/cron/daily` | GET | `CRON_SECRET` bearer (Vercel cron 03:30 UTC) | Daily sweep: retention pass per customer; low-stock → admin notify; receivables aging (>3 days unpaid) → admin notify; pending memberships → admin notify |
| `/api/employee/link` | POST | ID token | Admin-SDK employee↔account reconciliation: promotes customer→employee if an active employee doc carries their email (back-links `authUid`); demotes stale employees→customer |
| `/api/invoice/[id]` | GET | `?t=` publicToken | Public invoice fetch (rules keep invoices closed) |
| `/api/membership/deduct-wash` | POST | ID token | Transactional wash deduction (self, or staff pass `{forUserId}`); re-checks status/expiry/remaining |
| `/api/notify/event` | POST | ID token; caller must OWN the referenced doc | Client-fired ops events → admin in-app + push: `booking_created`, `booking_cancelled`, `membership_pending`, `quote_requested` |
| `/api/push/send` | POST | admin ID token | Fan out FCM web push to a user's devices |
| `/api/referral/claim` | POST | ID token | Validates stashed referral code; creates `referrals` record + targeted flat-off ₹200 promos for both parties (promo writes are admin-only in rules, hence server-side) |
| `/api/retention/run` | POST | admin | Manual retention pass for one user (same logic as cron) |
| `/api/whatsapp/send` | POST | admin | Optional Meta WhatsApp Cloud API sender; inert without env vars |
| `/firebase-messaging-sw.js` | GET | none | Serves the FCM service worker with public config injected |

Root-level: `app/error.tsx` (branded crash screen), `app/not-found.tsx` (branded 404).

---

# 4. INFORMATION ARCHITECTURE

## Customer App — bottom nav (exactly 5 tabs, `app/dashboard/layout.tsx`)

```
Home (/dashboard) · History (/dashboard/history) · [＋ Book] (/dashboard/booking, raised center button)
· Garage (/dashboard/vehicles) · Profile (/dashboard/profile)
```
Non-tab pages (cars, sell-car, subscriptions, offers, refer, notifications) are reached from Home cards / Profile links — they still render inside the tab shell.

## Admin OS — sidebar (`app/admin/layout.tsx`), grouped, filtered by active mode

```
[Mode switch: STUDIO | DESK | OWNER]        (DESK links out to /store/board)

STUDIO mode
  PRODUCTION   Studio Board (/admin) · Schedule · Bookings

OWNER mode
  TODAY        Office (/admin/office)
  WORK         Quotes
  CUSTOMERS    Leads (/admin/cars/leads) · Customers · Memberships (/admin/subscriptions)
  BUSINESS     Invoices · Expenses · Daily Close · Reports · Inventory
  TEAM         Employees · Attendance (→ /store/attendance, cross-mode link)
  MARKETING    Promotions · Gallery · Marketplace (/admin/cars)
  SETTINGS     Services (/admin/settings)
```
Top bar: mode/page breadcrumb · Search (⌘K) · "New walk-in" button. ⌘K palette = every nav destination + quick actions (Studio Board, Switch to Front Desk, Owner Office, New walk-in, Start daily close, Add expense, Sign out). Unlisted `/admin` routes (job details, walk-in) resolve to STUDIO mode. The layout preserves per-pathname scroll position within a workflow group.

## Front Desk OS — top strip (`app/store/layout.tsx`)

```
Floor (/store/board) · Check-In (/store/new) · Attendance (/store/attendance)
Right: identity (kiosk employee or manager) · Lock (kiosk only) · Admin switch (manager) / Exit (staff)
```

## Hidden / non-nav navigation
- `/admin/vehicles/[reg]` — only via reg-no taps.
- `/admin/workspace`, `/admin/jobs` — redirect stubs.
- `/store` lock screen — only when kiosk locked.
- `/invoice/[id]` — only via shared token links.
- Mode switching is manager-only; staff and customers never see cross-mode controls (**role-visibility law**).

---

# 5. USER TYPES

Only **three persisted roles** exist on `users.role`: `customer`, `employee`, `admin`. Finer staff roles live on `employees.role`: `detailer | washer | manager | helper` (display/assignment semantics only — Firestore rules don't distinguish them).

| Role | Landing | Sees | Can | Cannot |
|---|---|---|---|---|
| **Customer** | `/dashboard` | Customer app + public pages | Book/cancel(>4h)/reschedule own pending-confirmed bookings; CRUD own vehicles; buy membership (lands `pending`); cancel own membership; request quotes (total forced 0); redeem promos (bump `usedCount` by exactly 1); create sell requests & car leads; save cars; read own notifications/invoices/referrals | Read others' data; write `washesUsed`; self-escalate role; see any staff UI |
| **Employee** (linked staff account) | `/store` → board | Front Desk only | Self attendance (check-in/break/out); create jobs; update **assigned** jobs' operational fields only (`status, statusHistory, photos, notes, bay, payment*, invoiceId, payments, amountPaid, completedAt, updatedAt`); create invoices & inventory consumption txns; read roster/jobs/quotes/tasks/walk-in CRM/activity | Amounts/discounts/assignment changes (admin-only); payroll, expenses, daily close, reports, all `/admin` pages; manual discounts (rules require discount.source ∈ membership/promo) |
| **Admin** (owner) | `/admin` | Everything | Everything client-side rules allow; the only writer of payroll/expenses/dailyClosings/services/promos/employees/inventory items/car listings | — |
| **Kiosk identity** (not an auth role) | `/store` PIN pad | Front Desk | Rides on the owner's admin auth session on the shared tablet; individual identity = PIN-unlocked employee (`kioskEmployee` in Zustand/sessionStorage); auto-relocks after 5 min idle | Persist across tab close |
| **Dev shim** (dev builds only) | any | any | `localStorage['automodz-devauth'] = 'customer'|'employee'|'admin'` fabricates a user in AuthContext; never runs in production | Real data writes still hit rules |
| Manager / Reception / Detailer / Washer / Demo / "Owner" as distinct roles | — | — | **Do not exist as auth roles.** "Manager" in UI = any admin session; reception/floor = employee role; there is no demo account system. | |

---

# 6. AUTHENTICATION

- **Provider**: Firebase Auth. UI path is **Google popup** (`signInWithGoogle`). `adminLogin` (email/password) and `resetPassword` exist in `lib/services/auth.ts` but are not the primary UI.
- **Profile bootstrap**: `ensureUserProfile` creates `users/{uid}` with role `customer` on first sign-in. Rules allow role `admin` at create **only** for `hello.automodz@gmail.com`.
- **Role resolution / employee linking**: after auth, `linkEmployeeRole` calls `/api/employee/link` (admin SDK): active employee doc with matching email ⇒ promote to `employee` + backlink `authUid`; stale ⇒ demote. Runs on every session restore (`AuthContext.onAuthStateChanged`). Fails open (profile unchanged on error).
- **Session/state**: Firebase persists auth; profile lives in Zustand (`user`, `authLoading`) — not persisted to storage.
- **Route protection**: no Next.js middleware; **client-side guards in each layout**: admin layout requires `role==='admin'` else → `/auth/login`; store layout requires staff; dashboard layout requires signed-in (admins bounced to `/admin`). Server APIs verify Firebase ID tokens.
- **Login redirect**: admin→`/admin`, employee→`/store`, customer→`/dashboard`. `?ref=` codes stashed pre-auth and claimed post-auth via `/api/referral/claim`.
- **Kiosk PIN**: employee PINs (4–6 digits) stored as SHA-256 hex (`pinHash`, hashed client-side via Web Crypto `sha256Hex`); `verifyPin` compares hashes; unlock stored in sessionStorage; 5-min inactivity relock; lock/exit controls in header.
- **Logout**: `signOut(auth)` + `setUser(null)` → `/auth/login`.
- **Dev shim**: see §5 (dev-only, memory-documented).

---

# 7. FIREBASE

Project region `asia-south1`. Client init in `lib/firebase.ts` from `NEXT_PUBLIC_FIREBASE_*` envs; admin SDK in `lib/server/firebaseAdmin.ts`. No Cloud Functions — all server logic is Next.js API routes + Vercel cron.

## Collections (top-level)

| Collection | Doc id | Purpose | Writers | Readers (per rules) |
|---|---|---|---|---|
| `users` | auth uid | Profiles, role, employeeId link, notes/tags, notificationPrefs, referralCode | self (role frozen), admin, server (role via link route) | self, admin |
| `users/{uid}/vehicles` | auto | Customer garage | owner, admin | owner, admin |
| `users/{uid}/vehicles/{vid}/serviceHistory` | auto | Admin-written history entries | admin | owner, admin |
| `users/{uid}/savedCars` | listingId | Marketplace favourites | owner | owner |
| `users/{uid}/fcmTokens` | token | Web-push device tokens | owner, admin, server (prunes dead) | owner, admin |
| `bookings` | auto | Commercial booking records | customer (create own; update limited to reschedule/cancel while pending/confirmed), admin | owner-of-record, admin |
| `jobs` | auto | Operational job records (walk-in + booking-linked) | staff create (discount must be membership/promo); **assigned** employees update operational-fields-only; admin all | staff |
| `services` | auto | Service catalogue | admin (seedable from `STATIC_SERVICES`) | any authenticated |
| `subscriptions` | auto | Memberships | customer create own as `pending`; customer may only set status→cancelled; admin all | owner, admin |
| `promos` | auto | Promotions | admin; customers may increment `usedCount` by exactly 1 | any authenticated |
| `promoRedemptions` | auto | Redemption records | customer (own), admin | own, admin |
| `referrals` | auto | Referral claims | **server only** (admin SDK via `/api/referral/claim`) | referrer, referred, admin |
| `notifications` | auto / `ret_{uid}_{kind}_{date}` (retention) | In-app inbox | admin, server | recipient (read+mark-read) |
| `notificationLog` | auto | Retention send log + daily-cap accounting, CRM comm history | server only | (admin SDK only) |
| `employees` | auto | Roster + pinHash + salary config + authUid | admin (authUid via server) | staff |
| `attendance` | `{date}_{employeeId}` | Shifts with breaks, GPS/device/IP meta, manager audit fields | employee (own), admin | staff |
| `payroll` | `{month}_{employeeId}` | Monthly payroll drafts/paid | admin | admin |
| `expenses` | auto | Business expenses | admin | admin |
| `dailyClosings` | `YYYY-MM-DD` | Cash reconciliation | admin | admin |
| `invoices` | auto | Invoices with publicToken | staff create; admin update/delete | staff, invoice's customer; public via token API |
| `counters` | `invoices` | Invoice sequence number | staff (transactional bump) | staff |
| `inventoryItems` | auto | Stock items | admin | staff |
| `inventoryTxns` | auto | purchase/consumption/adjustment ledger | staff create; admin amend | staff |
| `serviceRecipes` | serviceId | Materials per service | admin | staff |
| `quotes` | auto | Quote pipeline | staff; customer may create own `requested` with total 0 | staff, quote's customer |
| `tasks` | auto | Follow-up tasks | staff | staff |
| `walkinCustomers` | 10-digit phone | Phone-keyed CRM for accountless walk-ins (visit/spend upserts) | staff | staff |
| `feedback` | auto | Private 1–5★ invoice feedback | **anyone** (shape-validated: only whitelisted keys, rating 1–5, comment ≤1000) | admin |
| `gallery` | auto | Homepage gallery | admin | **public** |
| `carListings` | auto | Marketplace listings | admin | public when `active==true`; admin all |
| `carLeads` | auto | Inquiries/viewing requests | **public create** (shape-validated, status must be `new`) | admin |
| `sellRequests` | auto | Sell-your-car requests | customer (own) | owner, admin |
| `activity` | auto | Append-only operational event log keyed by bookingId/jobId/customerId | staff create; admin amend/prune | staff |
| `studioConfig` | `resources` | `{ washCapacity }` | admin | staff (customers go through the availability API) |

## Composite indexes (`firestore.indexes.json`)

```
bookings:  (userId ASC, createdAt DESC) · (userId, status, scheduledDate DESC) · (scheduledDate, scheduledTime)
promoRedemptions: (promoId, userId)          subscriptions: (userId, createdAt DESC)
notifications: (userId, createdAt DESC)      jobs: (date ASC, createdAt DESC)
attendance: (employeeId, date)               invoices: (customerId, createdAt DESC)
carLeads: (status, createdAt DESC)           carListings: (active, createdAt DESC)
promos: (active, validTo)
```
`activity` deliberately needs no composite index (single-equality query, client-side sort).

## Security-rule design principles (verbatim intent from `firestore.rules`)
1. Role self-escalation impossible; owner-email bootstrap is the only admin path.
2. Sensitive money mutations (`washesUsed`, promo creation, referrals, role changes) run **only server-side** with the admin SDK.
3. Employees write only assigned jobs, only operational fields; discounts must be system-computed.
4. Public writes (`feedback`, `carLeads`) are shape-validated field-whitelist creates.
5. Public reads limited to `gallery` and active `carListings`.

## Storage
Firebase Storage holds job photos, gallery images, car-listing photos, sell-request photos. Uploads go through `lib/services/storage.ts` (client-side resize/compress to max width, returns URL+path); deletions use the stored `path`. (`deleteImage` currently takes `_path` — see §22.)

---

# 8. DATA MODELS

All in `lib/types.ts` (685 lines) unless noted. Full field lists:

**User** — uid, name, email, phone?, photoURL?, notificationPrefs? {promotions, serviceReminders, membershipReminders, whatsapp: boolean}, role: customer|employee|admin, employeeId?, notes? (admin CRM), tags?, createdAt?, updatedAt?. (Referral code stored on the profile ad hoc by `getMyReferralCode`.)

**Vehicle** — id, name, registrationNumber, category: Hatchback|Sedan|Compact SUV|Full SUV|Luxury, color, notes?, createdAt.

**Service** — id, category: PPF|Washing|Ceramic|Coating, name, brand|null, price, duration (min), warranty|null, description, popular, active, order, createdAt.

**Booking** — id, userId/Name/Phone/Email, vehicleId/Name/RegNo, serviceId/Name/Category/BasePrice, serviceDurationMinutes?, pickupDropRequired + pickupDropFee (legacy), pickupRequired?/dropRequired? (₹50 per leg)/pickupAddress?, totalAmount, scheduledDate (YYYY-MM-DD), scheduledTime (HH:mm), status: `pending → confirmed → vehicle_received → in_progress → quality_check → ready_for_delivery → completed | cancelled`, paymentMethod: upi|cash, paymentStatus: pending|verified|failed, transactionId?, adminNotes?, discount? (BookingDiscount), invoiceId?, **jobId?** (permanent 1:1 operational link set at check-in), usedMembershipWash?/membershipId?, cancelledAt?, rejectionReason?, noShow?, createdAt, updatedAt.

**BookingDiscount** — source: membership|promo, promoId?, label, amount. (Best-of, never stacked.)

**Subscription** — id, userId/Name/Email/Phone, plan: Silver|Gold|Platinum, status: active|expired|cancelled|pending, startDate, endDate (start+30d), washesTotal, washesUsed, paymentMethod, transactionId?, adminNotes?, timestamps. **MembershipPlanConfig** catalogue (`MEMBERSHIP_PLANS`): Silver ₹1,499 / 4 washes / 10% off; Gold ₹2,999 / 8 / 15%; Platinum ₹5,999 / 16 / 20% + perks lists. **MembershipState** (derived) — subscription, isActive, isExpired, washesRemaining, daysRemaining, planConfig.

**Promo** — id, code (uppercase), label, type percent|flat, value, scope: all | {category, categories[]} | {services, serviceIds[]}, target: all | {customers, userIds[]}, validFrom/validTo, usageLimitTotal?, usageLimitPerCustomer?, usedCount, autoApply, active, timestamps. **PromoRedemption** — promoId, userId?, customerPhone?, bookingId?, jobId?, discountAmount, createdAt.

**Employee** — id, name, phone, email? (enables personal sign-in), authUid?, role: detailer|washer|manager|helper, pinHash (SHA-256), active, salary: {type monthly|per_day, monthlyBase?, perDayRate?}, joinedAt, timestamps.

**AttendanceRecord** — id = `{date}_{employeeId}`, employeeId/Name, date, checkInAt, checkOutAt?, status: present|half_day|leave, note?, breaks?: [{startAt, endAt?}], checkInMeta?: {lat, lng, accuracy, device, ip}, audit: reopenedById/Name, forcedOutById/Name, editedById/Name.

**PayrollRecord** — id = `{month}_{employeeId}`, employeeId/Name, month, daysPresent, halfDays, leaves, baseAmount, advances[]/deductions[]: {amount, date, note?}, netPayable, status draft|paid, paidAt?, paidVia?, timestamps.

**Job** — id, source: walk_in|booking, bookingId?, customerId? (phone-matched), customerName/Phone, vehicleName/RegNo, serviceItems: [{serviceId, serviceName, category, price-at-sale}], bay?: 1|2|3, status: `checked_in → in_progress → quality_check → ready_for_delivery → completed | cancelled` (completed = delivered, payment-gated), discount?, subtotal, totalAmount, paymentMethod?, paymentStatus pending|collected (derived: collected ⇔ amountPaid ≥ totalAmount), transactionId?, payments?: PaymentRecord[] (ledger: id, amount, method, transactionId?, receivedById/Name, at, date), amountPaid? (denormalized Σ), invoiceId?, createdByEmployeeId/Name, assignments: JobAssignment[] {employeeId/Name, role lead|helper, assignedAt/ById/ByName, removedAt?/removedById?} (reassignment = soft-remove+add), assignedIds[] (denormalized active, for array-contains + rules), statusHistory: [{status, at, byEmployeeId/Name, note?}], photos?: [{url, path, kind before|during|after}], notes? (staff-only), date (YYYY-MM-DD board bucket), createdAt/updatedAt/completedAt?.

**Quote** — id, customerName/Phone, customerId?, vehicleName, serviceCategory, items: [{name, detail?, amount}], total, validUntil?, status: requested|draft|sent|accepted|declined|expired, notes? (internal), customerMessage?, jobId? (set when started), createdById?/Name?, timestamps.

**FollowUpTask** — note, dueDate, customerName?/Phone?, refType? quote|job|booking + refId?, done, createdByName, createdAt, completedAt?.

**CustomerFeedback** — rating 1–5, comment?, invoiceId?, customerName?/Phone?, createdAt.

**Expense** — amount, category (rent|electricity|water|materials|equipment|maintenance|marketing|transport|refreshments|other), note?, paidVia cash|upi|bank, vendor?, date, month (report bucket), enteredById/Name, createdAt.

**DailyClosing** — id/date = YYYY-MM-DD, cashExpected, upiExpected, cashCounted, variance (counted−expected), cashExpenses, note?, jobsCompleted, closedById/Name, closedAt.

**Invoice** — id, invoiceNumber (`AMZ-YYYY-NNNN`), jobId?/bookingId?/customerId?, customerName/Phone, vehicleName/RegNo, lineItems [{name, qty, unitPrice, amount}], subtotal, discount? {label, amount}, gst? {rate, amount, gstin?} (off by default: `GST_ENABLED=false`), total, paymentMethod, paymentStatus pending|paid, photos? (copied from job), publicToken, createdByEmployeeId?/Name?, createdAt.

**InventoryItem** — name, category ppf_film|ceramic|wash|interior|other, unit ml|ft|pcs|gm, stockQty, lowStockThreshold, costPerUnit, active, timestamps. **InventoryTxn** — itemId/Name, type purchase|consumption|adjustment, qtyDelta (+/−), refType? job|booking + refId?, note?, costTotal?, byEmployeeId?, createdAt. **ServiceRecipe** — serviceId (doc id), serviceName, items [{itemId, itemName, qty, unit}], updatedAt.

**CarListing** — title, make, model, year, price, kmDriven, fuel petrol|diesel|cng|electric, transmission manual|automatic, ownership (nth owner), color, regNo? (masked publicly), description, photos [{url, path}], status available|reserved|sold, featured, active, timestamps. **CarLead** — listingId/Title, type inquiry|viewing, userId?, name, phone, message?, preferredDate?/Time?, status new|contacted|closed, adminNotes?, timestamps. **SellRequest** — userId, name, phone, make, model, year, kmDriven, expectedPrice?, description?, photos, status, adminNotes?, timestamps.

**ActivityEvent** (`lib/services/activity.ts`) — type (status/assignment/photo/payment/invoice/message/delivery…), refs bookingId?/jobId?/customerId?, actor, text, createdAt. **WalkinCustomer** (`walkinCustomers.ts`) — phone-keyed: name, vehicle info, visit count, total spend, timestamps. **ReferralRecord** (`referrals.ts`) — referrerUid, referredUid, code, promo ids, createdAt. **GalleryImage** — url, path, category, caption?, active, createdAt. **StepData** — booking wizard scratch state.

---

# 9. BUSINESS WORKFLOWS

## 9.1 Online booking (customer)
```
Vehicle → Service → Schedule → Review → Payment → Done
```
1. Pick/add a garage vehicle.
2. Pick category (Washing/Ceramic/Coating/PPF) and service (Firestore catalogue, falls back to `STATIC_SERVICES`).
3. Pick date/time — client POSTs `/api/availability` for the next 14 days; full slots/dates disabled. Multi-day services (≥600 min) offer only 09:00.
4. Review: pickup/drop legs (₹50 each), address; discount computed = **best-of** membership % vs eligible promo (auto-apply or manually entered code — manual beats auto); active members may instead use a **membership wash** (wash services only; price → 0, deducted server-side at confirm).
5. Payment: UPI (shows UPI id `NEXT_PUBLIC_UPI_ID`, customer enters transaction id, paymentStatus `pending` until admin verifies) or cash.
6. `createBooking` → status **`pending`** → fires `/api/notify/event booking_created` → owner notified. Promo redemption recorded, `usedCount` incremented.

## 9.2 Approval → check-in → execution → delivery
```
pending ──approve──▶ confirmed ──check-in──▶ vehicle_received + Job(checked_in)
   │reject(reason)                              │
   ▼                                            ▼ (Job drives from here)
cancelled                     in_progress → quality_check → ready_for_delivery
                                            ──payment-gated──▶ completed (delivered)
```
- Admin approves in `/admin/office` or `/admin/bookings/[id]`; reject writes `rejectionReason` and notifies the customer (in-app + push). Confirmed no-shows can be marked `noShow`.
- **Check-in** (`createJobFromBooking`, idempotent): creates the Job (operational truth), backlinks `booking.jobId`; the Booking (commercial truth) is never replaced — permanent 1:1. Booking status mirrors job stages.
- Stage advances (`updateJobStatus`) append `statusHistory` entries (automatic timeline — no manual timers) and write `activity` events.
- Assignment: admin sets lead/helpers (`setJobAssignees`); history preserved via soft-remove.
- Photos (before/during/after) attach at any stage and flow onto the invoice.
- **Delivery**: `completed` only when `amountPaid ≥ totalAmount` (payment-gated handover), `completedAt` stamped; inventory consumption fires (below); walk-in spend recorded to `walkinCustomers`.

## 9.3 Walk-in
`WalkInFlow` (shared by `/store/new` and `/admin/walkin`): capture name+phone (phone-matches an existing account via `findCustomerByPhone`; else upserts `walkinCustomers/{phone}`), vehicle, one-or-more service items (price editable at kiosk), optional membership/promo discount (system-computed only) → `createWalkInJob` (status `checked_in`, creator = kiosk/personal employee, date = today) → appears on the Floor board.

## 9.4 Payments & invoicing
- **Ledger payments** (`addJobPayment`): any number of partial/advance payments, each recording who/how much/when/method; `amountPaid` denormalized; `paymentStatus` flips to `collected` at full cover. Legacy one-shot `markJobPayment` remains.
- **Invoice** (`createInvoiceForJob` / `createInvoiceForBooking`): Firestore transaction bumps `counters/invoices`, writes invoice `AMZ-YYYY-NNNN` with line items/discount/optional GST/photos/publicToken, backlinks `invoiceId`. Shared via WhatsApp deep link to `/invoice/{id}?t={token}`.
- **Review ask**: public invoice shows `RatingCard` — 4–5★ redirects to the Google review URL; 1–3★ writes private `feedback`. Plus a `buildReviewAskLink` WhatsApp message.
- **Receivables**: completed jobs with `amountPaid < totalAmount` (`getReceivables`); aged >3 days → daily-cron admin alert.

## 9.5 Membership
Purchase (customer) → `pending` → admin verifies payment → `active` (30 days, N washes). Wash deduction is transactional server-side (`/api/membership/deduct-wash`) from booking confirm or kiosk (staff pass `forUserId`). Expiry is computed client-side for display and **persisted only by admin** (`expireLapsedSubscriptions` on the admin subscriptions page load). Customer self-service is limited to cancel.

## 9.6 Attendance (see §15) · 9.7 Payroll
Payroll month = attendance-derived: monthly salary pro-rata `base × (present + half×0.5) / daysInMonth`, or `perDayRate × (present + half×0.5)` (`payrollMath.computeMonth`, unit-tested). Admin adds advances/deductions → `netPayable` → draft → mark paid (upi/cash) on `/admin/employees/[id]`.

## 9.8 Quotes
Customer "get me a price" (from the booking page, total forced 0, status `requested`) or staff-created draft → itemized lines → `sent` via WhatsApp deep link → `accepted` (→ start as Job, `jobId` linked) / `declined` / `expired`. Fires `quote_requested` owner notification.

## 9.9 Inventory
Admin maintains items + per-service **recipes**. On job completion staff either auto-consume recipe quantities (`consumeForService`, tolerant of missing recipes) or adjust to **actuals** (`getRecipePrefill` → `consumeActuals`). Purchases/adjustments are txns; low stock (≤ threshold) alerts via daily cron.

## 9.10 Expenses & Daily Close
Expenses entered by admin (category, paidVia, vendor, month bucket). Daily Close: `computeDayTakings` sums the day's payment ledger by method → expected cash/UPI; owner counts drawer, records variance + cash expenses + note → `dailyClosings/{date}` (one per day).

## 9.11 Reports — see §16. · 9.12 Gallery — admin uploads; public homepage reads.
## 9.13 Promotions
Admin creates percent/flat promos with scope/target/validity/limits/auto-apply. Eligibility checked client-side (`isPromoEligible`); redemption recorded; per-customer limits checked against own `promoRedemptions`. Referral programme mints two targeted flat ₹200 promos (90-day validity) per successful claim, server-side.

## 9.14 Marketplace
Buy: public browse → listing detail → inquiry or viewing-request lead → admin works leads (new→contacted→closed) → listing status available→reserved→sold. Sell: customer submits request with photos → admin lead flow. Customers save favourites.

## 9.15 Retention (automated CRM)
Daily cron per customer, capped at **2 notifications/user/day**, idempotent per kind+day (`ret_{uid}_{kind}_{date}` doc ids), honoring notificationPrefs, logged to `notificationLog`: membership expiry ≤3 days; washes-remaining nudge; protection-warranty expiry (parses warranty strings; defaults PPF 5y / Ceramic 2y / Coating 180d); win-back for lapsed visitors.

---

# 10. STUDIO OPERATIONS (current flow)

**Screens**: `/admin` Studio Operations Board (full view) · `BayStrip` on `/admin/schedule` (compact) · `/store/board` kanban (desk view). All three derive from the same sources so they cannot disagree.

**The single brain — `components/studio/useFloor.ts`**: derives, from live today's jobs (`subscribeTodaysJobs`) + service catalogue + `statusHistory` timestamps + `studioConfig`:
- vehicles physically occupying each bay (`in_progress`), with expected end (service durations vs elapsed; negative = late),
- the waiting queue (checked-in, not in a bay; oldest first),
- QC and ready tails, technician states (working/break/idle from jobs+attendance),
- capacity math: done/planned per bay, average delay, next free bay, look-ahead for tomorrow's bookings.

**Bays**: exactly **two schedulable resources** — Wash Bay (capacity 1, configurable via `studioConfig.washCapacity`, studio runs 1) and Protection Bay (capacity 1, fixed). `categoryToResource`: `Washing`→wash, everything else→protection. A legacy `Job.bay: 1|2|3` field and `BAYS=[1,2,3]` constant persist from the older 3-bay model (bay is still writable by assigned staff per rules) but scheduling ignores them — commit `1f059fa` "Kill service-specific bay logic — the two physical resources are the only truth."

**Scheduling/timeline**: pure engine in `lib/availability.ts` (see §14). Working day 09:00–19:00 (600 min); multi-day services spill across working days (3-day PPF blocks the protection bay Monday–Wednesday); 15-min turnover buffer; 30-min occupancy buckets and start granularity.

**Employees on the floor**: kiosk PIN or personal sign-in; assignment lead/helper per job; every action attributed by employee id/name in statusHistory, payments, activity.

**Colour law** (BayStrip/board): green = available · orange = ending soon (<60 min) · red = late.

**Current limitations (factual)**: durations are catalogue-level (per service, not per vehicle size); walk-in occupants start at `createdAt` clamped to opening, duration = Σ item durations; occupancy lookback capped at 6 days (`LOOKBACK_DAYS`, longest service ≈3 days + margin); multi-day expansion hard-capped at 14 working days; no holidays/closures model — every day is a working day.

---

# 11. COMPONENT MAP

## `components/ui/` — 23 design-system primitives
AppTile · AnimatedGradientBg · BeforeAfterSlider (homepage proof) · **CommandPalette** (⌘K, fuzzy filter, full keyboard, used by admin layout) · ConfirmDialog · CountUp · EmptyState · ErrorState (with retry) · GaugeRing · GlassCard · GradientButton · HeroMedia · Input · LiquidOrb · PageHeader · ParallaxSection · SafeArea · **ServiceIcon** (canonical category→glyph) · Sheet (vaul bottom sheet) · Skeleton · SlideToAction (homepage slide-to-book) · StatCard · StatusChip · WhatsAppFloat · Wordmark.

## Domain components
| Component | Purpose | Used by |
|---|---|---|
| `workspace/parts.tsx` (394) | **Shared operational-workspace building blocks**: job stage rail, team assignment, photos, activity timeline, layout primitives — the single implementation for both workspaces | `/admin/bookings/[id]`, `/admin/jobs/[id]` |
| `workspace/BayStrip.tsx` (168) | Compact two-resource floor strip w/ live occupancy + look-ahead; draws only, derivation in useFloor | `/admin/schedule` |
| `studio/useFloor.ts` (169) | The floor-derivation hook (§10) | `/admin`, BayStrip |
| `intake/WalkInFlow.tsx` (388) | The one walk-in intake flow | `/store/new`, `/admin/walkin` |
| `store/JobCard.tsx` | Kanban job card | `/store/board` |
| `store/PinPad.tsx` | Kiosk PIN entry | `/store` |
| `invoice/InvoiceDocument.tsx` | Print-friendly invoice (always light, print-to-PDF) | `/invoice/[id]`, admin invoice views |
| `invoice/RatingCard.tsx` | Public review capture (4–5★→Google, 1–3★→private feedback) | `/invoice/[id]` |
| `cars/CarCard.tsx`, `cars/PhotoUploader.tsx` | Listing card; multi-photo upload | `/cars`, `/dashboard/cars`, admin cars, sell-car |
| `pwa/InstallPrompt.tsx` | A2HS prompt | dashboard layout |
| `home/SmoothScroll.tsx` | Lenis on landing page only, reduced-motion aware | `/` |
| `ThemeProvider.tsx` | Applies zustand theme to `<html>` class/data-theme | root layout |

---

# 12. PAGE BREAKDOWN (data contracts)

Line counts in §3/§25 indicate weight. Key pages beyond what §3 covers:

- **`/dashboard` (469)** — reads store-cached vehicles/bookings/notifications (loaded once per uid by the layout, bookings kept live by `subscribeUserBookings`), membership via `getUserSubscription`; links to every non-tab page. Writes: none.
- **`/dashboard/booking` (1,085; largest file)** — reads services, `/api/availability`, membership, eligible promos; writes booking, promo redemption, optional wash deduction (API), quote request; fires notify event. Dialogs: quote sheet, promo entry, UPI copy.
- **`/dashboard/subscriptions` (732)** — plan cards, purchase sheet (UPI/cash → pending), usage ring, cancel confirm.
- **`/admin/bookings/[id]` (454)** — reads booking + job + activity + employees + invoices; writes approve/reject/no-show/reschedule/notes/check-in (creates job)/stage/assign/photos/payments/invoice. Sections without data models (checklist, materials sheet, QC checklist, comments, WhatsApp log) are intentionally not rendered yet.
- **`/admin/schedule` (461)** — reads bookings for visible dates + today's jobs + employees; writes reschedule (drag), reassign (drag). Renders BayStrip.
- **`/store/job/[id]` (526)** — stage advance, photo capture, ledger payment sheet, membership-wash deduct (API), invoice create + WhatsApp share, delivery confirm (payment-gated), notes.
- **`/store/board` (352)** — live kanban + arrivals rail + my-shift controls + payments-pending counter + daily-close shortcut (admin session only); stream-down detection with manual resubscribe.
- **`/admin/employees/[id]` (387)** — attendance month grid, `employeeWashStats`/`employeeCategoryStats`, payroll computation UI.
- **`/admin/customers/[id]` (416)** — merges bookings + jobs + invoices + subscriptions into one timeline; rail edits `users.notes`/`tags`; per-customer promo targeting.
- **`/admin/settings` (183)** — service CRUD + `seedServices()` (from STATIC_SERVICES) + wash-capacity setting (`setWashCapacity`).
- **`/admin/office` (196)** — `getAdminStats`, pending approvals, due tasks, receivables, low stock, leads counts.

---

# 13. SERVICES CATALOGUE

Categories: **PPF · Washing · Ceramic · Coating**. Firestore `services` is the runtime source; `STATIC_SERVICES` (lib/constants.ts) is the seed/fallback:

| Category | Service | Brand | Price ₹ | Duration | Warranty |
|---|---|---|---|---|---|
| PPF | Llumar Gloss | Llumar | 145,000 | 480 min | 5 yr |
| PPF | Llumar Platinum ★ | Llumar | 205,000 | 480 min | 10 yr |
| PPF | Llumar Valor | Llumar | 220,000 | 480 min | 12 yr |
| Washing | Regular Wash | — | 500 | 45 min | — |
| Washing | Premium Wash ★ | — | 1,000 | 60 min | — |
| Washing | Detail SPA ★ | — | 2,500 | 90 min | — |
| Washing | Dry Clean | — | 4,000 | 120 min | — |
| Washing | Roof Cleaning | — | 800 | 30 min | — |
| Washing | Headlight Buffing | — | 400 | 20 min | — |
| Ceramic | Kovalent Prolong | Kovalent | 10,000 | 480 min | 2 yr |
| Ceramic | Kovalent Graphene ★ | Kovalent | 12,000 | 480 min | 3 yr |
| Ceramic | Kovalent Borophene ★ | Kovalent | 14,000 | 480 min | 5 yr |
| Coating | Teflon Coating | — | 5,000 | 120 min | 6 mo |
| Coating | Glass Coating | — | 1,200 | 60 min | 3 mo |
| Coating | Maintenance Coat ★ | — | 4,500 | 90 min | 1 yr |

★ = `popular`. "Graphene"/"Borophene" are ceramic product names, not separate categories. "Correction" is referenced in bay-routing comments but has no catalogue entries. Business rules: pickup/drop ₹50/leg; membership discounts 10/15/20%; promos best-of with membership, never stacked; PPF/Ceramic typically go through the **quote** pipeline rather than fixed-price booking. Marketplace Buy/Sell is documented in §9.14.

---

# 14. SCHEDULING ENGINE (`lib/availability.ts`, 230 lines, pure)

- **Resources**: `wash` (capacity = `studioConfig.washCapacity`, min 1) and `protection` (capacity 1). `categoryToResource(category)`.
- **Working day**: 09:00–19:00 (`DAY_OPEN_MIN`/`DAY_CLOSE_MIN`), 600 min; `BUCKET=30` min occupancy resolution; `BUFFER_MIN=15` turnover held after every job.
- **Multi-day expansion** (`expandIntervals`): remaining duration spills to the next working day at 09:00; hard cap 14 days.
- **Candidate slots** (`candidateSlots`): every 30 min where `start + duration ≤ close`; durations ≥600 min → `['09:00']` only.
- **Occupancy** (`buildOccupancy`): per-resource `Map<date, count[20buckets]>` over occupants (job+buffer). `slotBlocked` = any bucket in the expanded span at/over capacity.
- **Core query** (`computeAvailability`): per requested date, which slots are full and which dates are entirely full.
- **Occupant mapping**: `bookingToOccupant` (active statuses: pending…ready_for_delivery; start = scheduledTime; duration = `serviceDurationMinutes` ?? category default) and `walkInJobToOccupant` (walk-ins only — booking-linked jobs count via their booking; start = createdAt clamped to open; duration = Σ item durations).
- **History**: `LOOKBACK_DAYS=6`, `lookbackDates()` — a PPF started up to 6 days ago can still occupy today.
- **Consumers**: `/api/availability` (server, admin SDK — the only path customers get availability), and staff surfaces (`useFloor`/BayStrip) directly.
- **Edge cases encoded**: cancelled/rejected bookings free slots automatically (excluded from occupancy); pending bookings **do** hold capacity; the 8h ceramic can start 09:30 after a buffered handover (30-min granularity kept even for long jobs).
- **Legacy**: `lib/config/bookingConfig.ts` (60-min slots, `SLOT_CAPACITY=3`) and `lib/utils.generateTimeSlots/getAvailableDates` predate the engine; `getAvailableDates(14)` still supplies the wizard's date strip; the slot-capacity model is superseded.

---

# 15. ATTENDANCE (`lib/services/attendance.ts`, `/store/attendance`)

- Shift constants: 09:00–19:00, `LATE_GRACE_MIN=15`.
- **Check-in**: doc id `{date}_{employeeId}` ⇒ idempotent (double-tap returns the open record); checking in after checkout throws `ShiftClosedError` — only a manager reopen clears it. `captureAttendanceMeta` best-effort records GPS lat/lng/accuracy, trimmed user-agent, IP; never blocks.
- **Breaks**: `startBreak`/`endBreak` manage `breaks[]` windows (open break = missing `endAt`); no-ops when invalid.
- **Checkout** closes the shift. **Manager controls** (admin session): `forceCheckOut`, `reopenAttendance`, `correctAttendanceTimes` (HH:mm on the record's own date), `overrideAttendanceStatus` (half_day/leave/fix missed check-in, creates doc if needed) — all stamped with the acting manager's id/name.
- **Derived**: `shiftMath` (worked/break minutes, late flag); `attendanceCsv` month export for payroll hours.
- **Payroll linkage**: §9.7. Nobody ever types a time at check-in; corrections are audited.
- Limitations (factual): GPS/IP capture is best-effort and unverified; one shift per day; no geofence enforcement.

---

# 16. REPORTS (`/admin/reports`) & BUSINESS INTELLIGENCE

Monthly, selectable month. All computed client-side from raw collections (bookings, jobs, payroll, inventoryTxns+items, expenses):

- **Revenue**: booking revenue (Σ completed bookings' totalAmount) + walk-in revenue (Σ completed jobs) with counts.
- **Costs**: salaries paid (payroll), inventory consumed cost (consumption txns × item costPerUnit), expenses total.
- **Net profit** = revenue − salaries − materials − expenses (label verbatim).
- **Throughput** (`studioThroughput` in `washMetrics.ts`): average turnaround, peak start hours, per-resource busy share.
- CSV download of the report rows.

Other BI surfaces: `washDayStats` (today's wash pulse on the board), `employeeWashStats`/`employeeCategoryStats` (per-employee averages on the employee page), `getAdminStats` (office strip), receivables list, daily-closing variance history. **No chart library** — everything is tiles/lists/CSV.

---

# 17. CUSTOMER APP JOURNEY

Homepage `/` (dark, cinematic, slide-to-book) → `/auth/login` (Google) → `/dashboard` home (active-booking live tracker, membership card, offers) → **Book** (§9.1) → live status via `subscribeUserBookings` (steps: `getStatusStep`) → completion → invoice link + review ask. Garage manages vehicles; History cancels (>4h rule)/reschedules; Membership purchase/usage; Offers lists targeted promos; Refer shares `?ref=` links (both sides earn ₹200 promos); Notifications inbox + push opt-in; Profile edits prefs/theme; Marketplace browse/save/inquire (`/cars` public, `/dashboard/cars` in-app) and Sell-car. PWA installable, offline fallback page.

---

# 18. ADMIN APP — summarized in §3/§4; owner-only powers

Everything under `/admin` requires role `admin`. Owner-exclusive (not even employees): payroll, expenses, daily close, reports, employee/service/promo/inventory-item/listing management, assignment changes, manual amounts, subscription activation, booking approval/rejection, attendance overrides, settings. Financial tools: invoices, expenses, close, reports, receivables, payroll. ⌘K palette is admin-only.

---

# 19. STUDIO / DESK (`/store`)

**Why it exists**: a tablet-first shared-device surface for the physical floor — distinct chrome, kiosk PIN identity, zero owner-money actions. **Pages**: `/store` (lock), `/store/board`, `/store/new`, `/store/job/[id]`, `/store/attendance`.

**Code sharing vs duplication**: intake (`WalkInFlow`), job stream (`subscribeTodaysJobs`), arrivals (`getBookingsForDates`), job services (`lib/services/jobs.ts`) are single-sourced. **Deliberate overlaps with Admin** (per IA doc): `/store/job/[id]` vs job handling inside `/admin/bookings/[id]` — different actor mid-task (technician on tablet vs owner on the commercial record), same services underneath; the board (kanban) vs Studio Board (`useFloor` full view) — same stream, different presentation intent. Data flows: everything through the barrel services to the same collections; kiosk identity only decorates writes (`byEmployeeId/Name`). Daily close is reachable from the desk rail but the page itself is admin-session-gated.

---

# 20. OWNER AREA

There is **no separate `/owner` route** — "Owner" is the OWNER mode of the admin sidebar (groups TODAY/WORK/CUSTOMERS/BUSINESS/TEAM/MARKETING/SETTINGS), home `/admin/office`. Capabilities: intelligence strip, approvals, follow-up tasks, full financial suite (§18), CRM (Customer 360, walk-in CRM, leads), marketing (promos, gallery, marketplace), team (employees, payroll, attendance oversight), catalogue + resource settings.

---

# 21. DUPLICATION AUDIT (documentation only)

1. **Availability logic ×2 generations**: `lib/availability.ts` (current engine) vs `lib/config/bookingConfig.ts` (60-min slots, `SLOT_CAPACITY=3`) and `lib/utils.generateTimeSlots` — the legacy pair still exists; wizard dates come from `lib/utils.getAvailableDates`.
2. **Bay models ×2**: two-resource model (engine, useFloor, studioConfig) vs legacy `Job.bay: 1|2|3` field, `BAYS=[1,2,3]` constant, and the `bay` key still in the employees' allowed-update whitelist in rules.
3. **Marketplace browse ×2**: `/cars` (public) and `/dashboard/cars` (in-app) render the same listings with different chrome; both use `CarCard`.
4. **Job workspaces ×2 (intentional)**: `/store/job/[id]` and `/admin/bookings/[id]`+`/admin/jobs/[id]`; admin pair shares `workspace/parts.tsx`; the store page has its own layout.
5. **Job status vs booking status**: booking-linked jobs mirror stage changes onto both documents — two records intentionally carry overlapping state (commercial vs operational truth).
6. **Denormalized copies by design**: user name/phone/email on bookings/jobs/subscriptions/invoices; `assignedIds` beside `assignments`; `amountPaid` beside `payments[]`; job `photos` copied onto invoices; `serviceName/category/price` frozen onto jobs/bookings.
7. **Duplicate customer identity stores**: `users` (accounts) and `walkinCustomers` (phone-keyed), reconciled by phone match at intake.
8. **Wash-deduction paths ×2 clients** (booking wizard + kiosk) converging on one API.
9. **Redirect stubs**: `/admin/workspace`, `/admin/jobs` → `/admin`; walk-in wrappers `/store/new` + `/admin/walkin` around one component.
10. **Notification fan-out ×3 channels** (in-app doc, FCM push, WhatsApp link/API) each fired separately by callers.
11. **Payment recording ×2 APIs**: `addJobPayment` (ledger) and legacy `markJobPayment` (one-shot).
12. **Retention triggers ×2**: cron sweep + manual `/api/retention/run`, same `runRetentionForUser`.

---

# 22. DEAD / LEGACY CODE (factual)

- `lib/config/bookingConfig.ts` — superseded slot model (`SLOT_CAPACITY=3`, `calculateRequiredSlots`) not used by the current engine.
- `BAYS = [1,2,3]` (`storeConfig.ts`) and `Job.bay` — remnants of the 3-bay model; scheduling ignores them.
- `lib/reviews.ts` — explicitly marked **scaffold data** awaiting Google Places wiring.
- `lib/services/storage.ts:deleteImage(_path)` — underscore-prefixed param; effectively a no-op signature for deletion.
- `adminLogin` / `resetPassword` (auth service) — no UI path uses email/password sign-in.
- `context/AuthContext.tsx` exports a context whose value is `null` — consumed only for its provider side effects; nothing reads the context value.
- `pickupDropRequired`/`pickupDropFee` on Booking — legacy combined field kept for old records (superseded by per-leg fields).
- `docs/` planning files (MASTER_PLAN, UPGRADE_PLAN, ROADMAP, PRD_ASSESSMENT) describe earlier states; INFORMATION-ARCHITECTURE.md is current as of 2026-07-17.
- `scripts/backfill-assignments.mjs` — one-time completed migration.
- `checkAndExpireSubscription` — client-side computed check retained though `getUserSubscription` already computes expiry.
- Homepage history: all 3D/WebGL code deleted (`three` uninstalled); no dead 3D remains — noted so the next architect doesn't hunt for it.

---

# 23. DEPENDENCY GRAPH

```
Pages ──▶ lib/firebaseService (barrel) ──▶ lib/services/* ──▶ Firestore collections
                                        └─▶ lib/availability (pure) ◀─ /api/availability
API routes ──▶ lib/server/{firebaseAdmin, notify, retention} ──▶ admin SDK

context/AuthContext ──▶ services/auth + /api/employee/link ──▶ zustand store
All layouts/pages ──▶ useAppStore (user gate, kiosk identity, theme)

/admin (board) ──▶ useFloor ──▶ subscribeTodaysJobs + services catalogue + studioConfig
/admin/schedule ──▶ BayStrip ──▶ useFloor          /store/board ──▶ subscribeTodaysJobs + attendance
Workspaces ──▶ workspace/parts ──▶ jobs + activity + employees + invoices services
Booking wizard ──▶ bookings + pricing + promos + subscriptions services + /api/{availability,membership,notify}
Reports ──▶ bookings + jobs + payroll + inventory + expenses + washMetrics
Retention/cron ──▶ subscriptions + bookings + notifications + notificationLog + inventoryItems + jobs
```
Service→collection ownership is tabulated in §7. Hooks→context: only `useFloor` (jobs stream) and the store hook; there are no other custom hooks or contexts.

---

# 24. CURRENT PROBLEMS (observations only)

1. Two generations of availability logic coexist (§21.1); the booking wizard mixes `getAvailableDates` (utils) with the engine API.
2. `Job.bay` remains writable by assigned employees per rules while the scheduler ignores bays.
3. Route protection is entirely client-side (no middleware); page HTML/JS for admin routes ships to any browser, with data protected only by Firestore rules and token-checked APIs.
4. `bookings` status is written from at least five places (wizard, customer cancel/reschedule, admin approve/reject/no-show, check-in, job-stage mirror). `jobs` is written from kiosk job page, admin workspaces, schedule drag, board, walk-in flow.
5. Subscription expiry is displayed as computed client-side but persisted only when an admin opens the subscriptions page — the stored status can lag reality.
6. Promo per-customer usage limits are enforced client-side (rules allow any +1 `usedCount` bump); redemption honesty relies on the client.
7. Payment "verification" for UPI is manual admin trust of a typed transaction id — no gateway integration.
8. Homepage reviews are scaffold data (flagged in code).
9. Kiosk PIN hashes are unsalted SHA-256 and readable by any staff account (roster read).
10. `feedback` and `carLeads` allow unauthenticated creates (shape-validated but rate-unlimited at the rules layer).
11. Reports load whole month collections client-side and aggregate in the browser.
12. Customer identity is split across `users` and `walkinCustomers` with phone-match reconciliation only at intake.
13. A previously leaked admin key still requires console rotation (deploy memory; repo history itself re-initialized clean 2026-07-15).
14. Dashboard layout loads bookings both once (`getUserBookings`) and via subscription (`subscribeUserBookings`) — double initial read.
15. `theme` persists via zustand but `/` forces dark and admin/store are always dark — the toggle affects only customer surfaces.

---

# 25. FILE TREE (application only)

```
AutoModz/
├─ app/
│  ├─ layout.tsx (78) · page.tsx (498) · error.tsx · not-found.tsx · globals.css
│  ├─ auth/login/page.tsx (147)
│  ├─ offline/page.tsx
│  ├─ firebase-messaging-sw.js/route.ts
│  ├─ api/ availability · cron/daily · employee/link · invoice/[id] ·
│  │       membership/deduct-wash · notify/event · push/send · referral/claim ·
│  │       retention/run · whatsapp/send        (each route.ts)
│  ├─ dashboard/ layout (158) · page (469) · booking (1085) · history (480) ·
│  │       vehicles (349) · cars (90) · sell-car (126) · subscriptions (732) ·
│  │       offers (116) · refer (97) · notifications (222) · profile (256)
│  ├─ cars/ page (126) · [id]/page (220)
│  ├─ invoice/[id]/page (75)
│  ├─ admin/ layout (379) · page (418) · schedule (461) · bookings (123) ·
│  │       bookings/[id] (454) · walkin (8) · jobs (6→redirect) · jobs/[id] (202) ·
│  │       workspace (6→redirect) · office (196) · quotes (317) · customers (143) ·
│  │       customers/[id] (416) · subscriptions (120) · invoices (128) ·
│  │       expenses (208) · close (140) · reports (205) · inventory (328) ·
│  │       inventory/recipes (144) · employees (278) · employees/[id] (387) ·
│  │       promos (272) · gallery (112) · cars (285) · cars/leads (153) ·
│  │       settings (183) · vehicles/[reg] (188)
│  └─ store/ layout (184) · page (114) · board (352) · new (7) ·
│          job/[id] (526) · attendance (292)
├─ components/  ui/ ×23 · workspace/{BayStrip,parts} · studio/useFloor ·
│          intake/WalkInFlow · store/{JobCard,PinPad} · invoice/{InvoiceDocument,RatingCard} ·
│          cars/{CarCard,PhotoUploader} · pwa/InstallPrompt · home/SmoothScroll · ThemeProvider
├─ context/AuthContext.tsx
├─ lib/  types (685) · availability (230) · store (72) · utils (131) · constants ·
│        reviews · firebase · firebaseService (barrel) ·
│        config/{bookingConfig,storeConfig} · server/{firebaseAdmin,notify,retention} ·
│        services/ ×26: activity admin attendance auth bookings cars employees expenses
│          gallery inventory invoices jobs notifications payroll payrollMath pricing
│          promos push quotes referrals services storage studioConfig subscriptions
│          tasks vehicles walkinCustomers washMetrics
├─ __tests__/{payroll,pricing,utils}.test.ts · scripts/backfill-assignments.mjs
├─ docs/ ×7 · public/ (sw, manifest, icons, wordmarks)
├─ firestore.rules (278) · firestore.indexes.json · firebase.json · vercel.json
└─ next.config.js · tailwind.config.js · jest.config.js · tsconfig.json · package.json
```

---

# 26. EXECUTION FLOW (end to end)

```
/ (marketing) ─slide-to-book─▶ /auth/login ─Google─▶ ensureUserProfile
  └▶ linkEmployeeRole (/api/employee/link) ─▶ role routing:
       admin ▶ /admin · employee ▶ /store · customer ▶ /dashboard
customer: /dashboard ▶ /dashboard/booking (availability API) ▶ booking pending
  ▶ owner notified (in-app+push) ▶ admin approves (office/workspace) ▶ confirmed
arrival: desk sees arrivals rail ▶ check-in ▶ Job(checked_in) linked 1:1
floor:   assign ▶ in_progress (occupies bay) ▶ quality_check ▶ ready_for_delivery
money:   ledger payments (any time) ▶ paid-in-full ▶ deliver ▶ completed
  ▶ inventory consumed ▶ invoice (AMZ-####) ▶ WhatsApp share ▶ /invoice/[id]?t=
  ▶ RatingCard: 4–5★ Google · 1–3★ private feedback
close:   /admin/close (drawer vs ledger) · nightly /api/cron/daily (retention,
         low stock, receivables, pending memberships) · month: /admin/reports
staff:   /store check-in shift ▶ breaks ▶ checkout ▶ payroll month ▶ paid
logout:  signOut ▶ /auth/login  (kiosk: 5-min auto-relock ▶ /store)
```

---

# 27. PROJECT SIZE

| Artifact | Count |
|---|---|
| Route pages | 45 (14 customer/public, 26 admin incl. 2 redirect stubs, 5 store) + error/not-found/offline |
| Layouts | 4 (root, dashboard, admin, store) |
| API routes | 11 (10 domain + FCM SW) |
| Components | 37 (23 ui + 14 domain) |
| Custom hooks | 2 (`useFloor`, `useAppStore`) |
| Contexts | 1 (AuthContext) |
| Service modules | 26 + 3 server + 2 config + barrel |
| Firestore top-level collections | 27 (+4 subcollections) |
| Composite indexes | 12 |
| TypeScript interfaces/models | ~45 (types.ts + service-local) |
| Providers | 2 (Auth, Theme) + Toaster |
| Tests | 3 suites |
| Approx. app source | ~15–16k lines TS/TSX |

---

# 28. FINAL SUMMARY

AutoModz is a single-tenant business operating system for one car-detailing studio in Ahmedabad, built as one Next.js 15 PWA over Firebase, presenting **three chrome-distinct operating modes**: a light customer app (`/dashboard` + public marketing/marketplace/invoice pages), a dark admin OS (`/admin`, split into STUDIO production and OWNER money/decision modes with a ⌘K palette), and a dark kiosk-style Front Desk (`/store`) with PIN-based shared-tablet identity.

The domain hinges on one deliberate duality: a **Booking is commercial truth** (what was sold, to whom, for how much, approval/payment state) and a **Job is operational truth** (what happens to the car on the floor). They link 1:1 at vehicle check-in and neither replaces the other; walk-ins are Jobs with no Booking. Every stage change is timestamped into `statusHistory`, from which all time intelligence (floor board, wash metrics, throughput reports) is *derived* — there are no manual timers. Money is a ledger (`payments[]` with denormalized `amountPaid`); delivery is payment-gated; invoices are numbered transactionally and shared as token-gated public pages that also harvest reviews (good ones to Google, bad ones privately).

Scheduling is a pure two-resource engine — Wash Bay ×1 and Protection Bay ×1, 09:00–19:00, 30-min buckets, 15-min buffers, multi-day spill — consumed server-side for customers (who may not read others' data) and directly by staff surfaces through one shared derivation hook (`useFloor`), so every floor view agrees. Security is enforced almost entirely in Firestore rules plus a handful of admin-SDK API routes for the mutations rules can't safely allow (role linking, wash deduction, referral promos, public invoice reads, notifications); page routing guards are client-side only. Supporting systems — memberships with server-side wash deduction, best-of discounts, quotes, inventory recipes with actuals, attendance with GPS capture and manager audit, attendance-derived payroll, expenses, daily cash close, monthly client-computed P&L, retention cron capped at two nudges per user per day, and a used-car marketplace — all write to a flat set of ~27 Firestore collections through a single barrel service layer.

Known seams an incoming architect should hold in mind: legacy slot/bay models still present but inert, client-trusted promo limits and UPI verification, split account/walk-in customer identity, admin-page-load-triggered subscription expiry, scaffold homepage reviews, and client-side aggregation for reports. The `docs/INFORMATION-ARCHITECTURE.md` file (2026-07-17) is the team's own current statement of the IA and matches the code as documented here.
