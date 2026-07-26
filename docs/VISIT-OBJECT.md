# The Visit Object

**Status: binding.** Companion to the Constitution, Art. 3 and Art. 18. Ratified 2026-07-25.

> One service event. Append-only while it runs. **Sealed on completion.**
> Everything a visit produces references it, and nothing that references a sealed Visit can change afterwards.

---

## 1 · Why this object exists

Article 3 declared Visit in 2026-07-20 and the code never built it. What shipped instead was `Booking` (commercial truth) and `Job` (operational truth) as a 1:1 pair — a sensible split at the time, and a historical accident: online booking was built first, the walk-in kiosk came later, and a walk-in produces a `Job` with no `Booking`. Two records, one event, and no single thing for anything else to point at.

The consequence was structural, not cosmetic. `deriveProtection()` computed a car's warranties by looking up the **current** `services` catalogue on every read:

```
completed booking → serviceName → services.warranty → "+5 years" → expiry
```

Edit a warranty string in admin — a typo fix, a supplier change — and every past customer's protection silently rewrites itself. A card that says *"PPF · Lifetime · Protected"* cannot be built on a value that is recomputed from mutable data on every render. **The promise has to be captured at the moment it is made.**

Sealing is the fix, and it is a construction-level fix rather than a discipline-level one: after `sealedAt`, there is no code path that can change what the customer was told.

---

## 2 · The shape

```
visits/{id}
  # identity
  vehicleId          string          the car — the aggregate root
  locationId         string          which studio performed it
  source             'requested' | 'walk_in'
  authoredBy         'system' | 'studio' | 'customer'     (Art. 6)

  # the agreement
  requestedFor       { date, time }  what was asked for
  services[]         { serviceId, name, category, price }  priced at agreement
  discount?          { source, label, amount }             resolved at agreement
  amounts            { subtotal, discount, total }

  # the work — append-only while open
  stages[]           { stage, at, note?, media[] }         see JOURNEY-STAGES.md
  bay?               number

  # what it produced — captured, not referenced
  termsCaptured[]    { kind, provider, plan, coverage, term }
                     ↑ the warranty AS SOLD, copied in. Never a catalogue lookup.

  # the seal
  status             'requested' | 'agreed' | 'open' | 'sealed' | 'cancelled'
  sealedAt?          timestamp       after this, immutable

  createdAt  updatedAt
```

### `termsCaptured` is the whole point

At the moment a visit seals, the terms of every protection it created are **copied onto the visit**, verbatim, as they were sold. `protections/{id}` then derives its expiry from `visit.termsCaptured`, never from `services`. Changing the catalogue tomorrow changes what is *offered*; it can never change what was *promised*.

---

## 3 · The lifecycle

```
requested ──agree──> agreed ──arrive──> open ──complete──> sealed
    │                  │                  │
    └──decline─────────┴──cancel──────────┘
                                          └──> cancelled

walk-in:                            open ──complete──> sealed
```

| State | Mutable? | Meaning |
|---|---|---|
| `requested` | fully | Someone asked. System, studio or customer (Art. 6). |
| `agreed` | date, time, services | The studio confirmed. A bay is reserved. |
| `open` | **append-only** | The car is here. Stages and media append; nothing already written is edited. |
| `sealed` | **never** | Done and handed back. The record is permanent. |
| `cancelled` | never | Terminal. Carries its reason. |

**Append-only is not immutable.** While `open`, new stages, notes and media may be added — that is the Journey being written. What may not happen is editing or removing an entry that already exists. The floor corrects by appending a correction, not by rewriting history.

---

## 4 · The seal

Sealing runs once, in a transaction, when the car is handed back:

1. Write `sealedAt`.
2. Copy the terms of every protection this visit created into `termsCaptured`.
3. Create `protections/{id}` rows pointing at this visit.
4. Create the `records/{id}` invoice pointing at this visit.
5. Promote every stage photo and clip into `moments/{id}` with `visitId` set.

After that:

- **Firestore rules reject any write to a sealed visit** except by an explicit, audited `amend` path (an amendment appends a correcting entry and never edits the original).
- Anything that references a sealed visit reads *from the visit*, never from live catalogues.
- The Chapter — the customer-facing rendering of a sealed visit — is therefore reproducible forever, byte for byte.

**Rule sketch:**

```
match /visits/{id} {
  allow update: if isStaff()
    && resource.data.sealedAt == null                  // never touch a sealed visit
    && !request.resource.data.diff(resource.data)
         .affectedKeys().hasAny(['sealedAt','termsCaptured','amounts']);
  // sealing itself goes through the admin SDK, transactionally
}
```

---

## 5 · What references a Visit

```
                        ┌─────────────┐
                        │   VEHICLE   │
                        └──────┬──────┘
                               │ accumulates
                        ┌──────▼──────┐
              ┌─────────┤    VISIT    ├─────────┐
              │         └──────┬──────┘         │
     ┌────────▼───────┐ ┌──────▼──────┐ ┌───────▼────────┐
     │  PROTECTION    │ │   RECORD    │ │    MOMENT      │
     │ terms sealed   │ │ invoice,    │ │ every photo    │
     │ against it     │ │ report      │ │ and clip       │
     └────────────────┘ └─────────────┘ └────────────────┘
              │                │                 │
              └────────────────┴─────────────────┘
                         payments
```

| Object | `visitId` | Why |
|---|---|---|
| `protections` | **required** when studio-applied | the promise must trace to the work that made it |
| `records` | optional | an invoice has one; a policy the owner uploaded has none |
| `moments` | optional | a stage photo has one; a road-trip photo has none |
| payments | **required** | money is always against a service event |

**The optionals are the interesting ones.** A customer's own photograph and a customer's own insurance policy belong to the *vehicle*, not to any visit — they exist because the car exists, not because AutoModz did something. That asymmetry is deliberate: it is what makes the product the home for the car rather than the record of our relationship with it.

---

## 6 · Migration from `Booking` + `Job`

These are the two hottest collections in the business. The studio is live throughout, so nothing is ever rewritten under it.

| Phase | Writes | Reads | Notes |
|---|---|---|---|
| **1** | `booking` + `job` **and** `visit` (dual-write) | old paths | `visit` is derived and verified against the pair; discrepancies logged, not thrown |
| **2** | dual-write continues | **customer surfaces read `visits` only** | `/app` is rebuilt this phase anyway — it is born reading the new object |
| **3** | studio rebuild writes `visits` only | all | `bookings` + `jobs` frozen, then dropped once no reader remains |

**Backfill.** Every historical booking/job pair becomes a sealed visit, with `termsCaptured` reconstructed from the catalogue **as it stands at migration time** — the last moment that reconstruction is legitimate. It is recorded as `termsSource: 'reconstructed'` so a future reader knows the difference between a term that was captured at sale and one that was inferred. After migration, reconstruction is never permitted again.

**Verification gate before Phase 3 flips:** for every historical pair, the derived visit must produce an identical Chapter to the one the old code produced. Byte-identical rendering is the acceptance test.

---

## 7 · What this kills

- `deriveProtection()` in `lib/cx/protection.ts` — becomes the one-time migration, then is deleted (its own header already marks it `TEMPORARY ADAPTER (PRE-1)`).
- The `Booking` / `Job` split, and with it the walk-in special case.
- Any code path that reads `services.warranty` to answer a question about a car that already exists.

---

## 8 · Tests that must exist before this ships

1. A sealed visit rejects every write.
2. Editing a service's warranty in admin changes **no** existing protection's expiry.
3. A walk-in with no prior agreement produces a valid visit.
4. Sealing is idempotent — running it twice creates one set of protections, records and moments.
5. Append-only holds: a stage entry cannot be edited or removed while `open`.
6. Every historical booking/job pair renders an identical Chapter through the new object.
