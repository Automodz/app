# P2 - THE CONVERSATION · Audit & Kill List
Audit before code. HEAD `00d4fd4`.

## A · Booking flows found
| Location | Role | Verdict |
|---|---|---|
| `app/dashboard/booking/page.tsx` (1085 ln) | the 6-step wizard | **DELETE** |
| `lib/services/bookings.ts` `createBooking` (forces `status:'pending'`) | creation engine | **REUSE** - arrange sheet calls it verbatim |
| `lib/availability.ts` `getAvailability`, `getAvailableDates`, `generateTimeSlots` | slot engine | **REUSE** |
| pricing (`service.price`, membership-wash coverage, discount) | pricing engine | **REUSE**, do not rewrite |
| `lib/cx/goals.ts` `recommend`/`GOALS` | wizard goal-picker | **KEEP** (still used by care P3, history P4) - dies with them |

## B · Proposal flows found
- **None generate proposals.** `visitPhase()==='proposed'` only *reads* ops `pending`. No engine turns a waning protection into a proposal. → **BUILD** `lib/os/proposal.ts` (pure derivation on the existing term engine + `deriveProtection`; no duplication). One open proposal per vehicle, each citing its source object.

## C · Contact / support flows found
- `wa.me` handoff in `app/app/page.tsx` ×2 (deskRow "The studio"; "Message the studio"). WhatsApp is the human channel at launch (Constitution Art. 8). → **KEEP as the composer target**, moved *inside* the Conversation.
- `getBookingWhatsAppMsg` (wizard) → dies with wizard; not needed by arrange (studio confirms the proposed visit).

## D · Search implementations found
- **None.** `Desk.tsx` comment defers it. → **BUILD** one search inside the Desk over the customer's own objects (visits/chapters/records/protections/membership). No second search anywhere.

## E · Thread / message implementations found
- **None** customer-side (`lib/services/activity.ts` is the admin log, unrelated). No message collection exists. → Conversation is a **derived projection** of real objects (proposal card + visit cards + system state lines), composer → WhatsApp. **No stored/fake messages** - honors "never fake conversations."

## F · TODO(P2) bridges (all must be gone at commit)
| Line | Bridge | Resolution |
|---|---|---|
| 10 | header list | rewrite to P2 reality (car-form → P7) |
| 40 | `CxVehicleForm` "replaced by car-form" | **re-scope TODO(P7)** - form is a working converged adapter, not booking-specific; car-form+portrait is onboarding |
| 147 | agreed-capsule → `/dashboard/care` | → open **Desk** (the visit lives in the conversation) |
| 158 | deskRow care → `/dashboard/booking` | → **arrange sheet** |
| 255 | Now Change/Cancel → `/dashboard/care` | → open **Desk conversation** (visit management lives there; adjust/cancel sheet is not in P2's IMPLEMENT list) |
| 282 | expired Renew → `/dashboard/booking` | → **arrange sheet** prefilled with the protection category (renewal = a proposal) |
| 316 | "Arrange one" → `/dashboard/booking` | → **arrange sheet** |
| 420 | "Message the studio" → raw `wa.me` | → open **Desk conversation** |
| 465 | `AddCarSheet` comment | re-scope TODO(P7) |
| - | deskRow "The studio" `wa.me`, "The Club" `/dashboard/subscriptions` | studio → Desk composer; Club → **TODO(P6)** (join sheet is P6, keep marked) |

## G · Deletions this commit
1. `app/dashboard/booking/page.tsx` - the wizard.
2. `next.config.js`: add `/dashboard/booking → /app?sheet=arrange` (301) so surviving legacy pages (care/subs/history/vehicles, P3–P6) that link to it stay alive without the wizard, no dead route.
3. `lib/services/bookings.ts:126` push url `/dashboard/booking` → `/app`.
4. All in-`/app` links to `/dashboard/booking` repointed to the arrange sheet.

## H · Build this commit
1. **Desk = Conversation + Search + Shelf** (one surface): search field · thread (proposal card + visit cards + composer→WhatsApp) · adaptive shelf. Rewrite `components/os/Desk.tsx` + wire in `/app`.
2. **`lib/os/proposal.ts`** - `proposalFor(vehicle, protections, membership, lastCaredOn)` → `Proposal | null`, source-cited, one-per-vehicle; unit-tested in `__tests__/os.test.ts`.
3. **Arrange sheet** (`?sheet=arrange`) - car → service → slot → confirm; reuses `createBooking` + availability + pricing + membership-wash. Under 4 taps for the pre-answered path.
4. Capsule: proposal state (line + "Yes") from `proposalFor`; quiet → Desk (already wired).

## I · Not P2 (untouched)
Care/Stay (P3), Chapter (P4), Protection/Papers pages (P5), Club join sheet (P6, keep `TODO(P6)`), onboarding car-form (P7). Legacy `passport.ts` still carries a constitution-banned `CareScore` - **flagged, dies in P5**, not touched now.

## J · Quality gate
tsc · lint · build · browser {320,375,390,430,768,1280} · no dup listeners · no dup booking logic · no dup conversation/search logic · no dead routes · **zero TODO(P2)**.
