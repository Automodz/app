# THE OWNERSHIP STATE MAP

The UI is a **renderer of state**, not a collection of conditions.

Every state below is produced by `lib/os/ownership.ts` - an engine that already
exists and is already tested. Nothing here re-implements it. This document is
the contract between that engine and the Home surface: given a state, exactly
what the screen shows.

## The objects

Seven, and only seven. Every surface in the product is a projection of these.

| Object | Source of truth | Engine |
|---|---|---|
| **Car** | `CarPicture.vehicle` | - |
| **Protection** | `CarPicture.protections` | `os/protection`, `os/term` |
| **Visit** | `CarPicture.visits` (sealed) | `os/visit` |
| **Membership** | `CustomerPicture.subscription` | `os/club` |
| **Timeline** | derived from all of the above | `os/moment` (extended) |
| **Studio** | `lib/company` | - |
| **Owner** | `CustomerPicture.user` | - |

## Resolution order

The engine resolves **top-down, first match wins**. This order is the product's
priority judgement and must not be reordered casually.

```
vehicleCount === 0 ─────────────────────► new
live visit ─────────────────────────────► ready | in_studio
declined / no-show ─────────────────────► declined
agreed | proposed ──────────────────────► booked
club grace | lapsed ────────────────────► membership_attention
protection waning | expiring ───────────► warranty_expiring
no completed visits ────────────────────► unvisited
90+ days since last visit ──────────────► dormant
has active protection ──────────────────► protected
otherwise ──────────────────────────────► settled
```

**`needs_care` is not a state.** The proposal engine (`os/proposal`) produces a
recommendation that *modifies* the steady states (`protected`, `settled`,
`dormant`). Modelling it as a state would put it in competition with `in_studio`,
and a car cannot be both in the studio and overdue for a wash. It is a **layer**.

---

## The map

Each state declares six things. `-` means the region is **absent**, not empty:
§15.7 - absence is silence, never a placeholder.

### 1 · `new` - no car yet

| | |
|---|---|
| **Hero** | Studio photograph, no vehicle. Awaiting height (`grid.hero.awaitingPhoto`). |
| **State** | "Your car's place is ready." |
| **Timeline** | - |
| **Protection** | - |
| **CTA** | **Add your car** → car form |
| **Transitions** | → `unvisited` on first vehicle |

### 2 · `unvisited` - a car, no story

| | |
|---|---|
| **Hero** | Vehicle photo if present, else awaiting ground |
| **State** | "The {car} hasn't been in yet." |
| **Timeline** | Single event: **Added to the garage** |
| **Protection** | Invitation - "Add what protects this car." |
| **CTA** | **Arrange a visit** → studio |
| **Transitions** | → `booked` · → `protected` on declared protection |

### 3 · `booked` - a visit is agreed

| | |
|---|---|
| **Hero** | Vehicle, full band |
| **State** | Confirmed → "Booked in"; requested → "Requested". Line: `{service}, {day} at {time}` |
| **Timeline** | **Visit booked** as the newest event, ahead of the present |
| **Protection** | Current status, unchanged |
| **CTA** | **Manage the visit** → manage expansion (reschedule / cancel) |
| **Transitions** | → `in_studio` on arrival · → `declined` on refusal/no-show · → steady on cancel |

### 4 · `in_studio` - the car is with us

| | |
|---|---|
| **Hero** | Live frames from the job if any, else vehicle. **Takeover** - no nav (§13.2) |
| **State** | Act word from `os/visit` (`ACT_TITLE`), line from `ACT_LINE`. ETA from `os/stay` |
| **Timeline** | Live event, pinned, progressing |
| **Protection** | Suppressed - one subject at a time |
| **CTA** | **Follow the visit** → visit surface |
| **Transitions** | → `ready` when the act reaches ready |

### 5 · `ready` - finished, waiting to be collected

| | |
|---|---|
| **Hero** | After-frames from the visit |
| **State** | "Ready" - "The {car} is ready to collect." Note: service name |
| **Timeline** | Live event resolving |
| **Protection** | Any protection the visit just created, newly lit |
| **CTA** | **See the visit** → visit surface |
| **Transitions** | → *delivered* on collection (see below) |

> **`delivered` is a transition, not a state.** On collection the visit completes
> and ownership falls through to `protected` or `settled`. The moment is carried
> by the **Timeline** (a `Visit completed` event) and by a one-time arrival
> animation - not by a state the car can sit in. Modelling it as a state would
> create one nothing could ever leave.

### 6 · `declined` - refused or missed

| | |
|---|---|
| **Hero** | Vehicle, unchanged |
| **State** | No-show → "Missed" / "The {car} missed its slot."; refused → "Not taken" / "We couldn't take that visit." Note: rejection reason |
| **Timeline** | **Visit declined** event |
| **Protection** | Unchanged |
| **CTA** | **Arrange again** → studio |
| **Transitions** | → `booked` on rebooking |

### 7 · `membership_attention` - the Club needs answering

| | |
|---|---|
| **Hero** | Vehicle, unchanged |
| **State** | Lapsed → "Your membership has lapsed."; grace → "Your membership needs renewing." Note: `club.context` |
| **Timeline** | **Membership lapsed** / **renewal due** |
| **Protection** | Membership rendered **as a protection**, at attention tone (§15.2) |
| **CTA** | Lapsed → **Rejoin the Club**; grace → **Renew the Club** → membership expansion |
| **Transitions** | → steady on renewal |

### 8 · `warranty_expiring` - a layer is waning

| | |
|---|---|
| **Hero** | Vehicle, unchanged |
| **State** | "Care due" - the waning layer named |
| **Timeline** | **Warranty expiring** event |
| **Protection** | The waning layer **first**, at caution/urgent tone |
| **CTA** | **Renew it** → studio, category preselected |
| **Transitions** | → `protected` on renewal · → `settled` on lapse |

### 9 · `dormant` - 90+ days quiet

| | |
|---|---|
| **Hero** | Vehicle, unchanged |
| **State** | "Resting" |
| **Timeline** | Full history, last event distant |
| **Protection** | Current status |
| **CTA** | Proposal if any, else **Arrange a visit** |
| **Transitions** | → `booked` |

### 10 · `protected` - steady, something shields it

| | |
|---|---|
| **Hero** | Vehicle, full band |
| **State** | "Cared for" |
| **Timeline** | Full history |
| **Protection** | All layers, healthy tone |
| **CTA** | Proposal if any (**Arrange it** / **Renew it**), else **Arrange a visit** |
| **Transitions** | → any |

### 11 · `settled` - steady, nothing shields it

Identical to `protected` except **Protection** shows the invitation rather than
layers, and the proposal is more likely to fire.

---

## The `needs_care` layer

When `os/proposal` returns a `Proposal`, it overrides the CTA of `protected`,
`settled` and `dormant` only:

- word → **Care due**
- line → `proposal.headline`
- note → `proposal.reason`
- CTA → `Washing` ? **Arrange it** : **Renew it**, category preselected

It never overrides `in_studio`, `ready`, `booked`, `declined` or
`membership_attention` - those are live facts and outrank a recommendation.

---

## Timeline events

`Journey` is retired. The **Timeline** is a living ownership record, reusable on
Home, Vehicle and History. Every event is `{ id, at, kind, title, line?, media?, ref? }`.

| Kind | Emitted from | Title |
|---|---|---|
| `acquired` | `vehicle.createdAt` | Added to the garage |
| `visit_booked` | booking agreed/proposed | Visit booked |
| `visit_completed` | booking completed | {service} completed |
| `visit_declined` | declined / no-show | Visit not taken |
| `protection_started` | protection `startedAt` | {layer} applied |
| `protection_expiring` | term waning/expiring | {layer} expiring |
| `protection_lapsed` | term lapsed | {layer} lapsed |
| `membership_started` | subscription start | Membership started |
| `membership_renewed` | cycle rollover | Membership renewed |
| `membership_lapsed` | club lapsed | Membership lapsed |

Sorted newest-first. Future-dated events (a booked visit, an expiring warranty)
sort **above the present** - the timeline runs forward as well as back.

---

## Two gaps requiring your decision

**`sold` does not exist.** There is no disposal concept anywhere: no
`Vehicle.soldAt`, no archived state, no engine branch. Adding it means a schema
field, an engine state, a Firestore rule and a way to trigger it. I have **not**
invented it - say the word and I'll spec it properly as its own piece of work.

**`delivered` is deliberately not a state**, for the reason given under `ready`.
If you want a persistent post-collection state ("collected, awaiting review"),
that is a real product decision and I'll add it to the engine rather than fake it
in the UI.
