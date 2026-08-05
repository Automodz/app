# AUTOMODZ — MASTER COMPLETION CHECKLIST

The whole product, tracked as one operating system. Every capability has an
owner domain, a status and evidence. Percentages are derived from what is in the
repository today, not from intent.

**Legend** — `✅` complete and verified · `🟡` exists, incomplete or unmigrated ·
`🔴` missing entirely · `⚪` deliberately deferred

**Last audited:** this session, FINAL PRODUCTION AUDIT · `tsc` clean · lint 0 · 885 tests / 32 suites · production build clean

---

## 0 · Scoreboard

| Domain | Complete | Weight | Notes |
|---|---|---|---|
| 1 · Customer Application | **76%** | ▓▓▓▓▓▓▓▓░░ | + Welcome/First Run complete; Error Boundaries next |
| 2 · Studio Operations (Admin) | **72%** | ▓▓▓▓▓▓▓░░░ | Functionally rich, no design system, error handling thin |
| 3 · Studio Floor (Kiosk) | **80%** | ▓▓▓▓▓▓▓▓░░ | Works; mobile layout and error states weak |
| 4 · Marketing / Public Web | **85%** | ▓▓▓▓▓▓▓▓▓░ | Landing done; 3 destinations 404 |
| 5 · Backend & Data | **74%** | ▓▓▓▓▓▓▓░░░ | Rules excellent; no rate limiting, no schema validation |
| 6 · APIs | **62%** | ▓▓▓▓▓▓░░░░ | 16 routes, all authed; 0 validated, 0 throttled |
| 7 · Automations | **55%** | ▓▓▓▓▓░░░░░ | One daily cron; no Cloud Functions, no event triggers |
| 8 · Integrations | **70%** | ▓▓▓▓▓▓▓░░░ | 5 live; no payment gateway, no email |
| 9 · Platform Quality | **68%** | ▓▓▓▓▓▓▓░░░ | Strong tests + architecture; a11y and perf unaudited on admin |
| 10 · Mobile / iOS | **0%** | ░░░░░░░░░░ | No native target. Deferred by decision. |

**Weighted product completion: ≈ 63%**

---

## 1 · Customer Application

### 1.1 Surfaces

| # | Surface | Route | Status | Parity | Blocking gap |
|---|---|---|---|---|---|
| 1 | Public landing | `/` (signed out) | ✅ | 95% | 3 outbound links 404 |
| 2 | Login & auth | `/auth/login` | ✅ | 100% | — |
| 3 | Home | `/` (signed in) | ✅ | **100%** | — |
| 4 | Garage | `/garage` | 🟡 | ~40% | Vehicle switcher, media, add/edit car |
| 5 | Vehicle | `/vehicle` | 🟡 | ~45% | Media, edit, protection detail |
| 6 | Visit (live) | `/history/[id]` | 🟡 | ~35% | Stage rail, live photos, manage sheet |
| 7 | History / Timeline | `/history` | 🟡 | ~40% | Full record, invoice link, chapter view |
| 8 | Membership | `/membership` | 🟡 | ~35% | Join flow, plan selection, `createSubscription` |
| 9 | You / Profile | `/you` | ✅ | 100% | — |
| 10 | Booking (Studio) | `/studio` | 🟡 | ~30% | Availability, slots, promo, membership wash, idempotency |
| 11 | Welcome / first-run | `/welcome` | ✅ | **100%** | server-owned flag, `?step=` addressable, admin reset |
| 12 | Cars marketplace | `/cars` | ✅ | **100%** | — |
| 13 | Car detail + lead | `/cars/[id]` | ✅ | **100%** | — |
| 14 | Sell your car | `/dashboard/sell-car` | ✅ | **100%** | — |
| 15 | Public chapter (token) | `/chapter/[id]` | 🔴 | 0% | Whole surface missing |
| 16 | Invoice (token) | `/invoice/[id]` | ✅ | 100% | — |
| 17 | Offline fallback | `/offline` | ✅ | 100% | — |
| 18 | Error boundary | `app/error.tsx` | ✅ | 100% | reports to `/api/report` |
| 19 | Search / Command Palette | ⌘K, `?open=desk` | ✅ | **100%** | — |

### 1.2 Customer capabilities

| Capability | Status | Evidence |
|---|---|---|
| Google sign-in + profile bootstrap | ✅ | 27 parity assertions |
| Session cookie (httpOnly, server-readable) | ✅ | `/api/session` |
| Server-rendered rooms (no client Firebase) | ✅ | `perf/no-client-firebase.test.ts` |
| Ownership state machine (11 states) | ✅ | reconnected this session |
| Membership lifecycle | ✅ | `os/club` wired |
| Care proposals | ✅ | `os/proposal` wired |
| Timeline (forward + back) | ✅ | `os/timeline`, OS object |
| NextAction as engine intent | ✅ | `os/action` + `navigation/resolve` |
| Contextual expansion (Protection, Timeline) | ✅ | URL-addressable `?open=` |
| Contextual expansion (Membership, Chapter, Warranty) | 🔴 | — |
| Add / edit vehicle | 🔴 | `addVehicle`/`updateVehicle` exist, no UI |
| Media upload + gallery + viewer | 🔴 | services exist, no UI |
| Booking creation | 🟡 | server route done, UI not migrated |
| Reschedule / cancel visit | 🔴 | services exist, no UI |
| Push notifications (per device) | ✅ | wired in Profile → Notifications |
| Notification preferences (4 toggles) | ✅ | one store, honoured by retention |
| Referral share + claim | ✅ | claim at login, share in Profile |
| PWA install prompt | 🔴 | no UI |
| Offline awareness | ✅ | every room + both public surfaces; one `OfflineNote`, six copies removed |
| Account deletion | ✅ | `POST /api/account/delete`, erase + anonymise |
| Search / Command Palette (global) | ✅ | mounted in chrome, fed by `ServerRoom`; 56 assertions |
| Palette routes through one resolver | ✅ | `hrefForDestination`; zero route literals in the projection |
| Marketplace — browse, filter, share | ✅ | server-rendered, filters addressable, OG cards |
| Car enquiry / viewing request | ✅ | `POST /api/cars/lead`; studio notified both channels |
| Saved cars | ✅ | `POST /api/cars/save`; subcollection existed, had no writer |
| Sell your car + offer history | ✅ | `POST /api/cars/sell`; signed uploads under `sellRequests/{uid}/` |
| First arrival, once per customer | ✅ | `User.welcomedAt`, server-decided; localStorage flag deleted |
| First arrival — deep links + Back | ✅ | `?step=`, `?welcome=1`; every step a history entry |
| First arrival — admin / dev reset | ✅ | `POST /api/welcome/complete { reset }` |
| Notification permission, optional | ✅ | Apple 4.5.4 — skippable, nothing gated, reuses `enablePush` |

---

## 2 · Studio Operations (Admin)

24 surfaces, all functional. The gap is consistency, not capability.

| Group | Surfaces | Status |
|---|---|---|
| Board & schedule | `(board)`, `schedule`, `bookings`, `bookings/[id]`, `jobs/[id]` | ✅ |
| Customers & vehicles | `customers`, `customers/[id]`, `vehicles/[reg]` | ✅ |
| Workforce | `employees`, `employees/[id]`, `attendance` | ✅ |
| Money | `invoices`, `expenses`, `quotes`, `close`, `reports`, `subscriptions` | ✅ |
| Inventory | `inventory`, `inventory/recipes` | ✅ |
| Marketplace | `cars`, `cars/leads` | 🟡 zero inbound links |
| Growth | `promos`, `gallery` | 🟡 `promos` unreachable from nav |
| Intake | `walkin`, `office` | ✅ |
| Settings | `settings` | 🟡 3 undefined CSS vars |

### Admin debt (from the standing plan)

| Item | Status | Detail |
|---|---|---|
| Shared component vocabulary | 🔴 | ~570 inline style objects; no `Card`/`Table`/`Modal`/`Chip` |
| Row-list primitive | 🔴 | hand-written 9× |
| Stat tile | 🔴 | 8 variants |
| Loading skeleton | 🔴 | 19 hand-tuned copies |
| Modal | 🔴 | 5 competing mechanisms; 6 trap neither Esc nor scroll |
| Status colour | 🔴 | `in_progress` renders 4 colours on 4 screens |
| Error handling | 🔴 | 17 of 24 pages `.catch(() => {})` |
| Mobile layout | 🔴 | 15 of 24 use `md:` exactly once |
| Touch targets | 🔴 | 15 icon buttons at 36×36 (need 44) |
| Reachability | 🔴 | `/admin/cars` has zero inbound links |
| ⌘K palette | 🟡 | promises customers/actions, fed nav items only |

---

## 3 · Studio Floor (Kiosk)

| Capability | Status |
|---|---|
| PIN lock (`verifyPin`) | ✅ |
| Walk-in intake (4 steps) | ✅ |
| Today's jobs live board | ✅ |
| Mobile step labels | 🔴 `hidden sm:inline` — unlabelled circles on a phone |
| Offline behaviour | 🔴 |

---

## 4 · Marketing / Public Web

| Capability | Status |
|---|---|
| Landing: 5 sections, live pricing, before/after, contact | ✅ |
| Brand intro, sticky CTA, parallax, smooth scroll | ✅ |
| Server-side price floor (no client Firebase) | ✅ |
| SEO metadata + OG + manifest | ✅ |
| Marketplace destinations (`/cars`, `/dashboard/sell-car`) | ✅ built and linked |
| Privacy policy | ✅ `/privacy` |
| Terms of service | ✅ `/terms` |
| Sitemap / robots | ✅ listings enumerated from `loadListings`; `/dashboard` and `/store` disallowed |
| Analytics | 🔴 none - no provider wired; the one gap the audit could not close |

---

## 5 · Backend & Data

| Capability | Status | Detail |
|---|---|---|
| Firestore security rules | ✅ | No self-escalation, ownership-scoped, field-shape validated |
| Composite indexes | ✅ | 15 defined |
| Server-authoritative booking | ✅ | `/api/booking/create` |
| Immutable visit seal | ✅ | idempotent, transaction re-read |
| Admin SDK server reads | ✅ | `loadCustomerPicture` |
| Rate limiting | 🔴 | **0 of 16 routes** |
| Schema validation (zod) | 🔴 | **0 of 16 routes** |
| Public write throttling | 🔴 | `feedback`, `carLeads` accept unauthenticated creates |
| Promo `usedCount` griefing | 🔴 | any user may increment any promo, repeatedly |
| Custom claims for roles | 🔴 | `isAdmin()` does a `get()` per rule evaluation |
| Storage rules | 🔴 | Storage not provisioned |
| Cloud Functions | 🔴 | API disabled on the project (confirmed 403) |
| Backup / export policy | 🔴 | none |
| Audit log | 🟡 | `activity` collection exists, staff-only |

### Collections (18 live)

`activity` `attendance` `bookingIntents` `bookings` `carListings` `counters`
`dailyStats` `employees` `invoices` `jobs` `notificationLog` `notifications`
`promos` `quotes` `subscriptions` `tasks` `users` `walkinCustomers`

---

## 6 · APIs — 16 routes

| Route | Auth | Validation | Rate limit |
|---|---|---|---|
| `session` | ✅ | 🔴 | 🔴 |
| `booking/create` | ✅ | 🔴 | 🔴 |
| `availability` | ✅ | 🔴 | 🔴 |
| `visit/seal` · `visit/backfill` | ✅ | 🔴 | 🔴 |
| `media/sign` · `media/delete` | ✅ | 🔴 | 🔴 |
| `push/send` · `notify/event` | ✅ | 🔴 | 🔴 |
| `whatsapp/send` | ✅ | 🔴 | 🔴 |
| `referral/claim` | ✅ | 🔴 | 🔴 |
| `employee/link` | ✅ | 🔴 | 🔴 |
| `retention/run` · `cron/daily` | ✅ secret | 🔴 | 🔴 |
| `invoice/[id]` | 🟡 token | 🔴 | 🔴 non-constant-time compare |
| `report` | 🔴 public | 🟡 truncates | 🔴 |

---

## 7 · Automations

| Automation | Status | Detail |
|---|---|---|
| Notification landing (§17.3) | ✅ | one resolver; every push/doc opens its own object |
| Daily cron (03:30) | ✅ | `vercel.json` → `/api/cron/daily` |
| ├ Retention per customer | ✅ | bounded, sequential |
| ├ Low-stock alerts | ✅ | |
| └ Receivables aging (3+ days unpaid) | ✅ | |
| Booking confirmation notify | 🟡 | `notify/event` exists; trigger coverage unverified |
| Visit stage notifications | 🟡 | |
| Membership renewal reminder | 🔴 | `expireLapsedSubscriptions` exists, no scheduler |
| Protection expiry reminder | 🔴 | engine can detect it; nothing sends it |
| Review request after visit | 🔴 | |
| Abandoned booking recovery | 🔴 | `bookingIntents` collection exists, unused |
| Event-driven triggers | 🔴 | no Cloud Functions |

---

## 8 · Integrations

| Integration | Status | Detail |
|---|---|---|
| Firebase Auth (Google) | ✅ | |
| Firestore | ✅ | |
| Firebase Cloud Messaging | 🟡 | service worker + send route; no customer UI |
| Cloudinary (media) | ✅ | signed upload/delete |
| WhatsApp (deep links + send route) | ✅ | |
| Google Maps (embed + directions) | ✅ | |
| Sentry (error reporting) | 🟡 | `/api/report` wired; no client caller |
| Vercel (hosting + cron) | ✅ | |
| Payment gateway | 🔴 | none — UPI/cash in person by design |
| Email | 🔴 | none |
| SMS | 🔴 | none |
| Accounting export | 🔴 | none |
| Sign in with Apple | 🔴 | |

---

## 9 · Platform Quality

| Gate | Status | Evidence |
|---|---|---|
| TypeScript strict, zero errors | ✅ | `tsc` clean |
| ESLint zero warnings | ✅ | |
| Test suite | ✅ | 446 tests / 19 suites |
| Architecture enforcement | ✅ | 96 assertions |
| Production build | ✅ | clean |
| Customer First Load JS | ✅ | 153–200 kB |
| Design token discipline (customer) | ✅ | §22.4 enforced |
| Design token discipline (admin) | 🔴 | ~570 inline styles |
| WCAG AA (customer) | 🟡 | focus ring + contrast fixed; full audit outstanding |
| WCAG AA (admin) | 🔴 | unaudited; known 36px targets |
| Reduced motion | ✅ | customer surfaces |
| Live browser verification | 🔴 | **blocked: no Firebase Admin credentials locally** |
| Playwright E2E | 🔴 | server verified, no suites written |
| Lighthouse / perf budget | 🔴 | |

### Orphaned engines (8 remain)

Written and tested, zero callers: `chapter` `hero` `moment` `papers` — all four belong to Vehicle, History and Visit, not Home. `stay`, `truth`, `log` and `welcome` are wired.. Each is a capability already paid for and not yet
connected — `stay` is the visit ETA, `moment` and `chapter` are the visit
record, `welcome` is first-run.

---

## 10 · Mobile / iOS ⚪

Deferred by decision. Tracked so it is not forgotten: no native target exists;
Sign in with Apple, in-app account deletion and a privacy policy are hard
prerequisites. `lib/os/*` is pure TypeScript and ports unchanged.

---

## 11 · The critical path to 100%

Ordered by what unblocks the most.

**Tier 1 — finish the customer migration** (biggest single gap, 41% → ~90%)
1. Home: 7 sheets, boot, welcome gate, offline bar
2. Booking `/studio` at parity — the revenue path
3. Garage + Vehicle: add/edit car, media
4. Visit: stage rail, live photos, manage
5. History, Membership, You at parity
6. `/cars`, `/cars/[id]`, `/dashboard/sell-car`, public chapter, error boundary

**Tier 2 — make the backend survive the public** (74% → ~95%)
7. Rate limiting, all 16 routes
8. Schema validation at every boundary
9. Close promo griefing; throttle public writes
10. Custom claims for roles

**Tier 3 — admin coherence** (72% → ~90%)
11. Extract the 8 primitives; apply to daily-use screens first
12. One status map, one date format, one money format
13. Error states, mobile layout, 44px targets

**Tier 4 — automations & reach**
14. Reminder automations (membership, protection expiry, review request)
15. Privacy policy, terms, sitemap, analytics
16. Playwright E2E across the flows

**Tier 5 — deferred**
17. iOS


---

# FINAL PRODUCTION STATUS

**Verdict: NOT production ready.** One deployment blocker, listed first. Everything
else below is complete and verified.

`tsc` clean · lint 0 · **885 tests / 32 suites** · production build compiles.

## Blocker

**B1 · Firebase Admin credentials are not present.** `.env.local` holds only the
five `NEXT_PUBLIC_FIREBASE_*` client keys. `FIREBASE_ADMIN_PROJECT_ID`,
`FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` are absent, and
no service-account file exists in the repo.

Without them `adminAuth` is `null`, so `POST /api/session` returns 503, no
session cookie is ever minted, and every server-rendered room falls through to
the signed-out landing page. **This is the login failure**, and it is
configuration, not code. It also means no signed-in journey has been exercised
in a browser at any point in this build.

Also unset locally: `NEXT_PUBLIC_CLOUDINARY_*` (uploads), `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
(push), `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` (studio alerts),
`NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_UPI_ID`.

## Features Complete

Every customer surface: Landing · Login · Welcome · Home · Garage · Vehicle ·
Studio/Booking · Visit (live and sealed) · History · Membership · Marketplace
(`/cars`, `/cars/[id]`, `/dashboard/sell-car`) · You · Search palette ·
Notifications · Offline · Privacy · Terms · Invoice and Chapter share links.

## Architecture Complete

Engines decide, projections shape, renderers draw — enforced by test, not by
convention. One route table (`navigation/resolve`), zero route literals in any
projection. One booking path, one money helper, one media uploader, one
WhatsApp sender, one offline note, one first-run flag. No orphan engines, no
orphan components, no TODOs, no `ts-ignore`, no `any` in customer code.

## Security Status

Complete. CSP, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy
all set; `unsafe-eval` and emulator origins are development-only. Client writes
to `carLeads`, `sellRequests`, `savedCars` and `welcomedAt` are refused — those
go through Admin-SDK routes. No route trusts a body-supplied uid. Upload paths
are bound to the uploader. No privilege escalation path; the only public read
is the landing-page gallery.

**Not implemented, by decision: rate limiting.** `POST /api/cars/lead` is
deliberately open to signed-out callers and writes a document plus a WhatsApp
message per request. It is validated and shape-bound, but nothing throttles it.
See L1.

## Performance Status

`loadCustomerPicture` and all marketplace loaders are request-cached; per-car
reads are parallel and bounded; every `where`+`orderBy` has a matching
composite index (nine verified individually). Five screens converted from
client to server components. No N+1, no duplicate loaders.

## SEO Status

Complete for what exists. Canonicals are per-page (the root layout's
`canonical: '/'` was being inherited by every page). Listings carry OpenGraph
cards. Sitemap reads the same loader the showroom does. `robots` disallows
every signed-in surface plus `/store`. Branded 404.

**Not implemented: JSON-LD structured data** (`LocalBusiness`, `Product`) — see L2.

## Accessibility Status

Keyboard paths verified for the palette (arrow keys, Enter,
`aria-activedescendant`, grouped listbox). Dialogs are Radix-backed, so focus
trap, Escape and scroll lock have one implementation. Reduced motion honoured
on every animating customer surface. Pinch-zoom never disabled. Live regions
are `polite`. Every filter control exposes its pressed state.

## Known Limitations

- **L1 · No rate limiting** on the public enquiry endpoint. Mitigation when
  wanted: a per-IP or per-phone counter in Firestore before the notify.
- **L2 · No structured data.** A detailing studio benefits from
  `LocalBusiness` + `Product`; absent today.
- **L3 · Sign-in cannot complete in an in-app webview** (Instagram, Facebook,
  Snapchat, TikTok, LinkedIn). `signInWithPopup` cannot work there. The failure
  now says "Open this page in Safari or Chrome" instead of the impossible
  "Allow pop-ups". A `signInWithRedirect` fallback would make it work; that is
  a feature, deliberately not built here.
- **L4 · Seven `/dashboard/*` redirects were 301s to a deleted `/app`.** Now
  repointed, but a 301 already served is cached by the browser — anyone who hit
  one will keep going to the old target until their cache clears.
- **L5 · No signed-in browser verification** anywhere in this build (see B1).
- **L6 · Unused admin-domain exports remain** and were deliberately not
  deleted, being outside customer scope and possibly mid-wiring:
  `listCustomerActivity`, `getAdminStats`, `SHIFT_START`/`SHIFT_END`/`LATE_GRACE_MIN`,
  `getServiceRecipe`, `getRecipePrefill`, `consumeActuals`, `markInvoicePaid`,
  `subscribeJobForBooking`, `markJobPayment`.
- **L7 · Analytics** — intentionally out of V1 scope.
- **L8 · Sign in with Apple** is absent; Apple Guideline 4.8 requires it
  alongside Google for App Store submission. Web is unaffected.

## Deployment Checklist

1. Set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
   `FIREBASE_ADMIN_PRIVATE_KEY` on Vercel. The private key must keep its
   literal `\n` escapes — the loader does `.replace(/\\n/g, '\n')`, so a key
   pasted with real newlines will not parse.
2. Confirm `NEXT_PUBLIC_FIREBASE_PROJECT_ID` names the **same** project as the
   admin credentials, or `verifyIdToken` returns 401 and login fails the same way.
3. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + preset, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`,
   `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_UPI_ID`.
4. Deploy `firestore.rules` and `firestore.indexes.json`.
5. Rotate the previously-leaked admin key in the Firebase console if not done.

## Production Checklist

- [ ] Sign in on Chrome desktop → lands on Home, not the landing page
- [ ] `/api/session` returns **200** (503 = admin credentials; 401 = project mismatch)
- [ ] First-ever sign-in reaches `/welcome`, not "We could not reach your garage"
- [ ] Finish the arrival → Home; sign out → cached rooms are gone
- [ ] Book a visit → appears in `/admin` and fires WhatsApp
- [ ] Enquire on a car → lead reaches the studio on both channels
- [ ] Upload a photo on sell-car → Cloudinary write under `sellRequests/{uid}/`
- [ ] `/sitemap.xml` and `/robots.txt` return 200
- [ ] Open a listing link in WhatsApp → preview card renders
