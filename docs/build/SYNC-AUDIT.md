# SYNCHRONIZATION AUDIT
### Repository state vs the ratified Constitution & frozen roadmap
Audit only - no production code changed. HEAD = `2bfcaf2` (P1: The Glance).

## 1 · Current implementation state

**Green across the board:** `tsc --noEmit` clean · lint warnings-only (8, all pre-existing in admin/studio/lib, none in `os`/`app`) · 35 tests pass (incl. `__tests__/os.test.ts` covering term + visit + truth) · `next build` EXIT 0, 38 static pages, `/app` = 9.03 kB. **Deployable to Vercel now.**

Two commits landed since my memory (`bfa87f3` Phase 0):
- `873d195` **PRE-1 convergence** - collapsed the exploratory "CX V3" Gen-A layer into thin adapters over the OS system (documented in `docs/PRE1-CONVERGENCE.md`).
- `2bfcaf2` **P1 The Glance** - built `/app`, deleted 6 dashboard surfaces.

**Constitution → code, per phase:**

| Phase | Status | Evidence |
|---|---|---|
| **P0 - constitution in code** | ✅ Done | `lib/os/{motion,term,visit,truth}.ts` (Term Engine, translation boundary, derived truth); 12 components in `components/os/` + `text.tsx` primitives; `/styleguide` gate renders all 12; `os.test.ts` green |
| **P1 - The Glance** | 🟡 ~85% | `/app/page.tsx` (533 ln) + `/app/layout.tsx`: portrait region, vehicle pager, all six layers (Now/Protection/story/Papers/Club/signature), silence law, Capsule, `?sheet=` param system, auth handoff. Deletions done. |
| P2–P7 | ⬜ Not started | booking/care/history/vehicles/subscriptions remain as legacy interim surfaces |

**The translation boundary holds.** `lib/os/visit.ts` maps ops `BookingStatus`/`JobStatus` → five `CareAct`s; `truthOf()` emits sentences only. No ops vocabulary reaches `/app`. **Data law holds** - no score/health/engagement invented; `truth.ts` derives from visits + protections only.

## 2 · Current phase

**Phase 1, ~85% complete.** The Glance ships and is the customer's real home. Three P1-scope gaps remain open (§4).

## 3 · Remaining roadmap

P1 close-out (§4) → **P2** Conversation/Desk + Proposals (wire the already-built Desk; kill `/dashboard/booking`) → **P3** The Stay (`MomentStage` built, unwired; kill `/dashboard/care`) → **P4** Timeline + Chapter (kill `/dashboard/history`, absorb `/invoice`) → **P5** Protection + Papers (kill `/dashboard/vehicles`) → **P6** Club (kill `/dashboard/subscriptions`) → **P7** Onboarding + ten-year polish (kill the temporary dashboard shell + all adapters + devseed).

## 4 · Required convergence work (to close P1)

1. **Desk not wired.** `components/os/Desk.tsx` and `TruthLine.tsx` and `MomentStage.tsx` are imported **only by `/styleguide`**, not by `/app`. P1 mandates the Concierge Desk + in-desk search. Currently the capsule quiet-tap routes to `/dashboard/booking` (`app/app/page.tsx:129,147` `TODO(P2)`). **Gap:** Desk component exists but is not the capsule's destination, and search is unreached.
2. **TruthLine duplication.** The Glance renders truth inline via `truthOf()` rather than the `TruthLine` component. One should own it (component wraps `truthOf`) to avoid two truth renderers.
3. **Interim deep-links into legacy** (all marked `TODO`): capsule → `/dashboard/booking`; Club "Have a look"/"Rejoin" → `/dashboard/subscriptions`. Acceptable as phase bridges; each dies on its phase. Not a violation while marked and dated.

**Not violations (deliberate, documented bridges), but must be gone by Definition of Done:**
- **Adapter layer:** `cx/CxButton`→`os/Action`, `cx/CxSheet`→`os/StudioSheet`, `lib/cx/motion`→`os/motion`. Used only by surviving `/dashboard/*` routes. One source of truth already exists underneath; adapters evaporate as routes are deleted P2–P6.
- **`app/dashboard/layout.tsx`** - self-labelled TEMPORARY shell; auth-guard only (nav/home/Live-Activity already deleted). Dies with its last child route (P6).
- **`lib/cx/devseed.ts`** - the approved local preview shim (`isDevUser`-gated). Not prod fake data, but must be excluded from the P7 done-state.

**Constitution compliance:** no violations found. Deleted routes are 301'd in `next.config.js` per IA §1.2 (`/dashboard`→`/app`, `/dashboard/profile`→`/app?sheet=you`, cars→`/cars`, etc.). Sheets are `?sheet=` params. One overlay (`StudioSheet`). Accent discipline, silence law, and photography-through-`lib/media` all intact.

## 5 · Recommendation for next implementation phase

**Close P1 before opening P2** - small, contained, makes the phase honestly "done":
1. Wire the Capsule quiet-tap → **Desk** (`?sheet` or `/app/desk` per IA), rendering thread shelf + search (components already built).
2. Route the Glance truth through the **`TruthLine`** component (kill the inline duplicate).
3. Leave the three legacy deep-links as-is (dated bridges) - they belong to P2/P6 deletion.

This finishes P1 without touching architecture. Then P2 (Conversation + Proposals) proceeds, deleting `/dashboard/booking` and the first adapters. **Do not** advance to P2 while the Desk - a P1 deliverable - is unwired.
