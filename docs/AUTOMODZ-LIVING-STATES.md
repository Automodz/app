# Living States

**Status: binding.** Companion to the Constitution, Art. 10 and Art. 18. Ratified 2026-07-25.

> **Never show documents. Show living states.**
> Every warranty, policy, certificate, invoice and membership is a status card with health, expiry and actions. The file is always one tap away. It is never the interface.

---

## 1 · The law

Apple Wallet does not show you a boarding pass PDF. It shows you a card that knows it is a boarding pass — gate, seat, time, status — and the document is an implementation detail you never think about.

Protection in AutoModz works the same way, and it is **wider than detailing**. What protects a car is physical, financial and legal at once:

```
┌──────────────────────────────────────┐
│  BMW M340i                           │
├──────────────────────────────────────┤
│  ● Protected                         │
│  ● PPF            Lifetime           │
│  ● Insurance      47 days            │
│  ● PUC            18 days            │
│  ● Ceramic        Active             │
│  ● FASTag         Low balance        │
│  ● Next wash      12 days            │
└──────────────────────────────────────┘
```

**There is not a single document on screen, yet every important document is represented.** That is the whole idea. It also solves the retention problem honestly: the reason to open the app monthly is compliance, and compliance here reads as care rather than admin.

**The same law governs alerts.** A list of notifications is the same mistake as a list of PDFs. There is no inbox — state changes surface as living state in the Garage, and delivery happens by push.

---

## 2 · The ten kinds

| Kind | Class | Term | Provider example | Renewable by |
|---|---|---|---|---|
| `ppf` | physical | perpetual \| dated | Garware Platinum | AutoModz |
| `ceramic` | physical | dated | Kovalent Graphene | AutoModz |
| `glass` | physical | dated | — | AutoModz |
| `interior` | physical | dated | — | AutoModz |
| `warranty` | legal | dated | manufacturer / extended | third party |
| `insurance` | financial | dated | ICICI Lombard | third party |
| `puc` | legal | dated | — | third party |
| `rc` | legal | perpetual \| dated | — | third party |
| `fastag` | financial | **balance** | — | third party |
| `membership` | relational | dated + grace | AutoModz | AutoModz |

A new kind is data, not code. **If a new kind needs a new card, the kind is wrong.**

---

## 3 · The generalised Term

`lib/os/term.ts` already implements the lifecycle — `active → waning(30d) → expiring(7d) → grace(7d) → lapsed` — and the Constitution already ratified that Protection and Membership share it (demolition finding §4). One generalisation is required, because **state is not always time**:

```ts
type Term =
  | { kind: 'dated';     expiresOn: string; grace?: boolean }  // insurance, PUC, ceramic
  | { kind: 'perpetual' }                                       // lifetime PPF, RC
  | { kind: 'balance';   value: number; low: number };          // FASTag

type Health = 'healthy' | 'attention' | 'urgent' | 'lapsed';
```

| Term kind | Health derivation |
|---|---|
| `dated` | `termState()` → active→healthy · waning→attention · expiring→urgent · grace→urgent · lapsed→lapsed |
| `perpetual` | always `healthy` — it cannot expire, so it never asks for attention |
| `balance` | `value > low` → healthy · `value ≤ low` → attention · `value ≤ 0` → urgent |

**Do not fork the engine.** Everything above extends `lib/os/term.ts`; `daysLeft()` and `termState()` keep their current behaviour for `dated` and gain siblings for the other two.

---

## 4 · The card

One component — `StateCard` — for all ten kinds. Different data, identical language.

```
┌──────────────────────────────────────┐
│  Insurance                     ●     │   kind + health dot
│                                      │
│  ICICI Lombard                       │   provider
│  Comprehensive                       │   plan
│                                      │
│  Expires                             │
│  18 September                        │   the date, in words
│  47 days remaining                   │   the countdown
│                                      │
│  ──────────────────────────────────  │
│  Renew        View original          │   actions
└──────────────────────────────────────┘
```

```
┌──────────────────────────────────────┐
│  Paint protection film         ●     │
│                                      │
│  Garware Platinum                    │
│  Lifetime warranty                   │
│                                      │
│  Installed                           │
│  12 July 2026                        │
│  Full body                           │
│                                      │
│  ──────────────────────────────────  │
│  Photos    Warranty    Invoice       │
└──────────────────────────────────────┘
```

### Contract

```ts
interface StateCardModel {
  kind: ProtectionKind;
  title: string;            // "Insurance", "Paint protection film" — never a catalogue SKU
  provider?: string;        // "ICICI Lombard", "Garware Platinum"
  plan?: string;            // "Comprehensive", "Lifetime warranty"
  coverage?: string;        // "Full body"
  term: Term;
  health: Health;
  since?: string;           // installed / issued
  visitId?: string;         // the work that created it — resolves to its Chapter
  document?: { url: string; label: string };   // View original. Never primary.
  actions: StateAction[];   // renew · view photos · view chapter · top up
}
```

### Rules

1. **The document is never the primary action.** *View original* is always last, always quiet.
2. **A card never shows a raw status string.** "Expires 18 September · 47 days remaining", not `status: active`.
3. **A card never names a person.** Not who installed it, not who issued it internally. (Art. 8, the actor law.)
4. **A card that came from a visit links to it.** Tapping through answers *"what did you actually do?"*
5. **Perpetual is stated, not faked.** "Lifetime" renders as lifetime — never as a fabricated percentage or a full progress ring. A ring implies depletion; a lifetime warranty does not deplete.
6. **Lapse is rendered with dignity** (Art. 7). "Rejoin any time — your history holds", never a red scold.

---

## 5 · Where states appear

| Surface | Rendering |
|---|---|
| **Garage** | the chip row — kind + one value, most urgent first, tap to open the card |
| **Card** | the full `StateCard`, in a sheet |
| **Push** | on term edges only, once each (Art. 14) — the state speaking, not an inbox item |

**Chip ordering** is by health, then by urgency of time or balance: `urgent → attention → healthy`. A healthy state never outranks one asking for attention. Cap the row at what fits without wrapping; the rest live in the protection sheet.

---

## 6 · Where the data comes from

| Kind | Source | Created |
|---|---|---|
| `ppf` `ceramic` `glass` `interior` | a sealed Visit | automatically, terms captured at seal (`VISIT-OBJECT.md`) |
| `membership` | `subscriptions` | on purchase |
| `insurance` `puc` `rc` `fastag` `warranty` | the owner, or the studio on their behalf | uploaded — and this is the cold-start problem |

**The cold start is real.** A new customer's financial and legal states are empty until someone enters them. Two paths, both needed:

1. **Owner adds it** — photograph the policy, confirm the expiry. Must be two taps, not a form. Document OCR later reduces it to one.
2. **Studio adds it at intake** — the car is already there and the papers are usually in the glovebox. This is the higher-yield path and it belongs in the intake ritual alongside the photo set.

Until a state exists it is **absent, not empty** (Art. 15.7): the Garage shows the states it has and says nothing about the ones it does not. No "Add your insurance" placeholder card. The invitation belongs in one quiet place, once.

---

## 7 · Tests

1. Editing a service's warranty in admin changes **no** existing protection's expiry.
2. A `perpetual` term never renders a countdown, a percentage or a depleting ring.
3. A `balance` term crossing `low` moves health to attention and fires exactly one push.
4. Every kind renders through the same `StateCard` with no kind-specific branching in the view.
5. No card renders `employeeName`, `craftsman` or `installer`.
6. `View original` is never the first or the only action.
7. A card created by a visit resolves to that visit's Chapter.
