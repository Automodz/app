# DESIGN PARITY AUDIT - FULL

**Specification:** `AutoModz App.dc.html`, 19 screens
**Code baseline:** `9e8e55c` · **Production:** project `automodz`, read 2026-08-10
**Rule of this document:** nothing is complete because a component exists.

## EVIDENCE MARKS

- **[P]** verified against production data (read-only)
- **[C]** established by reading the code
- **[R]** rendered and observed in a browser
- **[?]** not established - named so it is not mistaken for cleared

---

# 0 · FINDING OF RECORD

**The seal path has never run in production.** All four `visits` documents are
seeded fixtures - ids `vis-demo-bmw-ceramic`, `vis-demo-ceramic`,
`vis-demo-glass`, `vis-demo-ppf`, each `authoredBy: 'studio'`, none carrying a
`jobId` **[P]**. Eight completed jobs exist; none has produced a visit **[P]**.

Every screen downstream of a sealed visit - 11, 13, 15, the album, the service
record, money reconciliation, notification routing - is therefore reading either
fixtures or nothing. **This is the root of the majority of this audit.**

Second structural fact: **the studio side and the customer side are joined only
by a plate string**. 15 of 18 jobs carry no `customerId` **[P]**; jobs attach to
cars by normalised registration **[C]**. One invoice exists for the whole
business **[P]**.

---

# PHASE 1 · SCREEN INVENTORY

Route column: current implementation. 🔴 = no route exists.

### 01 · Welcome
- **Route** `/auth/login` · **Entry** cold start, sign-out, any room while signed out · **Exit** → 02 (new) or 03/04/05 (returning)
- **Primary** Continue with Google · **Secondary** Look around first → `/cars`
- **Fields** wordmark, "Paint protection, coating and detailing", "Ahmedabad · since 2019", privacy line
- **States** idle · authenticating · error(popup blocked / network) · success→redirect
- **Backend** Firebase Google provider; `POST /api/session` mints the cookie

### 02 · Add your car
- **Route** `/garage?add=1` · **Entry** first sign-in, Garage "Add a car" · **Exit** → 03, or Skip → 03 empty
- **Primary** That's my car · **Secondary** Not this car - enter manually · Skip for now
- **Fields** "Signed in as {email}", registration input, resolved `{model}`, `{year} · {colour}`
- **Calculated** registration → make/model/year/colour
- **States** empty · typing · resolving · resolved · unresolved(manual) · duplicate plate · saving · error
- **Backend** `users/{uid}/vehicles` write; **registration resolution** (decided: manual entry)

### 03 · Now - new customer
- **Route** `/` · **Entry** post-onboarding, no visits · **Exit** → 06, → 08
- **Primary** Book a first visit · **Secondary** See what we do to cars
- **Fields** car name, "Nothing in the studio yet", proposition copy, "Next opening · Thu 9:00 am"
- **Calculated** next opening
- **States** no car · car but no visit
- **Backend** availability; vehicle

### 04 · Now - car in the studio
- **Route** `/` · **Entry** live job · **Exit** → 11, → 07 (advisory)
- **Primary** Follow the visit · **Secondary** advisory card
- **Fields** car, "Curing", **3h 40m**, "ready 6:20 pm", service + brand, "Bay 02", phase strip (Prep/Correction/Coat/Cure), advisory sentence
- **Calculated** remaining time, ready-at, phase index, advisory (PPF 41% worn → bundling saves a bay day)
- **States** each act; overrunning; no photos yet
- **Backend** job stage + timestamps, bay, service, protection %, advisory engine

### 05 · Now - resting
- **Route** `/` · **Entry** no live job · **Exit** → 08, → 07
- **Primary** Book the studio · **Secondary** "Worth knowing" advisory
- **Fields** car, "Nothing in the studio", statement, **82%**, "ceramic life", advisory, "Next opening · Thu, 9:00 am"
- **Calculated** protection %, months remaining, next opening
- **States** healthy · attention · lapsed · no protection recorded
- **Backend** `protections` with `since` + `term`; availability

### 06 · Studio
- **Route** `/studio` · **Entry** dock · **Exit** → 07
- **Primary** pick a service
- **Fields** "For the {car}", 8 services: name, "from ₹X", brand + duration line
- **States** catalogue empty · per-car context absent
- **Backend** `services` (price, brand, duration, description)

### 07 · Scope & quote 🔴
- **Route** none · **Entry** 06, advisory from 04/05 · **Exit** → 08
- **Primary** Choose a date
- **Fields** service name; three coverages (Front end ₹45,000 / Full body ₹1,32,000 / Custom "On quote") each with a detail line; add-ons (Two-stage correction "Recommended before film", Ceramic over film "Adds 4 hours"); **Estimate · Gold −12% · ₹1,26,720**; "2 days in the bay"; "Final on inspection"
- **Calculated** scope price + add-ons − member discount; bay days; estimate
- **Customer decisions** coverage (1 of 3), add-ons (n of m)
- **States** none selected · selected · custom→quote · no membership
- **Backend** **scopes, add-ons, one pricing authority**

### 08 · Date & concierge
- **Route** `/studio?arrange=1` (single-day only) · **Exit** → 09
- **Primary** Confirm Wed 12 – Thu 13 Feb
- **Fields** "Full-body PPF · 2 days", "February · 2 consecutive days", day strip, time chips, Concierge pickup toggle + "Included on Gold, both ways", **saved address** "Bodakdev · Home", pickup time 8:40 AM, Estimate
- **Calculated** consecutive-day availability, pickup time from slot, estimate carried
- **States** no slots · partial availability · concierge off · no saved address
- **Backend** **multi-day capacity, addresses**

### 09 · Booked 🔴
- **Route** none · **Exit** → 10, → 03/05
- **Primary** Add to calendar · **Secondary** Manage booking
- **Fields** "The bay is yours", date, collection sentence, Work / In the bay / Back to you / Estimate rows, "Nothing is charged now. You approve the final figure at handover."
- **States** confirmed · pending studio acceptance
- **Backend** booking; ICS export

### 10 · Manage booking 🟡
- **Route** `/studio?manage=<id>` (sheet) · **Exit** → 08, → 09
- **Primary** Move to another date · **Secondary** Change pickup time · Edit the work · Cancel
- **Fields** status + work, dates, three action rows with sub-lines, "Next openings" chips, "No charge - the bay goes back to the calendar."
- **Calculated** **24-hour free-change rule**, next openings
- **States** changeable · locked (<24h) · in progress · cancelled
- **Backend** reschedule rules, availability

### 11 · The visit
- **Route** `/history/[id]` · **Exit** → photos, → studio message
- **Primary** Message the studio · **Secondary** Today's photos · 46
- **Fields** "Visit 14 · Bay 02", service, live chip, caption, 4 timeline entries with **times** and **photo counts**, "Now · 3h 40m left", "Est. 6:20 PM"
- **Calculated** visit ordinal, per-stage photo counts, remaining, estimate
- **⚠️ Design names a technician** ("11:20 AM · Rahul K.") - **decided: unsigned**
- **States** each act; overrun; no photos
- **Backend** stages w/ timestamps + photo attribution, bay, visit number

### 12 · Mid-visit approval 🔴
- **Route** none · **Exit** → 11
- **Primary** Approve · +₹6,000 · **Secondary** Skip it · film as planned
- **Fields** "We found something under the film", two evidence photos ("Rear quarter", "Under light"), explanation, "Extra stage +₹6,000", "Extra time +2 hours · same day", requester identity
- **Customer decision** approve / decline - **binding, priced, time-changing**
- **States** requested · approved · declined · expired · superseded
- **Backend** **approvals object; propagation to job → visit → invoice**

### 13 · Ready · pay · rate 🔴
- **Route** none · **Exit** → 15, → 19
- **Primary** Pay ₹43,622 · **Secondary** Rate this visit · Before & after · 46 photos · Change (payment method)
- **Fields** "Visit 14 · closed", "Back with you by 7:30 pm", line items incl. **"Extra stage · approved ₹6,000"**, "Gold −12% −₹5,040", "Total incl. GST ₹43,622", "UPI · aarav@okhdfc"
- **Calculated** line items from sealed visit + approvals, discount, **GST**, total
- **States** unpaid · paying · paid · failed · no saved method
- **Backend** sealed visit, invoice, **payment**, rating

### 14 · Garage
- **Route** `/garage` · **Exit** → 15, → 02, → 16
- **Primary** open a car · **Secondary** Add a car · Cars for sale
- **Fields** per car: name, "{plate} · CERAMIC 82%", state chip ("In studio"/"Resting")
- **Calculated** headline protection %
- **States** empty · one car · many · live
- **Backend** vehicles + protections

### 15 · Car record
- **Route** `/vehicle` (dock slot removed in new design) · **Exit** → 07, → album, → service record
- **Primary** Renew the front PPF · **Secondary** Album, Service record
- **Fields** plate, model, "Phantom Black · matte wrap · **41,208 km**", "Warranty to Mar 2028", three protections with **% and months**, "Album · 214 photos, 14 visits", "Last · ceramic, 12 Feb 2026"
- **Calculated** every %, months remaining, warranty date, album counts, last service
- **States** no protection · healthy · attention · lapsed · no photos
- **Backend** protections w/ `since`, odometer, sealed visits

### 16 · Cars for sale
- **Route** `/cars` · **Exit** → 17
- **Primary** open a listing · **Secondary** segmented Studio certified / Owner listings · List a car from your garage
- **Fields** per listing: badge "Certified · 142-pt", title, price, spec line incl. "ceramic 82%"
- **Backend** `carListings`; **certified flag; protection on a listing**

### 17 · Certified car detail 🟡
- **Route** `/cars/[id]` · **Exit** → enquiry
- **Primary** Ask about this car
- **Fields** badge, title, spec, price, **"Its record with us"**: detailed since, PPF life, "Visits on record 11 · 340 photos", "Paint · Original, no respray", "Full inspection report", photo count "+38"
- **⚠️ Publishes a customer's service history publicly** - consent required
- **Backend** **listing ↔ vehicle service-record join; inspection report**

### 18 · Club
- **Route** `/membership` · **Exit** → tier change
- **Fields** "Member since 2023", card (GOLD, holder, "AM · 0142", "RENEWS FEB 2027"), four benefit rows with values, SILVER "Tier below" / BLACK "By invitation"
- **Calculated** washes left, renewal date, discount %
- **States** none · pending · active · grace · lapsed
- **Backend** `subscriptions` + plan catalogue

### 19 · You
- **Route** `/you` · **Exit** → invoices, warranty papers, addresses, payment methods
- **Fields** monogram, name, email, rows: Invoices, Warranty papers, **Payment methods "UPI · HDFC"**, **Pickup addresses "2 saved"**, **Quiet mode** + "Only approvals and handover reach you", "Talk to the studio +91 …"
- **Backend** **payment methods, addresses, quiet-mode preference**

---

# PHASE 2 · DESIGN → DATA → LOGIC → UI TRACE

| # | Element | Component | Projection/Engine | Collection · fields | Writer | Owner | Status |
|---|---|---|---|---|---|---|---|
| 06 | catalogue, price, duration, brand | StudioScreen | `toStudio` | `services.price/duration/brand/description` | admin services page | admin | 🟢 **[P]** 7 active |
| 04/11 | stages, acts, timing | LiveVisitScreen | `os/stay` ← `jobs.statusHistory` | `jobs.status/statusHistory` | kiosk | staff | 🟢 **[C][R]** |
| 04/11 | **bay number** | - | - | `jobs.bay` (33% set) | kiosk | staff | 🟡 **[P]** not projected |
| 11 | **per-stage photo counts** | - | - | `jobs.photos` (11% set) | kiosk | staff | 🔴 **[P]** counts not derived |
| 11 | **visit ordinal ("Visit 14")** | - | - | - | - | - | 🔴 **[C]** |
| 05/14/15 | protection % | Dial/Meter | `remainingOf` | `protections.since`+`term` | `sealVisitForJob` | staff | 🟡 **[P]** `since` 43%; else a bucket |
| 15 | warranty date | VehicleScreen | `toVehicle` | derived from protections | - | - | 🟢 **[C]** |
| 15 | **odometer** | VehicleScreen | `toVehicle` | `vehicles.odometer` | CarForm | customer | 🟡 **[P]** 0% populated |
| 15/13 | album counts, service record | - | `toHistory` | `visits` | `sealVisitForJob` | staff | 🔴 **[P]** never sealed |
| 13 | line items, GST, total | VisitScreen | `toVisit` | `invoices.lineItems/gst/total` | admin invoice | admin | 🟡 **[P]** 1 invoice, no `visitId` |
| 13 | **payment** | - | - | `invoices.paymentStatus` | admin | admin | 🟡 no customer path |
| 13 | **rating** | RatingCard | - | `feedback` | customer | customer | 🟡 **[C]** on public invoice, not the visit |
| 08/19 | **pickup address** | - | - | `bookings.pickupAddress` | - | - | ⚫ **[P]** 0% - declared, never written |
| 08 | pickup/drop flags | - | - | `bookings.pickupRequired/dropRequired` | `bookingService` | server | 🟡 **[P]** written; read only by a WhatsApp template |
| 07 | scopes, add-ons, estimate | - | - | - | - | - | 🔴 **[C]** |
| 08 | multi-day | - | `availability` (day-level) | `bookings.scheduledDate` singular | `bookingService` | server | 🔴 **[C]** |
| 10 | 24-hour rule | ManageVisit | - | - | - | - | 🔴 **[C]** |
| 12 | approval | - | - | - | - | - | 🔴 **[C]** |
| 17 | service record on listing | ListingScreen | `os/market` | `carListings` (no vehicle ref) | admin | admin | 🔴 **[C]** |
| 18 | washes, renewal, benefits | MembershipScreen | `os/club` | `subscriptions` + `MEMBERSHIP_PLANS` | admin | admin | 🟢 **[P]** since `9e8e55c` |
| 19 | quiet mode / methods / addresses | - | - | - | - | - | 🔴 **[C]** |
| - | notification → surface | - | `noticeOf`→`surfaceOf` | `notifications` | server | server | ⚠️ **[P]** null for completed-without-visit; 5 unread invisible |
| - | next visit | - | `nextVisitOf` | `bookings` | - | - | 🟢 **[P]** one answer |
| - | money reconciliation | - | `moneyOfVisits` | `visits`+`invoices` | - | - | ⚠️ **[P]** unreconcilable - invoice has no `visitId` |
| - | `serviceHistory` | - | - | `users/{}/vehicles/{}/serviceHistory` | `services/bookings.ts:213` | client | ⚫ **[C]** written, no reader |
| - | `bookingIntents` | - | - | `bookingIntents` (1 doc) | ? | ? | ⚫ **[P]** no reader |
| - | `quotes` | - | - | `quotes` (1 doc) | admin | admin | ⚫ **[P]** no customer path |

---

# PHASE 3 · DATA MODEL AUDIT

Existing objects are **extended**, never duplicated.

### `users/{uid}` - EXTEND
Add `quietMode?: boolean`, `upiVpa?: string`.
Owner: customer. Create: auth trigger. Modify: owner (prefs), admin (role).
Read: owner + staff. Immutable: none. **[C]** rules already scope this correctly.

### `users/{uid}/vehicles/{id}` - EXTEND (done, unpopulated)
`odometer?`, `year?` added at `b372119`; **0% populated [P]**.
Immutable: `registrationNumber` once visits exist (it is the join key).
⚠️ **Integrity:** jobs attach by plate, so changing a plate silently re-parents
history. Must be locked or migrated deliberately.

### `services/{id}` - EXTEND for screen 07
```
scopes?:  [{ id, label, detail, price, durationMinutes }]
addOns?:  [{ id, label, detail, price, durationMinutes, recommendedWith? }]
```
Scope is a **priced variant**, not a new service. "Custom panels · On quote"
routes to the existing `quotes` object. Snapshot: scope label + price into the
booking and the sealed visit. Create/modify: admin. Read: public.

### `bookings/{id}` - EXTEND
Add `endDate?` (multi-day), `scopeId?`, `addOnIds?[]`, populate `pickupAddress`.
Add terminal status **`expired`** - 3 bookings sit `pending` 13–17 days past **[P]**.
Immutable after completion: pricing snapshot. Create: customer via
`bookingService`. Modify: owner (limited) + staff. Read: owner + staff.

### `users/{uid}/addresses/{id}` - NEW
`{ label, line, lat?, lng?, isDefault }`. Owner-only. Screen 19 "2 saved",
screen 08 selects one. **No address concept exists anywhere [C]**.

### `jobs/{id}` - EXTEND
`customerId` must be **required when the booking has one** - 15/18 lack it **[P]**,
which is why the customer app sees almost nothing. Add `approvalIds?[]`.
Stages already carry history. Create/modify: staff. Read: staff + owner.

### `approvals/{id}` - NEW
```
jobId, visitId?, customerId, vehicleId, reason, photos[],
priceDelta, timeDeltaMinutes,
status: 'requested'|'approved'|'declined'|'expired',
requestedBy, requestedAt, respondedAt?
```
**Immutable once responded.** Customer may write **only** `status`, only from
`requested`, only on their own document. `priceDelta` is staff-set and
customer-read. Must propagate: job total → sealed visit `amounts` → invoice line.

### `visits/{id}` - AUTHORITATIVE, currently fixtures only
Snapshot at seal: services, prices, `termsCaptured`, stages, amounts.
**Immutable once `sealedAt` is set (§16.2).** Create: `sealVisitForJob` only.
Required: `jobId` - the four production documents lack it **[P]**.

### `protections/{id}` - TIGHTEN
`since` must become **required** - 43% populated **[P]** - because it is the
denominator of every percentage in the design. `termsSource` is
`captured` (6) / `declared` (8) **[P]**; declared protections have no honest %.
Immutable: `term`, `since`. Create: seal, or admin declaration.

### `invoices/{id}` - TIGHTEN
`visitId` must be set; currently unset on the only invoice **[P]**.
Immutable once paid. Add `payment: { method, vpa?, markedBy, markedAt }`.

### `subscriptions/{id}` - 🟢 resolved
`washesTotal` vs `washesIncluded` drift fixed at `9e8e55c`; catalogue authoritative.

### `carListings/{id}` - EXTEND for screen 17
Add `vehicleId?`, `ownerConsent: boolean`, `inspection?: { points, reportUrl }`.
⚠️ Without `ownerConsent` this publishes a customer's history.

### `notifications/{id}` - 🟢 shape fine, routing broken (Phase 4)

---

# PHASE 4 · BUSINESS LOGIC AUDIT

### Booking
- Availability: day-level, `washCapacity: 1`, 15-min buffer **[C]**
- **Multi-day: absent.** Screen 08 needs a bay held across consecutive days 🔴
- Conflicts: server-side in `bookingService` 🟢
- Stale: correctly excluded from "upcoming" 🟢 **[P]** - but then shown nowhere,
  so a customer cannot cancel their own booking 🟡
- Cancellation: exists 🟢 · **Reschedule + 24-hour rule: absent** 🔴
- Lifecycle: no `expired` terminal state 🔴

### Pricing - ONE AUTHORITY REQUIRED
`decidePrice` is the single authority **[C]** and takes base, category,
membership, promos. The design adds three inputs it does not accept:
**scope price, add-on prices, approved mid-visit deltas.**
⚠️ **GST appears on screen 13 and on invoices but is not in `decidePrice`** -
so the estimate (07/08/09) and the invoice (13) are computed by different code
and will drift. Must be unified or they contradict.

### Protection
Start = `since` (43% **[P]**), expiry = `term.expiresOn`, life = fraction between.
Without `since`, `remainingOf` returns health buckets 0.8/0.2/0.05/0 **[C]** -
so "82%" would be a category wearing a number. Membership-as-protection: 🟢 on
Home, 🔴 in Garage ("Nothing declared yet" ×4 **[P]**) - ⚠️ contradiction.

### Visit
`booking → job → visit` is built end-to-end and transactional **[C]**; it has
never executed **[P]**. Photographs exist on 11% of jobs **[P]**. Before/during/
after kinds exist **[C]**. Rating exists but is attached to the public invoice,
not the visit **[C]**.

### Mid-visit approval - entire lifecycle 🔴
No object, no route, no admin action, no propagation. Screen 13's
"Extra stage · approved ₹6,000" line has no source.

### Membership 🟢
Plan, benefits, usage, renewal, grace, lapse, history all resolved by `os/club`.

---

# PHASE 5 · GAP MAP (all 19 screens, data-bearing elements)

| Screen | Element | Required | Existing | Engine | Writer | Status | Fix |
|---|---|---|---|---|---|---|---|
| 01 | Google sign-in | provider | ✅ | - | `/api/session` | 🟢 | - |
| 01 | Look around first | public route | ✅ `/cars` | - | - | 🟢 | - |
| 02 | registration → model | lookup | ❌ | - | - | 🔴 | manual entry (decided) |
| 02 | year / colour | `vehicles.year/color` | field ✅ data 0% | - | CarForm | 🟡 | capture in form |
| 02 | duplicate plate guard | check | ✅ | - | CarForm | 🟢 | - |
| 03 | next opening | availability | ✅ | `availability` | - | 🟡 | not projected to Home |
| 03 | empty-state copy | - | ❌ | - | - | 🔴 | build screen |
| 04 | remaining time | stage + duration | ✅ | `os/stay` | kiosk | 🟢 | - |
| 04 | ready-at time | derived | ✅ | `os/stay` | - | 🟢 | - |
| 04 | bay number | `jobs.bay` | 33% | - | kiosk | 🟡 | project it |
| 04 | phase strip | acts | ✅ | `os/stay` | - | 🟢 | - |
| 04 | advisory | protection % + catalogue | ⚠️ % unreal | `os/proposal` | - | 🟡 | needs `since` |
| 05 | protection dial | `since`+`term` | 43% | `remainingOf` | seal | 🟡 | make `since` required |
| 05 | "ceramic life" label | protection kind | ✅ | - | - | 🟢 | - |
| 06 | 8 services | catalogue | 7 **[P]** | `toStudio` | admin | 🟢 | - |
| 06 | "For the {car}" | selected car | ✅ | - | - | 🟡 | not shown today |
| 07 | 3 coverages + prices | `services.scopes` | ❌ | - | admin | 🔴 | extend `services` |
| 07 | add-ons | `services.addOns` | ❌ | - | admin | 🔴 | extend `services` |
| 07 | estimate w/ discount | pricing | partial | `decidePrice` | - | 🟡 | add scope/add-on inputs |
| 07 | "2 days in the bay" | duration→days | ❌ | - | - | 🔴 | derive |
| 08 | consecutive days | multi-day capacity | ❌ | `availability` | - | 🔴 | extend |
| 08 | time chips | slots | ✅ | `generateTimeSlots` | - | 🟢 | - |
| 08 | concierge toggle | `pickupRequired` | ✅ written | - | `bookingService` | 🟡 | no UI |
| 08 | saved address | `addresses` | ❌ | - | - | 🔴 | new collection |
| 08 | pickup time | derived | ❌ | - | - | 🔴 | derive from slot |
| 09 | confirmation facts | booking | ✅ | - | - | 🔴 | no route |
| 09 | add to calendar | ICS | ❌ | - | - | 🔴 | build |
| 10 | move date | reschedule | ❌ | - | - | 🔴 | build |
| 10 | 24-hour rule | rule | ❌ | - | - | 🔴 | build |
| 10 | next openings | availability | ✅ | `availability` | - | 🟡 | not surfaced |
| 10 | cancel | cancel | ✅ | `bookingService` | - | 🟢 | - |
| 11 | visit ordinal | count | ❌ | - | - | 🔴 | derive from sealed visits |
| 11 | stage times | `statusHistory` | ✅ | `os/stay` | kiosk | 🟢 | - |
| 11 | photo counts per stage | `jobs.photos` | 11% | - | kiosk | 🔴 | derive + require |
| 11 | technician name | - | - | - | ⚠️ | §2.2 | **unsigned (decided)** |
| 12 | entire screen | `approvals` | ❌ | - | - | 🔴 | new object + both UIs |
| 13 | line items | sealed visit | fixtures | `toVisit` | seal | 🔴 | run seal |
| 13 | approved extra line | approval | ❌ | - | - | 🔴 | depends on 12 |
| 13 | GST | invoice | ✅ on invoice | ❌ in `decidePrice` | admin | ⚠️ | unify |
| 13 | Pay | UPI intent | ❌ | - | - | 🔴 | build (deep link) |
| 13 | rate | `feedback` | ✅ | - | customer | 🟡 | move to visit |
| 14 | protection headline | protections | 43% | `toGarage` | seal | 🟡 | needs `since` |
| 14 | state chip | ownership | ✅ | `stateWordFor` | - | 🟢 | - |
| 15 | odometer | `vehicles.odometer` | 0% | - | CarForm | 🟡 | capture |
| 15 | warranty date | derived | ✅ | `toVehicle` | - | 🟢 | - |
| 15 | 3 protections %+months | protections | 43% | `remainingOf` | seal | 🟡 | needs `since` |
| 15 | album counts | visits | fixtures | `toHistory` | seal | 🔴 | run seal |
| 15 | last service | visits | fixtures | - | seal | 🔴 | run seal |
| 15 | Renew the front PPF | proposal | ✅ | `os/proposal` | - | 🟡 | needs real % |
| 16 | listings + price | `carListings` | 3 **[P]** | `os/market` | admin | 🟢 | - |
| 16 | certified segment | flag | ❌ | - | admin | 🔴 | add flag |
| 16 | "ceramic 82%" on card | protection join | ❌ | - | - | 🔴 | join |
| 17 | record with us | vehicle join | ❌ | - | - | 🔴 | join + **consent** |
| 17 | inspection report | doc | ❌ | - | admin | 🔴 | build |
| 18 | washes / renewal | subscription | ✅ | `os/club` | admin | 🟢 | - |
| 18 | tiers | catalogue | ✅ | - | - | 🟢 | - |
| 19 | payment methods | `users.upiVpa` | ❌ | - | - | 🔴 | add |
| 19 | addresses "2 saved" | `addresses` | ❌ | - | - | 🔴 | new |
| 19 | quiet mode | `users.quietMode` | ❌ | - | - | 🔴 | add |

---

# PHASE 6 · FLOW AUDIT

| # | Flow | Entry | Writes | Failure point | Recovery | Status |
|---|---|---|---|---|---|---|
| 1 | Anonymous → sign in | 01 | session cookie | popup blocked | retry / look around | 🟢 |
| 2 | New customer → add car | 02 | `vehicles` | duplicate plate | inline error | 🟡 no year/colour capture |
| 3 | Select car | 14 | `?car=` | - | address restores | 🟢 |
| 4 | Select service | 06 | - | empty catalogue | - | 🟢 |
| 5 | Select scope | 07 | - | - | - | 🔴 |
| 6 | Add-ons | 07 | - | - | - | 🔴 |
| 7 | Estimate | 07 | - | drift vs invoice | - | 🟡 ⚠️ GST |
| 8 | Select date | 08 | - | no slots | other day | 🟢 |
| 9 | Multi-day | 08 | - | - | - | 🔴 |
| 10 | Pickup/drop | 08 | `pickupRequired` | no address | - | 🟡 |
| 11 | Confirm booking | 08 | `bookings` | capacity race | server rejects | 🟢 |
| 12 | Confirmation | 09 | - | - | - | 🔴 |
| 13 | Manage | 10 | - | - | - | 🟡 |
| 14 | Reschedule | 10 | - | - | - | 🔴 |
| 15–18 | Arrive → received → looked over → in care | kiosk | `jobs.statusHistory` | staff forgets | none | 🟢 write / 🟡 no ageing |
| 19 | Mid-visit approval | 12 | - | - | - | 🔴 |
| 20 | Final checks | kiosk | job | - | - | 🟢 |
| 21 | Ready | kiosk | job | - | - | 🟢 |
| 22 | Payment | 13 | - | - | - | 🔴 |
| 23 | Rating | 13 | `feedback` | - | - | 🟡 wrong surface |
| 24 | Sealed visit | completion | `visits`+`protections` | **never fires** | backfill (never run) | 🔴 **[P]** |
| 25 | Protection created | seal | `protections` | `since` optional | - | 🟡 |
| 26 | History | 15 | - | no visits | - | 🔴 |
| 27 | Membership | 18 | `subscriptions` | - | - | 🟢 |
| 28 | Notification routing | any | `read` | no owning surface | **none - silently dropped** | ⚠️ **[P]** |
| 29 | Marketplace/service record | 17 | - | - | - | 🔴 |
| 30 | Returning customer | 01→04/05 | session | cookie lapse | `SessionKeeper` | 🟢 |

---

# PHASE 7 · ADMIN DEPENDENCIES

| Customer capability | Required admin operation | Status |
|---|---|---|
| Browse catalogue | create/update services, prices | 🟢 |
| Pick a scope (07) | **define scopes + prices** | 🔴 |
| Add-ons (07) | **define add-ons** | 🔴 |
| Book a date (08) | manage availability | 🟢 |
| Multi-day (08) | **hold a bay across days** | 🔴 |
| Concierge (08) | **see/assign pickup + address** | 🔴 |
| Booking accepted (09) | accept/reject | 🟢 |
| Reschedule (10) | **move a booking** | 🔴 |
| Watch the visit (11) | update stages, upload photos | 🟢 (photos used on 11% **[P]**) |
| Approve extra work (12) | **request approval from the bay** | 🔴 |
| Pay (13) | **mark settled against a visit** | 🟡 per-invoice only |
| See the record (15) | seal visits | 🟡 built, never runs **[P]** |
| Protection % (15) | set `since` when applying | 🟡 |
| Certified listing (17) | **attach vehicle history + consent** | 🔴 |
| Notifications | send | 🟢 |

---

# PHASE 8 · SECURITY / INTEGRITY

Verified by reading `firestore.rules` **[C]**:

| Control | Status |
|---|---|
| Customer sees only own vehicles (`users/{uid}` subtree) | 🟢 |
| Customer cannot alter prices (`services` staff-write) | 🟢 |
| Customer cannot alter protection expiry (`protections` staff-write) | 🟢 |
| Customer cannot mark invoices paid (`invoices` staff-write) | 🟢 |
| Membership cannot be forged (`subscriptions` staff-write) | 🟢 |
| Invoice cannot belong to another customer (`customerId ==` rule) | 🟢 |
| Notification ownership (`userId ==`) | 🟢 |
| Booking cannot exceed capacity | 🟢 server-side `bookingService` |
| Immutable historical records | 🟡 rules allow staff rewrite of sealed visits |
| **Customer cannot approve for another customer** | 🔴 no object yet - rule must be written with it |
| **Marketplace public/private boundary** | 🔴 screen 17 publishes a customer's history with no consent field |
| Admin/location boundaries | **[?]** single location today |

---

# PHASE 9 · STATE MATRIX

🟢 implemented · 🟡 partial · 🔴 missing · 🧪 test-fixture only

| Screen | new | empty | loading | healthy | attention | expired | upcoming | live | completed | cancelled | failed | no-data |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 🟢 | - | 🟡 | - | - | - | - | - | - | - | 🟡 | - |
| 02 | 🟢 | 🟢 | 🟡 | - | - | - | - | - | 🟢 | - | 🟢 | - |
| 03 | 🔴 | 🔴 | 🟡 | - | - | - | - | - | - | - | 🟡 | 🔴 |
| 04 | - | - | 🟡 | 🟢 | 🟡 | - | - | 🟢 | 🟢 | - | 🟡 | - |
| 05 | 🟢 | 🟢 | 🟡 | 🧪 | 🧪 | 🧪 | - | - | - | - | 🟡 | 🟢 |
| 06 | - | 🟢 | 🟡 | 🟢 | - | - | - | - | - | - | 🟡 | 🟢 |
| 07 | 🔴 | 🔴 | 🔴 | 🔴 | - | - | - | - | - | - | 🔴 | 🔴 |
| 08 | 🟢 | 🟢 | 🟢 | 🟢 | - | - | 🟢 | - | 🟢 | - | 🟢 | 🟢 |
| 09 | 🔴 | - | 🔴 | 🔴 | - | - | 🔴 | - | - | - | 🔴 | - |
| 10 | - | 🟡 | 🟡 | 🟡 | - | 🔴 | 🟡 | - | - | 🟢 | 🟡 | 🟡 |
| 11 | - | - | 🟢 | - | - | - | - | 🟢 | 🔴 | - | 🟡 | 🟡 |
| 12 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | - | - | 🔴 | - | 🔴 | 🔴 |
| 13 | 🔴 | - | 🔴 | - | - | - | - | - | 🧪 | - | 🔴 | 🔴 |
| 14 | 🟢 | 🟢 | 🟡 | 🟡 | 🟡 | 🧪 | - | 🟢 | - | - | 🟡 | 🟢 |
| 15 | 🟢 | 🟢 | 🟡 | 🧪 | 🧪 | 🧪 | 🟢 | 🟢 | 🧪 | - | 🟡 | 🟢 |
| 16 | - | 🟢 | 🟡 | 🟢 | - | - | - | - | - | - | 🟡 | 🟢 |
| 17 | - | - | 🟡 | 🟡 | - | - | - | - | - | - | 🟡 | 🔴 |
| 18 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 | - | - | - | 🟢 | 🟡 | 🟢 |
| 19 | 🟢 | - | 🟡 | 🟢 | - | - | - | 🟢 | - | - | 🟡 | - |

**Loading** is 🟡 throughout by design - rooms are server-rendered, so there is
no customer-visible loading state. **Error is 🟡 throughout**: `app/error.tsx`
and `app/not-found.tsx` exist at the root only **[C]** - no per-room boundary, so
a projection throw in any room yields one generic page.

---

# PHASE 10 · PRODUCTION DATA FINDINGS (read-only; nothing modified)

```
activity 42  attendance 12  bookingIntents 1  bookings 11  carListings 3
counters 1   dailyStats 28  employees 3  invoices 1  jobs 18
notificationLog 29  notifications 46  promos 1  protections 14  quotes 1
services 7   subscriptions 2  tasks 2  users 9  visits 4  walkinCustomers 14
```

**Missing required objects**
- 8 completed jobs → 0 sealed visits **[P]**
- all 4 `visits` are `vis-demo-*` seed fixtures, no `jobId` **[P]**

**Orphaned / contradictory**
- 1 invoice, `visitId` unset, `customerPhone` 0% **[P]**
- bookings labelled "Kia Seltos" and "Honda City" carry the BMW's plate
  `GJ01AB1234`; jobs attach by plate, so the BMW's room inherits them ⚠️ **[P]**
- 15/18 jobs have no `customerId` **[P]**

**Stale**
- 3 open bookings 13–17 days past **[P]**
- 10 jobs in flight aged 14–29 days (`checked_in`, `in_progress`,
  `quality_check`, `ready_for_delivery`) **[P]**

**Never populated**
- `bookings.pickupAddress` 0% · `vehicles.odometer` 0% · `vehicles.year` 0%
- `invoices.customerPhone` 0% · `protections.since` 43% · `jobs.photos` 11%

**Demo vs real**
- Vehicle photos: Cloudinary, real. Job photos: Unsplash, seeded.
- `protections.termsSource` = captured 6 / declared 8 **[P]**

**Writers never called**
- `backfillSealedVisits` **[C]** · `sealVisitForJob` in practice **[P]**

---

# PHASE 11 · ARCHITECTURAL GAPS

- **Duplicate source of truth:** estimate (`decidePrice`) vs invoice (admin GST
  path). One fact, two calculations. ⚠️
- **Join key is a string:** jobs↔cars by normalised plate. A typo re-parents a
  car's history; a plate change orphans it. ⚠️
- **Dead collections:** `bookingIntents` (no reader **[P]**)
- **Dead writers:** `serviceHistory` written at `bookings.ts:213`, no reader **[C]**
- **Dead fields:** `bookings.pickupAddress`
- **Barely-read fields:** `pickupRequired`/`dropRequired` → WhatsApp template only
- **Dead compute:** `backfillSealedVisits`
- **UI without data:** screens 07, 09, 12, 13, 17
- **Data without UI:** `quotes`, `bay`, `jobs.photos` counts
- **Not snapshotted:** approval deltas (no object), scope choice (no field)
- **No audit trail:** approvals, payment marking, plate changes
- **Projections that disagree:** membership-as-protection (Home yes, Garage no) ⚠️

---

# PHASE 12 · IMPLEMENTATION PLAN

### P0 - integrity, security, contradiction

**P0.1 · Make the seal run**
Problem: 8 completed jobs, 0 sealed visits; all visits are fixtures.

Root cause - **CORRECTED 2026-08-10 after diagnosis.** The seal does not "fail
silently". It shipped on **2026-07-30** (`c50fc93`), and the most recent job
completion in production is **2026-07-22** **[P]**. No job has been completed
since the code existed, so the trigger has never had the opportunity to fire.
It is unproven, not broken. The admin role check would pass -
`hello.automodz@gmail.com` carries `role: admin` **[P]**.

Consequence: the 8 unsealed jobs are all historical, and the **backfill** is the
correct remedy for them; the trigger needs a live completion to prove itself.

Safety confirmed **[C]**: `sealVisitForJob` takes `vehicleId` from the booking
and returns `no-vehicle` when there is none, so the 6 walk-in jobs without a
booking write nothing. Running the backfill seals exactly the 2 jobs that carry
a `customerId` and a booking, plus their protections.

Screens 11,13,15,album,record,money,notifications.
Collections `jobs`→`visits`,`protections`. Files `lib/services/jobs.ts`,
`lib/server/sealVisit.ts`, `app/api/visit/backfill`.
Depends on: nothing. **Verify:** completed-job count == sealed-visit count.

**P0.2 · `protections.since` required at seal**
Problem: 57% lack `since`; every design % becomes a bucket.
Screens 04,05,14,15. Depends on P0.1. **Verify:** no protection without `since`;
a rendered % traceable to two dates.

**P0.3 · One pricing authority incl. GST**
Problem: estimate and invoice computed by different code.
Screens 07,08,09,13. Files `lib/services/pricing.ts`, invoice path.
**Verify:** one fixture → estimate == invoice total.

**P0.4 · Marketplace consent**
Problem: screen 17 publishes a customer's service history.
Needs `ownerConsent` + a rule. **Verify:** listing without consent renders no
record section.

**P0.5 · Plate integrity**
Problem: bookings carry another car's plate. **Verify:** every booking's
`vehicleRegNo` matches a vehicle owned by `userId`.

### P1 - the designed journey
P1.1 scopes + add-ons (07) → P1.2 estimate → P1.3 multi-day + addresses (08)
→ P1.4 Booked (09) → P1.5 Manage + 24h (10) → P1.6 approvals (12)
→ P1.7 Ready·pay·rate (13) → P1.8 dock Car→Club + screen 03

### P2 - supporting
Stale booking/job expiry · surface cancellable bookings · quiet mode, methods,
addresses (19) · certified detail (17) · `customerId` on every job

### P3 - polish
Album counts · ICS export · bay number on 04/11 · remove or read `serviceHistory`
and `bookingIntents`

---

# 13 · DEPENDENCY GRAPH

```
P0.1 seal ─┬─► visits ──┬─► 11 · 13 · 15 · album · service record
           │            ├─► money reconciliation
           │            └─► notification routing (owning surface exists)
           └─► P0.2 since ──► % on 04 · 05 · 14 · 15 ──► advisory engine

P0.3 pricing ──► P1.1 scopes ──► P1.2 estimate ──► P1.3 date ──► P1.4 booked ──► P1.5 manage

P1.6 approvals ──► job total ──► sealed visit ──► P1.7 invoice + payment

P0.4 consent ──► 17     P0.5 plate ──► all car-scoped screens
```

**Nothing in P1 is safe before P0.1 and P0.2** - 13 and 15 render sealed-visit
data, so building them first means building against fixtures, which is precisely
how the present state arose.

---

# 14 · EXACT IMPLEMENTATION ORDER

1. P0.5 plate integrity (read-only report first)
2. P0.1 seal - fix the trigger, then run the backfill, verified
3. P0.2 `since` required
4. P0.3 unify pricing incl. GST
5. P0.4 consent field + rule
6. P1.1→P1.5 booking chain
7. P1.6 approvals (both UIs + rule)
8. P1.7 payment + rating on the visit
9. P1.8 dock + screen 03
10. P2, then P3

---

# 15 · REUSE AS-IS

`sealVisitForJob` · `decidePrice` · `os/club` · `os/stay` · `os/term` ·
`os/proposal` · `availability` (day level) · `bookingService` · the whole
projection layer · `components/os` · rules' `isStaff()`/`isAdmin()` helpers ·
`ServerRoom`/`CustomerChrome` · `RatingCard`

# 16 · MUST BE REBUILT / BUILT

`approvals` (new) · `users/{}/addresses` (new) · scope & add-on model on
`services` · multi-day availability · reschedule + 24h rule · screens 03, 07,
09, 12, 13 · listing↔record join · payment (UPI intent) · booking `expired` state

# 17 · MUST NOT BE TOUCHED

Sealed `visits` and `protections` once written (§16.2) · payroll, inventory,
attendance, expenses subsystems (in daily use, out of scope) · rules'
staff/admin helpers · `decidePrice`'s existing membership/promo semantics ·
the design itself

---

# 18 · DEPLOYMENT READY - DEFINITION

1. Every completed job seals a visit automatically, with `since` recorded.
2. One calculation produces estimate, invoice and payment - GST included.
3. Every percentage is a measurement between two dates, not a bucket.
4. No screen states a fact another screen contradicts.
5. Every customer action has an admin counterpart that exists.
6. A customer cannot forge an approval, a price, or a payment.
7. No public surface exposes a customer's record without explicit consent.
8. Stale bookings and stale jobs age out on their own.
9. All 19 screens render against real production data, in a browser.
10. Sealed records are immutable, and every money-affecting operation is audited.

---

# 19 · STILL NOT ESTABLISHED **[?]**

- Hydration, layout shift and mobile overflow on authenticated screens - the
  browser pass remains blocked by the session-permission denial.
- Whether any admin surface can currently set `protections.since`.
- Multi-location boundaries (single location today).
- Provenance of `bookingIntents`.
