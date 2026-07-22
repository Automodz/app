# AutoModz Customer Experience V3
### The Vehicle Care Companion - audit, psychology, and complete redesign proposal

> Scope: everything customer-facing. Preserved untouched: Firestore schema, booking/availability engines,
> permissions, payments logic, notification plumbing, MEDIA/COMPANY/SERVICES content modules.
> The current UI is treated as a prototype, not a constraint.

---

## 1 · Complete Customer Journey Map (as it exists today)

| Stage | Route / Surface | What exists today | Verdict |
|---|---|---|---|
| Discover | `/` | LC1 photo hero, 10 sections, live min-prices, honest reviews link | Strong bones, still reads "sections stacked" not "one film" |
| Explore services | `/#services` | 4 image cards from SERVICES catalog | Cards, not editorial; no comparison; dead-ends into `book` |
| Sign in | `/auth/login` | Google popup, card on glow bg | Functional; transactional feeling at an emotional moment |
| Home (authed) | `/dashboard` | Stats row, membership twin gauges, Book CTA, service tiles, recent | A dashboard. The customer doesn't want a dashboard |
| Vehicle | `/dashboard/vehicles` | **Passport v1 (just shipped)**: protection badges, care timeline, sheet | Right direction; becomes the app's centre in V3 |
| Booking | `/dashboard/booking` | 6-step wizard (Vehicle→Service→Schedule→Review→Payment→Done), 1,085-line form | Complete but *form-shaped*: 6 labelled steps, small imagery, no bay awareness surfaced, no estimated completion |
| Payment (booking) | inside wizard | UPI txn-id entry / pay-at-studio | Manual txn id = trust leak |
| Confirmation | wizard "Done" step | Static success | No anticipation created; no add-to-calendar; no "what happens next" |
| Waiting → Delivery | `/dashboard/history` | Filter tabs, cards w/ thin progress bar, detail sheet w/ status timeline | The signature moment of the whole business is hidden inside a *history page's detail sheet* |
| Invoice | `/invoice/[id]` | Public shareable invoice, photos, rating card | Good; disconnected from journey |
| History | `/dashboard/history` | List + filters | Records, not memories. No photos, no story |
| Membership | `/dashboard/subscriptions` | 732-line plans + UPI flow, twin gauges on home | Sells a subscription, not a club |
| Notifications | `/dashboard/notifications` | List + per-category prefs | Copy is robotic ("Booking status updated") |
| Offers / Referral | `/dashboard/offers`, `/refer` | Promo list; referral code share | Two thin pages for one idea: "AutoModz rewards you" |
| Marketplace | `/cars`, `/dashboard/sell-car` | Listings + sell request | Separate business; must not pollute the care journey |
| Rebooking | Garage "Book a service" (v1) | Preselects category | Seed of the loop; no *reason to return* generated yet |

**Interaction inventory** (today): 1 bottom-nav (5 tabs + centre Book), 4 bottom-sheet patterns (garage detail,
history detail, add-vehicle, membership pay), 1 wizard, filter tab rows, toast feedback, framer-motion stagger
reveals, shimmer skeletons, empty states on all lists, PWA offline fallback page. Failure states are toasts;
success states are toasts + static screens.

---

## 2 · Pain Points (ranked by emotional cost)

1. **The wait is silent.** Between "booking confirmed" and "ready", the app shows a status *word*. This is the
   window when the customer's ₹2L car is in someone else's hands - peak anxiety, zero theatre. Domino's built an
   empire on exactly this window.
2. **Booking feels like paperwork.** Six named steps, dropdown-density, price appears late, no sense of the
   studio's actual capacity ("tomorrow's protection bay is free" is *known* by the availability engine and never shown).
3. **The home screen is a report.** Stats and gauges answer the business's questions, not the customer's one
   question: *"what's happening with my car, and what should happen next?"*
4. **Payment trust leak.** Typing a UPI transaction ID feels like a parking lot, not a Porsche service centre.
5. **History is a ledger.** Completed services vanish into rows. No photos resurface. The ₹45,000 ceramic memory
   is one grey line.
6. **Membership is arithmetic.** Washes-remaining gauges say "subscription"; nothing says "you belong here."
7. **Robotic voice.** "Booking status updated" vs "Your Defender has entered the wash bay."
8. **No pull to reopen the app.** Without an active booking there is no coating countdown, no recommendation,
   no reason to open it. Retention is left to memory.

## 3 · UX Problems (structural)

- **Navigation is flat**: five equal tabs pretend Home, History, Garage, Profile are peers. They aren't - the
  *car* is the object; everything else is context around it.
- **Wizard state lives in one 1,085-line component**; each step is a screenful of controls rather than one decision.
- **Two currencies of progress** (thin bar on cards, step list in sheet) - no single canonical tracking surface.
- **The invoice, photos, protection, and history of one car live in four places** (invoice page, job photos,
  garage sheet, history) - V1 garage began the merge; V3 finishes it.
- **Empty states instruct instead of invite** ("Add your vehicles to start booking services").

## 4 · Psychology Analysis

- **Endowment effect** - the more the app reflects *their specific car* (name, plate, its protection layers,
  its photos), the more the app feels like part of owning the car. The Garage must therefore be the app's
  emotional centre of gravity, not a tab.
- **Goal-gradient + operational transparency** - visible progress through the studio (Uber/Domino's) converts
  anxiety into anticipation, and *watching work happen* increases perceived value of the work itself
  (the "labor illusion" - Buell/Norton). We have the real stages streaming from the Studio OS; showing them is free value.
- **Peak–end rule** - the remembered experience is the peak (watching the car in the bays / the reveal photo)
  and the end (pickup + payment). Both deserve the most design investment; today both are the *least* designed.
- **Zeigarnik effect** - an open loop ("ceramic curing - final inspection tomorrow 11:00") makes reopening the
  app compulsive during a service.
- **Loss aversion for retention** - "PPF protected until Jan 2036" reframes lapsing maintenance as *losing
  protection*, which drives rebooking far harder than a discount push ever will.

## 5 · Trust Analysis

Trust is built by: real photos of *their* car at every stage (before/during/after already captured by
technicians), named technician ("Rahul is detailing your interior"), honest timestamps (real
`statusHistory` timestamps, never fabricated ETAs), the delivery-payment gate surfaced as a receipt moment,
warranty stated as a commitment with a date, and a voice that sounds like a concierge, not a CRM.
Trust is destroyed by: placeholder photography of other people's cars presented as ours (current Unsplash set is
acceptable *scaffolding* but CX-8 photography swap is a trust milestone, not a nice-to-have), fake reviews,
invented ETAs, and dead notification copy.

## 6 · Emotional Journey (target)

| Stage | Emotion to engineer | Mechanism |
|---|---|---|
| Discover | *Desire* | cinematic photography, one message per viewport |
| Book | *Guided confidence* | one decision per screen, live availability, price always visible |
| Confirmed | *Anticipation* | countdown card, "what happens next" rail, calendar add |
| In service | *Fascination* | live stage rail + photos + technician + honest ETA |
| Ready/pickup | *Pride* | the reveal: after-photo full-bleed, "ready whenever you are" |
| After | *Ownership* | passport updated, protection extended, journey entry with photos |
| Idle months | *Belonging* | coating health, next-care recommendation, club status |

---

## 7 · Complete Redesign Proposal

### The concept: **"Your car has a home screen."**

The authed app reorganises around three surfaces (not five tabs):

```
CAR  ·  the vehicle passport, now the app home (merged garage+home)
CARE ·  one canonical flow: book → track → history ("Journey")
CLUB ·  membership, rewards, referral, offers (merged)
```
Profile/notifications collapse into a header sheet. Marketplace (`/cars`, sell-car) stays a separate
public surface linked from CLUB - it is a different business and never interrupts care.

### 8 · New Navigation

- **Bottom bar: 3 destinations + 1 action.** `CAR · CARE · CLUB` + centre **Book** button (persistent, thumb-zone).
- **Active service takeover:** when a booking is live, a **Live Activity bar** docks above the bottom bar on
  every screen (car name · current stage · ETA) and opens the Tracker full-screen. The tracker is a surface,
  not a page-in-a-tab - Uber's model.
- All secondary flows (add vehicle, booking detail, invoice, plan purchase, preferences) remain bottom sheets.
  Zero new page navigations inside the authed app.

### 9 · New Information Architecture

```
/                    cinematic marketing film (public)
/auth/login          arrival moment ("Welcome to the studio")
/app                 CAR   - passport of the selected vehicle (multi-car switcher)
/app/care            CARE  - Tracker (live) | Journey (past) | Book (entry)
/app/care/track/[id] full-screen live tracker (deep-linked from push)
/app/club            CLUB  - membership, rewards, referral, offers
/invoice/[id]        unchanged public receipt
/cars, /dashboard/sell-car   marketplace, unchanged
```
Old `/dashboard/*` routes 301 into the new IA (bookmarks + push URLs keep working).

### 10 · Motion System

One choreography, two engines, strict division of labour:
- **GSAP + ScrollTrigger (+ Lenis)** - *public marketing only*: homepage scroll film, image parallax,
  kinetic headline reveals, section hand-offs. Install fresh; the homepage's framer-motion reveals migrate.
- **Framer Motion** - *authed app only*: it already runs every sheet/list/layout transition there; it stays and
  GSAP never enters the app bundle. One interaction = one engine, never both.
- **Motion tokens** (single file): `ease: [0.22,1,0.36,1]`, durations 150/350/700ms, arrival = fade+8px rise,
  departure = fade+4px fall, state-change = colour cross-fade + one pulse. Nothing bounces, spins, or overshoots.
- Signature moments (the only "big" motion allowed): tracker stage advance (rail light travels to next node),
  booking confirmation (ticket composes itself), ready-reveal (after-photo expands from the stage node).

### 11 · Component System

Primitives via **shadcn/ui** (installed, restyled to AutoModz tokens, replacing hand-rolled equivalents 1:1 -
old pattern deleted the same commit it is replaced): Drawer/Sheet, Dialog, Calendar (booking date), Command,
Tabs, ScrollArea, Tooltip, Toast (sonner). Before any custom interaction is built, check 21st.dev for the
pattern (tracker rails, tickets, comparison sliders) and adapt.
AutoModz components (the only customs allowed): `StageRail`, `LiveActivityBar`, `PassportCard`,
`ProtectionSeal`, `JourneyEntry`, `ServiceTicket`, `PriceBlock`, `PhotoReveal`, `ConciergeNote`.
Everything consumes MEDIA / COMPANY / SERVICES / Firestore. No inline content, ever.

### 12 · Screen-by-Screen Wireframes

**CAR (app home)**
```
┌─────────────────────────────┐
│ DEFENDER 110       ⌄ switch │  ← vehicle name is the headline
│ GJ01 AB 1234                │
│ [ hero photo - latest after │
│   shot of THIS car, else    │
│   MEDIA fallback ]          │
│ ● PPF PROTECTED · JAN 2036  │  ← ProtectionSeal row
│ ● CERAMIC · RENEW IN 3 MO   │
│ NEXT CARE  Maintenance coat │  ← one recommendation, one CTA
│            suggested March  │
│ ───────────────────────────│
│ 12 visits · ₹2.4L lifetime  │
│ CARE TIMELINE (last 3) →    │
└─────────────────────────────┘
│ [LIVE BAR when active]      │
│  CAR    CARE   (BOOK)  CLUB │
```

**BOOK (one decision per screen, full-height panes, swipe-back)**
```
1 WHICH CAR      big passport cards (remembered default)
2 WHAT           editorial service panes, full-bleed image, price + duration
                 + warranty huge; "compare" as horizontal swipe between panes
3 WHEN           shadcn Calendar fed by availability engine; day shows
                 bay truth: "Protection bay free · pickup same day 6pm"
4 CONFIRM        ServiceTicket composes: car + service + slot + price
                 → pay at studio (default) or UPI
✓ CONFIRMED      ticket stamps, countdown starts, add-to-calendar,
                 "what happens next" rail preview
```

**TRACKER (signature surface, full screen)**
```
DEFENDER 110 · IN THE STUDIO
┌────────────────────────────┐
│  ✓ Confirmed        09:00  │
│  ✓ Checked in       09:12  │
│  ✓ Rahul assigned          │
│  ● Ceramic - layer 2  now  │   ← live node pulses
│     [during-photo strip]   │
│  ○ Quality check           │
│  ○ Ready · est 4:30 pm     │   ← honest ETA from floor engine
└────────────────────────────┘
READY → full-bleed after-photo reveal + "Pay ₹12,000" / "Get directions"
DELIVERED → journey entry saved · review ask · next-care seed
```
Stages map 1:1 to existing `statusHistory` (+ booking events); photos are the job's real photos; technician from
assignments. **Zero new backend.** Live: reuse `subscribeUserBookings` (already streaming).

**JOURNEY (replaces history)** - vertical story: each visit = JourneyEntry (date headline, service, after-photo
thumb, amount, invoice link, "book this again"). Active filters gone; the live one lives in the Tracker.

**CLUB** - plan as a membership card (wallet-style), benefits as visuals, washes as a filling ring, renewal as
continuation ("your 9th month"), referral as "invite a friend to the studio · both get ₹200", offers folded in.

**HOMEPAGE (public film)** - same 8 beats, recomposed as full-viewport scenes with GSAP scroll choreography:
Hero (one line, one car) → Services as magazine spreads (pinned, image-led, price as typography) → Membership
scene → Before/After (drag slider, full-bleed) → Gallery (real work, Storage-fed) → Trust (rating + address +
hours from COMPANY) → Location → minimal footer. No stacked cards anywhere.

### 13 · Screen Hierarchy

1. **Tracker** (signature - peak emotion, peak differentiation)
2. **CAR passport** (daily home, endowment)
3. **Book flow** (revenue path)
4. **Homepage film** (first impression)
5. **CLUB / Journey** (retention)
6. Login, notifications sheet, invoice (supporting)

### 14 · Interaction Model

- One decision per screen; back = swipe or top-left, always.
- Thumb zone: all primary CTAs bottom-anchored, ≥52px; destructive never in thumb zone.
- Sheets for everything secondary; the base surface never navigates away during a flow.
- Live data animates in place (stage rail, ETA), never via reload.
- Skeletons mirror final layout exactly; success states are moments (ticket stamp, reveal), failures are
  in-place, human, and always offer the next action ("Couldn't reach the studio - retry or WhatsApp us").
- Haptics (PWA vibration where available): stage advance, booking confirm, payment success. Nothing else.

### 15 · Priority Roadmap

| # | Phase | Contents | Effort |
|---|---|---|---|
| V3-0 | Foundation | motion tokens file, shadcn install+theme, GSAP+Lenis (public only), route scaffold `/app` + redirects | S |
| V3-1 | **Tracker + Live Activity bar** | StageRail, photos, technician, ETA, concierge copy rewrite of all notifications | M |
| V3-2 | **CAR passport home** | merge dashboard+garage, vehicle switcher, next-care recommendation | M |
| V3-3 | **Book flow v3** | pane-based flow on existing engines, calendar, ticket confirmation | L |
| V3-4 | Journey + CLUB | story history, membership card, rewards merge | M |
| V3-5 | Homepage film | GSAP scroll choreography, editorial services | M |
| V3-6 | Photography swap + polish | real shoots into MEDIA, haptics, PWA QA, delight pass | S |

Each phase ships independently behind the existing auth; old routes redirect only when their replacement ships.

### 16 · Estimated Impact

- **Tracker (V3-1)** - highest: converts the anxious window into the product's signature; expected push
  open-rates and unsolicited shares ("look at my car's screen") - this is the feature customers describe to friends.
- **Passport home (V3-2)** - retention: the app becomes part of owning the car; protection-expiry loops feed
  bookings without discounts.
- **Book v3 (V3-3)** - conversion: fewer decisions per screen + visible availability + price-forward panes
  should measurably cut abandonment (instrument step completion before/after).
- **Homepage film (V3-5)** - first-impression trust and premium price justification.
- **Concierge copy (inside V3-1)** - cheapest change with the most tone impact in the whole plan.

---

*Nothing in this document requires a schema change, a new Firestore query pattern, or touching the Studio OS.
Every "live" feature rides `subscribeUserBookings`, `statusHistory`, job photos, and the availability engine
that already exist.*
