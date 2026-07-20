# 01 · INFORMATION ARCHITECTURE
### Phase 1 of the build — pure structure, derived from the Constitution

**Authority:** `docs/AUTOMODZ-CUSTOMER-PRODUCT-CONSTITUTION.md` (law) + `docs/AUTOMODZ-EXPERIENCE-PRINCIPLES.md` (feel). Nothing here is philosophy; everything here is a derivation. Nothing visual.
**Merge rule applied throughout:** every screen has exactly one purpose; where two structures solved the same problem, they were merged and the merge is noted.

---

## 1 · Route map (complete)

### 1.1 Public routes (unauthenticated)

| Route | Purpose (one) | Notes |
|---|---|---|
| `/` | Marketing homepage | Existing LC1 page; untouched by the customer product |
| `/cars` | Used-car marketplace index | Public; consumes vehicle graph for AutoModz-listed cars |
| `/cars/[id]` | One listing | Listing = a projection of a Vehicle's twin (redacted) |
| `/store` | Merch | Parked, always-dark, outside this IA's law |
| `/auth/login` | The threshold | Google sign-in → `/app` (or `/app/welcome` if no vehicle) |
| `/chapter/[visitId]` | **Public share of a chapter** | The care record an owner shares; amounts hidden for non-owners. **Merge:** absorbs `/invoice/[id]` (301 redirect kept for old links). One document, two audiences. |
| `/offline` `/not-found` `/error` | System pages | Concierge-voiced |

### 1.2 The customer product (authenticated) — under `/app`

| Route | Surface | Purpose (one) |
|---|---|---|
| `/app` | **The Glance** | "What is happening with my car?" — portrait, truth line, layers, capsule. The root and default. |
| `/app?car=[vehicleId]` | Glance, positioned | Deep-link target for a specific vehicle (swipe position) |
| `/app/welcome` | **Onboarding** | Produce a photographed Vehicle; runs once; forward-only; unreachable afterwards |
| `/app/visit/[visitId]` | **The Stay** | The live visit takeover — five acts. Route exists so pushes can land in it; when the visit is live, `/app` auto-presents it (route and state converge on one surface). |
| `/app/chapter/[visitId]` | **Chapter (owner view)** | One archived visit as a document. Same component as `/chapter/[visitId]` with owner privileges — one screen, two routes by audience. |
| `/app/desk` | **The Conversation** | The thread + object shelf + search. Full-screen sheet visually; a real route so every intent is deep-linkable. |
| `/app/desk?focus=[objectRef]` | Conversation, focused | Deep-link target for term edges, records, club (e.g. `focus=protection:abc`, `focus=club`, `focus=records`) |

**That is the entire authenticated surface: four screens plus onboarding.** Deleted V2 routes (`/dashboard/*`) 301 to their successors: `/dashboard`→`/app`, `/dashboard/history`→`/app/desk?focus=records`, `/dashboard/vehicles`→`/app`, `/dashboard/subscriptions`→`/app/desk?focus=club`, `/dashboard/profile`→`/app?sheet=you`, `/dashboard/booking`→`/app/desk`, `/dashboard/cars`→`/cars`, everything else→`/app`.

### 1.3 Sheets, modals, drawers (complete inventory)

There are **no modals and no drawers** in the customer product — one overlay primitive exists: the **Sheet** (bottom, drag-dismiss). Destructive confirmation is a *state inside* the invoking sheet, never a second overlay. Native OS surfaces (share sheet, camera, notification permission) are the only other overlays.

Sheets are addressable as query params on any `/app*` route (`?sheet=…`), so every one is deep-linkable and back-button-correct:

| Sheet (`?sheet=`) | Purpose (one) | Invoked from |
|---|---|---|
| `visit-agree` + `visit=[id]` | Say yes to a proposed visit (adjust slot/scope inline) | Capsule, thread card, push |
| `visit-arrange` (+ `car=`, `service=`, `when=` prefills) | Customer authors a visit ("I want a wash today") | Desk shelf, thread, glance Now layer |
| `visit-adjust` + `visit=[id]` | Reschedule or cancel an agreed visit (cancel-confirm is an internal state) | Now layer, thread card |
| `join-club` | Join / rejoin the Club | Relationship layer, desk shelf, thread card |
| `you` | Identity, phone, notification preferences, install, sign out, delete account (internal confirm state) | Avatar, desk shelf |
| `car-form` (+ `car=[id]` for edit) | Add or edit a vehicle (onboarding reuses it verbatim) | Swipe-end page, identity layer, desk |
| `moment-add` + `car=[id]` | Customer authors a Moment (photo + line) | Timeline layer |
| `pay` + `for=[visitId\|membershipId]` | Record payment intent (at studio / UPI reference) | Reveal, join-club |

Eight sheets. Adding a ninth requires the same discipline as the component budget: it must be a task with an end state that no existing sheet serves.

---

## 2 · Objects & relationships (implementation registry)

Canonical definitions live in the Constitution (Articles 3–5); this section fixes the *storage-facing* shape so no two engineers model them differently.

| Object | Key fields (structure, not schema) | Owned by | Collections path (Firestore) |
|---|---|---|---|
| Party | `role[]` (owner/viewer/staff/studio), `name`, `phone`, `photo`, auth uid | root | `parties/{id}` |
| Vehicle | `identity{make,model,year,plate,vin?}`, `portrait`, `partyRoles{partyId:role}`, `status` | party group | `vehicles/{id}` |
| Visit | `vehicleId`, `kind`, `state`, `author`, `reason`, `slot`, `scope[]`, `amount`, `studioId`, `staffIds[]`, act timestamps | Vehicle | `vehicles/{id}/visits/{id}` |
| Protection | `vehicleId`, `type`, `termState`, `appliedOn`, `expiresOn`, `sourceVisitId`, `ancestorId?` | Vehicle | `vehicles/{id}/protections/{id}` |
| Membership | `partyId`, `tier`, `termState`, `benefits{used,total}`, `studioId` | Party | `parties/{id}/membership/{id}` |
| Record | `vehicleId`, `kind`, `file/render`, `visitId?`, `expiry?` | Vehicle | `vehicles/{id}/records/{id}` |
| Moment | `vehicleId`, `kind`, `media?`, `caption`, `at`, `authorPartyId`, `visitId?`, `act?` | Vehicle | `vehicles/{id}/moments/{id}` |
| Studio | `name`, `location`, `staff[]` | root | `studios/{id}` |
| Thread | messages: `{author, body, cardRef?, at, read}` | Party | `parties/{id}/thread/{msgId}` |
| Signal | *reserved — collection path claimed, nothing written* | Vehicle | `vehicles/{id}/signals/{id}` |

Relationship edges are exactly the Constitution's Article 4 graph; the only IA-level additions: (a) thread messages may carry a `cardRef` pointing at a Visit/Membership/Protection — cards in conversation are references, never copies; (b) Moments carry optional `visitId+act` so the evidence chain and the timeline are one dataset viewed two ways. **Merge:** there is no separate "chapter" store — a chapter is `visit + its moments + its records`, composed at read time.

---

## 3 · State registry (every machine, every state)

All UI state derives from these machines. No screen may hold a status of its own.

| Machine | States | Customer-visible rendering |
|---|---|---|
| Visit | `proposed(author) → agreed → arrived → inspected → in_care → finished → revealed → archived`, exits: `declined`, `expired`, `cancelled` | proposed→capsule/thread card · agreed→Now layer countdown · arrived…revealed→the Stay's five acts · archived→chapter |
| Term (Protection & Membership) | `active → waning(30d) → expiring(7d) → expired/grace(7d) → renewed \| lapsed` | truth line + protection layer wording; club card wording |
| Vehicle | `added → portrait_made → in_care_cycle → listed? → transferred \| retired` | glance completeness; identity layer actions |
| Party | `onboarding → owner ⇄ member → dormant → returning (+advocate flag)` | which shelf rows/invitations exist |
| Thread message | `sent → delivered → read` | quiet; no read-receipts shown to customer |
| Sheet | `closed → open → confirming? → done \| dismissed` | URL param presence |
| Connectivity | `live → cached(stale) → offline` | whisper line only |

**Translation layer (hard boundary):** ops's raw booking statuses map to Visit states in exactly one function; the mapping table ships in the engineering plan. No ops string ever renders under `/app`.

---

## 4 · Navigation paths (every way to move)

### 4.1 The gesture grammar (global, invariant)

| Gesture | Meaning — always |
|---|---|
| Vertical scroll on Glance | Depth into ownership (Now → Protection → Timeline → Identity → Relationship) |
| Horizontal swipe on portrait | Between vehicles; last page = add-a-car invitation |
| Capsule tap | Live visit → the Stay; otherwise → the Conversation (`/app/desk`) |
| Capsule long-press | Shelf shortcuts (jump to a layer/focus) — power path, never required |
| Avatar tap | `?sheet=you` |
| Swipe down / scrim tap | Dismiss sheet; collapse the Stay back to Glance |
| Left-edge swipe / back | Pop push page (chapter, desk) to Glance |
| Tap timeline entry | `/app/chapter/[visitId]` (or full-screen moment view for non-visit moments) |

### 4.2 The eight arrival intents → paths (constitutional test, restated as spec)

| Intent | Path | Gestures |
|---|---|---|
| What's happening with my car | open → Glance | 0 |
| Book / arrange care | capsule → desk → arrange (or accept open proposal card) | 1–2 |
| See my second car | swipe | 1 |
| Check membership | capsule → desk shelf "Club" (or scroll to Relationship) | 2 |
| Renew protection | truth line/capsule when waning; else desk shelf "Protection" | 1–2 |
| Find an old invoice | capsule → desk search | 2 |
| Update profile | avatar (or desk shelf "You") | 1 |
| Contact AutoModz | capsule → thread (it *is* the desk) | 1 |

### 4.3 State-driven navigation (the product moves you)

- Visit enters `arrived` → the Stay auto-presents over the Glance (once per state change, collapsible).
- Visit enters `revealed` → the Stay presents the reveal even if collapsed.
- Visit `archived` → Stay dissolves into `/app/chapter/[id]` (signature animation).
- Term edge with an authored proposal → capsule text changes; nothing presents itself. State may *present* only custody-related surfaces; commerce never auto-presents.

---

## 5 · Deep links (complete registry)

Every push and every share resolves to one of these; no link may land on a generic screen.

| Link | Lands on |
|---|---|
| `/app` | Glance, last-viewed vehicle |
| `/app?car=X` | Glance, vehicle X |
| `/app/visit/X` | The Stay for visit X (or its chapter if archived, its thread card if proposed) |
| `/app/chapter/X` | Owner chapter |
| `/chapter/X` | Public chapter (share) |
| `/app/desk` | Conversation, thread bottom |
| `/app/desk?focus=protection:X \| club \| records \| studio` | Conversation with shelf focus opened |
| `/app?sheet=visit-agree&visit=X` | Glance + agree sheet |
| `/app?sheet=join-club` | Glance + join sheet |
| `/app?sheet=you§ion=notifications` | Preferences |
| `/cars/[id]`, `/store`, `/` | Public, unchanged |
| Legacy `/dashboard/*`, `/invoice/[id]` | 301 per §1.2 map |

---

## 6 · Document pages

Two document types exist (a document = permanent, addressable, shareable):

1. **Chapter** (`/app/chapter/[id]` owner · `/chapter/[id]` public) — one visit: hero, acts, evidence chain, work in human language, craftsman, amount (owner-only), protections applied with expiries, share. *This is the invoice.*
2. **Record view** (within desk `focus=records`; individual records open in-place full-screen) — filed documents: care records list (each → its chapter), and future kinds (RC, policy) render as a typed document page from the same Record object. No separate route until a record kind exists that is not a chapter; when it does, it claims `/app/record/[id]` — the slot is reserved here so no one invents an alternative.

---

## 7 · Notification entry points (complete)

The lifecycles are the *only* emitters (Constitution Art. 14). Full registry — every push, its trigger, and its deep link:

| # | Push | Trigger (machine edge) | Deep link | Opt |
|---|---|---|---|---|
| 1 | Prep note ("We're ready for the C 43 tomorrow at 10") | visit `agreed`, T-1 evening | `/app/visit/X` | default on |
| 2 | Custody ("The C 43 is with us — safe at 9:58") | visit → `arrived` | `/app/visit/X` | always |
| 3 | Inspection note (only if findings) | visit → `inspected` with findings | `/app/visit/X` | default on |
| 4 | Craft moment photo drop | moment authored during `in_care` | `/app/visit/X` | **opt-in** |
| 5 | Honest delay ("running 40 minutes long — the interior deserved it") | slot overrun threshold | `/app/visit/X` | always |
| 6 | The reveal ("Come and see it") | visit → `revealed` | `/app/visit/X` | always |
| 7 | Chapter filed | visit → `archived` | `/app/chapter/X` | default on |
| 8 | Follow-up (human line, days later) | studio-authored thread message | `/app/desk` | default on |
| 9 | Protection waning | term → `waning` (once) | `/app?sheet=visit-agree&visit=X` (the authored proposal) | default on |
| 10 | Protection expiring | term → `expiring` (once) | same | default on |
| 11 | Membership renewing | term → `waning` on membership (once) | `/app/desk?focus=club` | default on |
| 12 | Delight moment (anniversary, milestone, memory, seasonal word) | timeline emitter, ≤1/week | `/app?car=X` or `/app/chapter/X` | default on, one switch |
| 13 | Dormancy line (once ever) | party → `dormant` | `/app/desk` | always-on but once |

Budget enforcement is structural: emitters 9–13 pass through one gate that enforces ≤2/week outside live visits. In-app there is **no inbox, no bell, no badge** — the capsule and truth line are the ambient layer; history is the thread.

---

## 8 · Merges performed (the "two screens, one problem" audit)

| Problem | Structures that both solved it | Merged into |
|---|---|---|
| "Show me a finished visit" | Invoice page + history detail + chapter | Chapter (one component, two routes by audience) |
| "Talk to / hear from the studio" | Support, notifications inbox, WhatsApp float, offers | The Conversation (thread) |
| "Start care" | Booking wizard, proposal card, renewal CTA, offer redemption | Visit in `proposed` + `visit-agree`/`visit-arrange` sheets |
| "Find something old" | History filters + notifications list | Desk search |
| "My cars" | Garage page + vehicle sheet + glance | The Glance (swipe) + `car-form` sheet |
| "Pay" | Wizard payment step + membership payment view | `pay` sheet (one, parameterised) |
| "Who am I" | Profile page + settings | `you` sheet |

Nothing else in the product shares a purpose. **End of IA.** Phase 2 (UX flows) builds on these routes, sheets, states, and links without adding any.
