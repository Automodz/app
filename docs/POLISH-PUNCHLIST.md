# Polish Punch-List — pre-feature freeze

**Date:** 26 July 2026 · **Status:** audit only, nothing implemented.
**Scope:** every customer route against the Constitution and the Design Language.
**Freeze:** the visual language is frozen. Nothing below is a redesign — every item is a verified defect, a law violation, or debt with a named minimal fix.

Method: import-graph analysis, token/animation greps, a live pass over `/app`, `/app/garage`, `/app/you`, `/app/chapter/[id]`, `/app/visit/[id]` at 375px, and a production build. Findings that turned out to be probe artifacts are excluded, not reported as wins.

---

## CRITICAL — ship-blocking or actively wrong

### C1 · Pinch-zoom is disabled product-wide
`app/layout.tsx` viewport is still `maximum-scale=1, user-scalable=no`. **Verified live** on `/app`.
**Why:** a hard WCAG 2.1 SC 1.4.4 (AA) failure. It also blocks zoom inside the immersive `MediaViewer` — a photo viewer nobody can zoom. I named this in the Design Language §7 and never fixed it.
**Fix:** delete `maximumScale` and `userScalable` from the `viewport` export. One line.

### C2 · Members are still overcharged in the app
`computeBestDiscount` is called from **exactly one place**: `components/intake/WalkInFlow.tsx:85` — the staff kiosk.
**Why:** a Gold member booking a ceramic in-app pays full price; the same member walking in gets 15% off. Every promo the owner authors is invisible, and referral rewards can never be redeemed. The app actively punishes using the app.
**Fix:** call the existing pure `computeBestDiscount` in the arrange path and record the redemption. ~40 lines, no new logic.

### C3 · Any signed-in user can burn any promo
`firestore.rules:277` permits any authenticated user to increment `usedCount` on any promo, with no check they are redeeming it. Referral rewards are `usageLimitTotal: 1`.
**Why:** one loop exhausts every promo in the system. Exploitable today.
**Fix:** move redemption behind an admin-SDK route; drop the client-writable branch.

### C4 · `deleteImage()` is a no-op
`lib/services/storage.ts:34` — Cloudinary unsigned uploads can't be deleted client-side, so it does nothing.
**Why:** the Garage and Media are now photo-centric and will accept owner uploads. "Delete this photo" that silently doesn't is a DPDP Act 2023 exposure, and consent for the Studio customer showcase cannot be honoured.
**Fix:** a signed delete route; call it from the same function so no caller changes.

---

## HIGH — real defects, contained fixes

### H1 · Two protection engines still live on one car
`lib/cx/protection.ts` (the legacy adapter, self-marked `TEMPORARY ADAPTER (PRE-1)`) is still imported by `app/app/page.tsx`, `ProtectionRecord.tsx`, and four `lib/os/*` engines — while Home, Garage and Chapter read `projectProtections`.
**Why:** the same car can produce two different answers to "what protects it", and the legacy path still recomputes warranties from the mutable catalogue — the exact bug the Visit anchor exists to prevent.
**Fix:** point `papers/proposal/ownership/log` at `lib/os/protection`, delete `cx/protection.ts` and `ProtectionRecord.tsx`.

### H2 · The Desk's shelf still has dead rows
`app/app/page.tsx:258` — "Papers & records" calls `router.replace('/app')`, i.e. closes the sheet and does nothing. Three Club rows (`:305`, `:307`, `:310`) do the same.
**Why:** four controls that look tappable and are inert — Design Language §13, "nothing is inert." Papers now has a real home (Garage → Media / the Chapter's receipt).
**Fix:** point Papers at `/app/garage`, point Club at `?sheet=join-club`, or remove the rows.

### H3 · The notification collection is still write-only
`app/app/page.tsx:446` is `const unreadCount = 0`; no customer surface calls `getUserNotifications`.
**Why:** the daily cron correctly computes membership expiry, protection expiry and 30-day win-back into a collection nothing reads. Delivery depends entirely on push, which is off by default. Every automation terminates in a void — and this now also breaks the deep-link fix from the shell phase, which has nothing to deep-link *from*.
**Fix:** push at the right moments (the Garage chips are the inbox — do **not** build a list).

### H4 · The referral loop still cannot start
No file imports `getMyReferralCode` or `referralShareLink`. Inbound `?ref=` claiming works server-side.
**Why:** a fully-built, server-side, dual-sided reward with no way to share a code.
**Fix:** one Action in `/app/you` calling the existing service. ~15 lines.

### H5 · `looked_over` is an unreachable act
`lib/os/visit.ts:39` declares five acts; no `BookingStatus` or `JobStatus` maps to `looked_over`.
**Why:** the Visit rail permanently shows a node that can never light, and the fill jumps two steps from Received to In care. Carried since the original audit.
**Fix:** either add an ops status for inspection, or drop the act from `ACT_ORDER`. It's business logic, so it needs a decision, not a patch.

### H6 · Two orphaned components and one orphaned dev-only tree
Import-graph: **`StudioIntro`** has zero consumers. **`Layer`, `MemberCard`, `EmptyState`, `MomentEntry`, `PhotoBand`, `TruthLine`, `Capsule`, `Skeleton`, `Spinner`** are imported *only* by `/styleguide`.
**Why:** Art. 16.5 forbids two generations coexisting. These are the retired Glance's parts kept alive by a dev gallery, and they make the component budget in Art. 16.6 untrue.
**Fix:** delete `StudioIntro`; decide per component whether the styleguide entry justifies keeping it, and delete the rest with their styleguide blocks. `Skeleton`/`Spinner` are genuinely reusable — keep those.

---

## MEDIUM — law violations and debt with real cost

### M1 · `/styleguide` is public and has a live hydration error
Unguarded on the production domain, and `Portrait` throws a framer SSR/client style mismatch on every load.
**Why:** an internal gallery of retired components on the public site, erroring. It also keeps H6's orphans alive.
**Fix:** gate it behind `NODE_ENV !== 'production'`, or delete it and let the product be the reference.

### M2 · 103 of 111 components are client components
Only `app/layout.tsx` and `app/not-found.tsx` render on the server.
**Why:** `/app` is 356 kB First Load JS and its static HTML is an empty shell — download, hydrate, auth, Firestore, *then* paint. On mid-range Android over Ahmedabad 4G that is the whole "feels like a React app" problem.
**Fix (contained):** convert the marketing and `/cars` routes first — they need no session and carry the SEO. The customer tree genuinely needs the client.

### M3 · The service barrel defeats tree-shaking
`lib/firebaseService.ts` is 28 × `export *`, imported by 44 files.
**Why:** importing one function pulls the whole graph into the bundle; a large slice of the 104 kB shared chunk.
**Fix:** import from `lib/services/*` directly at call sites; keep the barrel only for legacy admin.

### M4 · Fonts are render-blocking third-party
`app/layout.tsx:41-45` loads four families from Google Fonts via `<link>`.
**Why:** extra DNS + TLS + CSS round-trip before any text paints, plus FOUT. `next/font` self-hosts and removes it. Type popping in late is exactly the "premium" tell the Design Language cares about.
**Fix:** move to `next/font/google`; the CSS variables already exist.

### M5 · Raw hex and raw px inside the customer tree
`MemberCard` (15 hex), `Monogram` (6), `JoinClub` (4); raw px spacing in `app/app/page.tsx` (5), `Desk`, `PhotoBand`, `VehiclePhotos`, `Field`, `Chip`, `StudioSheet`, `IdentityPlate`.
**Why:** Art. 16.6 is "tokens only". `Monogram`'s hex is a deliberate metal ramp and is fine; the rest is drift.
**Fix:** replace with tokens where a token exists; document the metal ramp as an intentional exception.

### M6 · Inline `fontSize` outside the text primitives
`app/app/page.tsx` (6), `Field` (3), plus `VehiclePhotos`, `PhotoBand`, `MemberCard`, `IdentityPlate`, `Desk`, `app/app/garage/page.tsx` (2).
**Why:** "Raw font sizes outside this file are a defect" — `text.tsx`'s own header. Several are legitimate (the Display clamps); the rest bypass the scale.
**Fix:** route through the primitives or add the size to the scale.

### M7 · No SEO surface at all
One `metadata` export in the whole app; no `sitemap.ts`, no `robots.ts`, no OG image, no `generateMetadata` on `/cars/[id]`.
**Why:** `/cars/[id]` is the one page that genuinely needs to be found, and a shared Chapter has no preview card — which is the viral asset the audit identified.
**Fix:** `generateMetadata` for `/cars/[id]` and `/chapter/[id]`, plus `sitemap.ts` and `robots.ts`.

### M8 · Two unauthenticated write paths
`firestore.rules:217` (`feedback`) and `:297` (`carLeads`) allow `create` with shape validation only, no auth, no rate limit.
**Why:** anyone can write unbounded documents to a billed database.
**Fix:** put both behind a route handler, or enable App Check.

---

## LOW — tidy-up, no user impact today

- **L1 · The `AppLayout` key warning persists.** Dev-only; React strips it in production. Established: specific to the `/app` tree, not `Dock`, no unkeyed array in any page. The owner React names is unreliable. Needs a React DevTools session, not more grepping.
- **L2 · `/dashboard/sell-car` is orphaned** — a working route with no entrance anywhere. Delete it or give it a home in You.
- **L3 · 14 legacy redirects** in `next.config.js`. All resolve correctly (verified `/dashboard/profile` → `/app/you`, `/dashboard/booking` → `/app?sheet=arrange`). They cost nothing but should get an expiry date.
- **L4 · `?sheet=you` forwards to `/app/you`.** Correct for bookmarks; now that the Dock points directly it is pure legacy. Keep one release, then drop.
- **L5 · `eslint.ignoreDuringBuilds: true`** in `next.config.js` — why ~180 lines of dead code accumulated unnoticed in the first audit.
- **L6 · Six missing composite indexes** for live queries (`bookings userId+scheduledDate`, `jobs customerId+date`, `jobs status+paymentStatus`, `quotes`, `activity`, `notificationLog`). They work at current scale and will throw `FAILED_PRECONDITION` in the nightly cron later.
- **L7 · Home's controller is still 988 lines** holding `ArrangeSheet`, `ManageVisitSheet`, `CarFormSheet`, `AddCarInvitation`. Fine for now; `ArrangeSheet` should become the Book entrance when that route lands.
- **L8 · `Field` labels wrap the input** rather than using `htmlFor`/`id`. Implicit labelling is valid and screen readers handle it; explicit is more robust.
- **L9 · One large image with `alt=""` on `/app`** — verify it is genuinely decorative.

---

## Verified as NOT defects

Recording these so the next pass doesn't re-litigate them:

- **Focus rings exist.** `.studio :focus-visible` (`globals.css:1423`) covers the whole customer tree. An earlier probe of mine reported otherwise; it was checking for a class name and was wrong.
- **The monogram letter is 11.8:1**, not the 1.15 an earlier probe reported — that measured the `aria-hidden` wrapper against the page rather than the letter against its own ground.
- **Ambient looping animations are marketing/admin only.** In the customer tree only `.st-node-live` (the current act) and `.st-skeleton` (loading) loop, both legitimate state.
- **No content is gated on entrance opacity** anywhere in the customer tree — the motion law holds after the Visit and Chapter rebuilds.
- **Headings and landmarks are correct** on all four rebuilt routes: one `h1`, ordered `h2`/`h3`, one `main`.
- **Every route transition and deep link resolves**, including cold-load `/app/chapter/[id]` and the legacy redirects.

---

## Suggested order

1. **C1** (one line) · **C3** · **C2** — safety, then money.
2. **H2**, **H4**, **H6** — inert controls, the referral entry point, the orphans. All small.
3. **H1** — retire the legacy protection engine; unlocks deleting two files.
4. **H3** — push delivery; turns on four automations already written.
5. **M4**, **M3**, **M7** — the cheap performance and reach wins.
6. **C4**, **M8**, **L6** — before the Media Library accepts owner uploads.

**H5** and **M2** need a decision, not a patch. Everything else is mechanical.
