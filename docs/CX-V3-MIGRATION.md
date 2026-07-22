# CX V3 - Component Audit & Migration Plan

Companion to CUSTOMER-EXPERIENCE-V3.md. Code-level facts and the order of demolition.

## Audit findings (grep-verified)

**1 · The customer app doesn't use the design system.**
Of the shared ui kit, customer surfaces import only: ServiceIcon (8), Wordmark (4), ErrorState (3),
BeforeAfterSlider (2), GaugeRing (1), SlideToAction (1), HeroMedia (1). They use `Sheet`, `ConfirmDialog`,
`EmptyState`, `Skeleton`, `Input`, `StatCard` **zero** times. Every customer screen hand-rolls its own.

**2 · Seven+ hand-rolled bottom sheets** (identical overlay + spring-y pattern, copy-pasted):
`dashboard/layout.tsx` (×2), `dashboard/history` (×2 incl. cancel confirm), `dashboard/vehicles` (×3),
`dashboard/profile` (×2), `dashboard/subscriptions` (payment flow), `cars/[id]`. Plus 6 dashboard files
each re-declare `AnimatePresence` overlay scaffolding and their own `EASE` constant.

**3 · Dead / zombie inventory:**
- `vaul` - installed since v4.0, imported nowhere. Becomes the V3 sheet engine or gets uninstalled; not both.
- `components/ui/Sheet.tsx`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `Input`, `PageHeader`, `StatCard`,
  `StatusChip` - admin-only in practice; they stay as Studio kit, but are **not** the CX system.
- `GaugeRing`, `SlideToAction`, `CountUp`, `HeroMedia`, `GradientButton` - single-consumer components; each dies
  with the screen that gets rebuilt (gauges die with the dashboard in Phase 4, etc.).

**4 · Should-be-shared (currently duplicated inline):**
EASE constant (8 copies) · status→tone mapping (per-file ternaries) · overlay+sheet scaffold (7 copies) ·
price formatting patterns (`₹x.xL` logic in profile + vehicles) · progress/step rail (history sheet, wizard).

## Migration plan

| Order | Action | Kills |
|---|---|---|
| Phase 0 | `components/cx/` design system: `CxSheet` (vaul), `CxButton`, `CxAction`, `lib/cx/motion.ts` tokens, `lib/cx/status.ts` tones. Migrate the Garage's 3 sheets as proof. | vaul-as-zombie, EASE copies begin dying |
| Phase 1 ✅ | Shell rebuilt in place (`/dashboard` layout): CAR·CARE·CLUB tabs + Book pill + `CxLiveActivity` strip. Care=history, Club=subscriptions(+offers/refer links) until their rebuild phases. Home's inline live banner deleted; profile moved to avatar; garage to a Car quick link. Dev shim seeds one mock in-studio visit for local Live Activity testing. | 5-tab layout, home's in-progress banner |
| Phase 2 ✅ | Booking → car onboarding: 6 horizontal panes (vehicle → goal → plan → date → arrival → review), one decision per pane, concierge copy, "Schedule Care" CTA. New shared: `lib/cx/goals.ts` (goal→service recommendation), `lib/cx/protection.ts` (extracted from Garage), `CxVehicleForm` (shared add/edit sheet, Garage migrated onto it). Engine untouched: availability, discounts, membership washes, createBooking, WhatsApp, quotes. | 1,085-line wizard, its inline overlays + quote card, Garage's inline form + local protection helpers |
| Phase 3 ✅ | Live Care Experience: `/dashboard/care/[id]` tracker - photo hero (live badge, technician, elapsed, honest ETA, animated progress), real statusHistory journey (names, notes, timestamps), edge-to-edge studio photos + swipe viewer, work/payment/summary cards, delivery mode (after-photo hero, collection, review, book-again). `lib/cx/care.ts` = the one stage/ETA/progress model (also drives the Care list + intelligent Live Activity strip: live job subscription, ETA, unread dot). Firestore rules gained customer-reads-their-own on jobs + activity (invoices pattern) - **rules must be deployed**. Dev seeds moved to `lib/cx/devseed.ts`. | history detail sheet (its timeline, cancel confirm, reschedule UI - actions moved into the tracker), per-file status ternaries on the Care list |
| Phase 4 ✅ | Vehicle Passport: `/dashboard/vehicles/[id]` - hero pass with Care Score (100-pt, fully explainable, tap for breakdown), premium protection cards (applied/valid-until/remaining/renew; Coating added as a third derived layer), the car's LIFE timeline, derived stats (visits, invested, days protected, favourite technician, avg turnaround), smart recommendations that cite their records, memories (photo cards → tracker), photo journey grouped before/during/after, documents (invoices + warranties). Garage list became a wallet-pass stack. `lib/cx/passport.ts` = the one derivation. Audit consolidation: `lib/cx/status.ts` deleted (tones merged into care.ts). Home merge + GaugeRing/HeroMedia deletion deferred to the home-rebuild phase. | garage detail sheet + its timeline, lib/cx/status.ts, garage-era list cards |
| Phase 5 ✅ | Ownership experience: Home rebuilt - full-bleed vehicle hero that IS the tracker preview when a visit is live (strip hidden on home; ownership state Protected/Needs attention/All good otherwise), Today's recommendation (derived only, incl. membership washes/renewal), recent memories, passport preview, next visit. Care timeline → photo-first story cards grouped by year ("protection earned", technician, investment). Tracker gained the journey rail (car marker travelling real progress across Arrival→Care→Inspection→Ready→Home). Concierge empty states (garage/care/membership). `useVisitJob` = the one job listener (strip, home, tracker). Deleted: old dashboard home, GaugeRing, HeroMedia, getStatusStep, filter tabs. | history list + filters, dashboard home widgets, GaugeRing, HeroMedia, getStatusStep |
| Phase 6 | CLUB (membership card + rewards + referral + offers merged) | subscriptions page's inline payment sheet, offers page, refer page |
| Phase 7 | Homepage film (GSAP + Lenis, public bundle only) | current homepage sections, framer reveals there |
| Phase 8 | Motion polish, haptics, PWA QA, delete-sweep of every orphaned component | remaining single-consumer components |

**Rules enforced each phase:** the replaced pattern is deleted in the same commit; no screen may import both an
old hand-rolled overlay and CxSheet; every phase passes lint/typecheck/build/browser (320/375/desktop) before the next.

**Kept untouched:** Studio/Office (`/admin`), kiosk, marketplace pages (restyled only in Phase 8 if at all),
invoice public page (already strong), all lib/services, engines, schema.
