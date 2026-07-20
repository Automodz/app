# PRE-1 — Migration & Convergence Record

_2026-07-21 · Companion to the Constitution (Part VIII). Generation B (Customer OS,
`lib/os` + `components/os`) is the ONLY architecture; Generation A (`lib/cx` +
`components/cx` + `/dashboard` surfaces) is temporary implementation awaiting
replacement. Every remaining cx file is an **adapter** with a named deletion phase._

## Migration matrix

### lib/cx

| Module | Verdict | State after PRE-1 | Deleted in |
|---|---|---|---|
| `motion.ts` | **MERGE → adapter** | Re-exports `lib/os/motion` only (tick/move/scene, studioEase); defines no values | P7 (consumers leave in P1–P6) |
| `care.ts` | **MERGE → adapter** | All labels/lines/status mapping from `lib/os/visit`; keeps deriveCare (progress/ETA) + strip-unread helpers | P3 (unread helpers with the strip in P1) |
| `protection.ts` | **MIGRATE → adapter** | Expiry truth from the Term Engine (`termState`/`termAlive`); adds `term` to the fact | P5 |
| `passport.ts` | **MIGRATE → adapter** | Recommendation windows are Term Engine edges (waning/expiring); `daysLeft` from `lib/os/term` | P5 (stats/memories migrate P4) |
| `goals.ts` | **KEEP (temporary)** | Untouched; only the wizard consumes it | P2 (with the wizard) |
| `devseed.ts` | **KEEP (dev-only)** | Untouched; updated per phase | P7 |

### components/cx

| Component | Verdict | State after PRE-1 | Deleted in |
|---|---|---|---|
| `CxSheet.tsx` | **MERGE → adapter** | Pure adapter over `components/os/StudioSheet` (legacy `ground`/`maxHeight` overrides); zero drawer code | P7 (consumers leave per phase) |
| `CxButton.tsx` | **KEEP (temporary)** | Marked: `Action` is the one primitive; visual delegation now would restyle live CTAs | P1–P6 per surface, file in P7 |
| `CxLiveActivity.tsx` | **KEEP (temporary)** | Filters via `visitPhase`, copy via translation layer | P1 (Glance absorbs) |
| `CxVehicleForm.tsx` | **KEEP (temporary)** | Untouched | P2 |
| `useVisitJob.ts` | **KEEP (temporary)** | The one job listener | P3 |

### Shared utilities / other

| Item | Verdict | Note |
|---|---|---|
| 5× local `MEDIA.services` index helpers | **MERGED** | One `serviceMedia()` in `lib/media.ts` |
| 2× local `daysLeft` (home, subscriptions) | **MERGED** | `lib/os/term.daysLeft` |
| Ops-status arrays in customer tree (history, strip, home, tracker) | **DELETED** | Replaced by `visitPhase()`/`careAct()`/`actFromJobStatus()` |
| Unused exports (`depart`, `warrantyMonths`, `careUpdateCount`, `bookingStage`, `jobStage`, `JOB_STAGE` table) | **DELETED / internalised** | Unused-export audit clean |

## What merged into lib/os (additions, not forks)

- `lib/os/visit.ts` gained the customer copy homes: `ACT_LINE`, `PHASE_TITLE`,
  `PHASE_LINE`, and `actFromJobStatus()` (jobs vocabulary inside the boundary).
- `components/os/StudioSheet.tsx` gained a proper `Drawer.Title` (sr-only — fixes a
  Radix a11y error) and two legacy overrides (`ground`, `maxHeight`) used only by the
  CxSheet adapter — TODO(P7) removes both.

## Truth boundary — law, enforced now

Grep-clean: no ops stage vocabulary (`vehicle_received`, `in_progress`,
`quality_check`, `ready_for_delivery`, `checked_in`) appears under
`app/dashboard` or `components/cx`. All state rendering flows through
`lib/os/visit` (directly or via the care adapter). Visit copy converged to the
ratified act copy (Received / In care / Final checks / Ready for collection).

## Verification (all green)

- Typecheck clean · lint 0 errors · jest 35/35 · production build passes
- Bundle diff: first-load JS stable (shared 104 kB; heaviest route 324 kB, unchanged);
  vaul now has exactly one implementation (StudioSheet)
- Dead-import audit: no references to deleted symbols; unused-export audit clean
- Browser: home, tracker, garage, add-vehicle sheet verified — no visible regressions;
  sheet a11y title present

## One motion · one status · one term · one truth · one sheet

`lib/os/motion` · `lib/os/visit` · `lib/os/term` · `lib/os/truth` ·
`components/os/StudioSheet`. Everything else adapts or awaits deletion.

**Next: Constitution P1 — The Glance.**
