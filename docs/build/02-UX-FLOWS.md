# 02 · UX FLOWS
### Phase 2 of the build - every customer journey, complete

**Authority:** the Constitution + Experience Principles + `01-INFORMATION-ARCHITECTURE.md`. Flows use only the routes, sheets, states, and deep links defined in the IA - none are added here.

**Schema used for every journey:** Intent · States · Transitions · Errors & Recovery · Notifications · Success state · Edge cases · Offline. Shared machinery is defined once (§0) and referenced, never duplicated.

---

## 0 · Shared machinery (referenced by every flow)

- **M1 - Sheet contract.** Open via `?sheet=` param (back-button closes). Submit → optimistic local write → server confirm; on failure the sheet reopens with values intact and one concierge line ("That didn't reach us - try again"). Dismiss = no-op, never a warning.
- **M2 - Offline truth.** Every surface renders last-cached objects instantly + whisper line ("Offline - last updated 7:40 pm"). Reads never block; writes queue if queueable (moments, preferences) or disable the single submit action with the whisper if not (agreeing a visit needs the server). No error cards, ever.
- **M3 - Visit agreement.** Any path that creates care converges here: a Visit exists in `proposed(author)` → `visit-agree` sheet (slot/scope adjustable inline) → `agreed`. Failure modes: slot taken → sheet re-presents next 3 slots ("10:00 has just gone - 11:30 or tomorrow 10:00?"); price changed server-side → sheet re-presents with new amount and requires a fresh yes (never silent).
- **M4 - Term edge behaviour.** `waning`/`expiring` each: one push (IA §7), one system-authored proposed visit (reason attached), truth-line priority bump. Never more.
- **M5 - Thread cards.** Visits, memberships, and protections appear in the thread as reference cards with one primary action; acting on a card anywhere updates it everywhere (it's a reference).
- **M6 - Destructive confirm.** A second state inside the same sheet: plain restatement + two text actions ("Cancel Thursday's visit" / "Keep it"). Never a modal, never red panic.
- **M7 - The minimum yield check (Amendment II).** `archived` requires ≥1 moment, the chapter record, and one forward element; shortfall flags ops, customer sees nothing.

---

## PART A - ARRIVAL & THE GARAGE

### A1 · First install & first vehicle (onboarding)
- **Intent:** "I was told there's an app" → owning a photographed car in <2 min.
- **States:** login → welcome → identity confirm → car form → portrait capture → Glance.
- **Transitions:** Google auth → `/app/welcome` (no vehicle exists). One welcome screen (the house's voice, one paragraph). Name/phone confirm (prefilled from Google). `car-form` inline (make/model/year/plate - 4 fields). Camera: "Take a photo of your car. It becomes your home screen." → lands on `/app`, their portrait full-bleed, truth line "Welcome to the studio."
- **Errors/Recovery:** auth fail → threshold retry line. Photo skip → typographic portrait + capsule offers "Add a photo" until done (Vehicle stays `added`, not `portrait_made`).
- **Notifications:** none. Permission is **not** requested at install - it is requested at first visit agreement, when it has a reason ("So we can tell you when the C 43 is safe with us").
- **Success:** Glance renders their car; Article 2's mental model formed in one session.
- **Edge:** existing V2 user's first V3 open → vehicles already exist → skip to Glance; if no portrait, the capture invitation runs. Multiple cars pre-existing → most recently serviced is front.
- **Offline:** onboarding requires connectivity; threshold explains it in one line.

### A2 · Second vehicle
- **Intent:** "I have another car."
- **Flow:** swipe past last car → add-a-car invitation page → `car-form` → portrait capture → new Glance page, fronted. Same machinery as A1 minus welcome. **Success:** two-page swipe; each car a full citizen. **Edge:** 5+ cars → swipe holds (page dots); fleet roll-up is future law, not built. **Offline:** M2 - form queues nothing; requires connection (creates an object others react to).

### A3 · Removing a vehicle (retire)
- **Intent:** "I no longer have this car."
- **Flow:** Identity layer → `car-form?car=X` → "I no longer have this car" → M6 confirm → Vehicle → `retired`. Story preserved (constitutional); car leaves the swipe; timeline accessible via desk search.
- **Edge:** retire the *only* car → Glance falls back to the add invitation as its main state; truth line "The garage is open." Active visit or live protection on the car → sheet explains and offers the thread instead (a human decision, not a toggle).

### A4 · Selling a vehicle (transfer / listing)
- **Intent:** "Help me sell it" or "the buyer should get its history."
- **States:** `in_care_cycle → listed → transferred`.
- **Flow:** Identity layer "value & sell" → thread card (studio-assisted valuation; listing is a human conversation, not a form) → studio lists → `/cars/[id]` generated from the twin. On sale: transfer = party-role handoff; buyer's account receives the vehicle with moments/records intact, amounts redacted; seller keeps a read-only memory copy of the timeline.
- **Notifications:** thread messages only. **Success:** the history travelled - the moat realised. **Edge:** buyer not on AutoModz → transfer pends against their phone number; claimed at their onboarding. **Offline:** M2.

### A5 · Buying another vehicle (from the marketplace)
- **Intent:** "I want that car on `/cars`."
- **Flow:** public listing → enquire → thread (the conversation handles negotiation, humanly) → on purchase, A4's transfer lands the car - with its full twin - in the buyer's garage. **Success:** the strongest onboarding in the product: a new car that arrives *already rich*.

### A6 · Adding a family member
- **Intent:** "My partner should see the car / collect it."
- **Flow:** Identity layer → "Who can see this car" → invite by phone → M6-style plain consent → invitee's party gains `viewer` role (sees glance/stay/timeline; cannot author visits or edit unless granted `owner`).
- **Edge:** invitee has no account → pending invite, claimed at onboarding. Removing access: same list, one action, no ceremony. **Notifications:** one thread line to each side.

---

## PART B - CARE (the visit in all its forms)

### B1 · First booking (customer-authored)
- **Intent:** "I want to book a service." (No proposal exists yet - new customer.)
- **States:** none → visit `proposed(customer)` → `agreed`.
- **Transitions:** capsule → desk → "Arrange a visit" → `visit-arrange`: car (pre-answered) → service (catalogue, honest from-prices) → slot (next open highlighted) → M3 agree (+ `pay` intent: at studio default). Now layer materialises with the countdown; notification permission asked *here* with its reason.
- **Errors:** M3 slot/price machinery. **Notifications:** #1 prep note. **Success:** agreed in ≤4 taps; the customer never saw the word "booking." **Edge:** asks for something we don't offer → thread, human answer. **Offline:** compose offline, submit disabled with whisper (M2).

### B2 · Express wash today ("I just want a wash, now")
- **Intent:** urgency, zero ceremony.
- **Flow:** `visit-arrange` with `service=wash` prefill → today's remaining slots lead the slot list; if none, "Walk in before 6 - we'll take the C 43 between jobs" (studio-confirmed via thread within minutes). Visit `proposed(customer, today)` → `agreed` on studio confirm.
- **Success:** one exchange, care today. **Edge:** mid-day full capacity → honest no + tomorrow's first slot held for them (a real hold, `expiring` in 4h). **This flow is why Proposal merged into Visit - urgency is just an author + a time.**

### B3 · Ceramic / B4 · PPF (multi-day, high-value)
- **Intent:** considered protection purchase.
- **Deltas from B1:** scope card carries package tiers + honest durations ("the C 43 will be with us two days"); amount is significant → `pay` sheet supports advance intent; `agreed` state's Now layer shows a *stay plan* (drop-off, days, collection). During the Stay, acts stretch over days - each day emits ≥1 craft moment (M7 raises the bar for multi-day: daily evidence is the standard). Completion auto-creates the Protection with its real term (B8's machinery) and the warranty Record.
- **Edge:** work uncovers extra need (e.g. paint correction before coat) → **never silently done, never silently billed**: studio authors a scope-addition card in the thread with photos and price; work on the addition waits for the customer's yes (M3 re-agreement). This is the trust ledger's "agreement" moment, mid-visit.

### B5 · Accepting a proposal (system- or studio-authored)
- **Intent:** "AutoModz suggested care; I agree."
- **Flow:** capsule/truth line/push #9–10 → `visit-agree` card: reason first ("The ceramic's first maintenance wash is due"), slot, amount, one yes → `agreed`.
- **Ignore:** proposal sits silently; expires at its natural horizon; no repeat push. **Dismiss:** never returns in the same form; cadence source learns. **Success:** care agreed in one tap from a true reason.

### B6 · Vehicle in studio (the Stay) - the five acts
- **Intent:** "Where is my car and is it okay?"
- **States:** `arrived → inspected → in_care → finished → revealed`.
- **Transitions & experience:** each act per the Constitution's trust ledger - custody photo (+push #2) → inspection findings with photos (+push #3 if findings; findings requiring decisions use B3's scope-addition machinery) → in-care craft moments (push #4 opt-in) with named staff parties → finished (internal; the reveal is prepared) → `revealed`: finished portrait first, then before/after, craftsman's line, amount (push #6). Collapse/expand per IA §4.3.
- **Errors:** delay → push #5, honest, once per threshold. Ops forgets to advance acts → the translation layer degrades gracefully (acts inferred from ops status; photos absent per photo-less degraded mode) - the customer never sees staleness contradiction, and ops gets flagged.
- **Success:** the customer checks in *voluntarily* and shows someone. **Edge:** customer arrives to collect before `revealed` → front desk flow unaffected; app catches up to `archived` regardless. **Offline (customer):** cached acts + whisper; **offline (studio):** capture tooling queues writes.

### B7 · Vehicle completed → delivery → chapter (handover)
- **Intent:** "Collect the car; keep the proof."
- **Flow:** `revealed` → collection in person → `pay` settles (at-studio default; UPI ref alternative) → `archived` → Stay dissolves into `/app/chapter/[id]` (signature animation) → push #7. Chapter = the invoice (IA §6). Rating: one tap + optional line, on the chapter, within 24h, once ever per visit.
- **M7 enforced:** chapter ships with its evidence, protection rows, and the seeded next-due. **Success:** the customer leaves with a richer twin and can *see* the deposit (Amendment II §3). **Edge:** payment dispute → thread, human; the chapter still files (facts are not hostage to billing).

### B8 · Warranty & protection creation (automatic)
- **Intent:** none - this is the product keeping a promise.
- **Flow:** qualifying visit `archived` → Protection auto-created (type, term from service definition, evidence = the visit's detail moments) + warranty Record filed → visible in Protection layer immediately; truth line may change ("Protected · ceramic, 364 days").
- **Errors:** service lacks a term definition → ops flag; nothing invented customer-side. **Success:** the customer never filed anything and owns a dated promise.

### B9 · Protection renewal
- **Intent:** continuity of protection.
- **Flow:** M4 edges (`waning` 30d, `expiring` 7d) → system proposal (B5) → renewal visit → new Protection chained to ancestor ("protected since 2026"). Lapse → `lapsed` rendered with dignity; a later revival is a fresh application, story continuous. **Edge:** customer renews early → proposal available from `waning`; before that, "Renew" via desk Protection focus authors a customer visit (B1 machinery).

---

## PART C - THE CLUB & THE RELATIONSHIP

### C1 · Membership purchase
- **Intent:** "I wash often; make this a relationship."
- **States:** party `owner → member`; membership `joined(pending) → active`.
- **Flow:** invitation appears only when data justifies it (2nd+ visit or wash cadence) - Relationship layer line or thread card → `join-club`: tiers (swipe cards, honest arithmetic vs their actual cadence) → `pay` (at studio / UPI ref) → `pending` rendered honestly ("The studio confirms and your card goes live - usually within hours") → `active`: member card animates into the Relationship layer.
- **Errors:** UPI ref unverifiable → thread line from studio, human resolution; never an error state. **Success:** benefits appear *in context* at the next visit ("Thursday's wash - covered"). **Edge:** corporate/multi-studio membership → tier carries `studioId`/party-group scope; UI unchanged (law of growth).

### C2 · Membership renewal
- **Flow:** M4 on the membership term → push #11 → `join-club` in renew mode (one yes; same tier default) → `renewed`. Grace (7d) keeps benefits with one honest line. Lapse → card greys ("member 2026–2027"), rejoining restores continuity. Never guilt, never countdown.

### C3 · Referral
- **Intent:** "My friend should come here."
- **Flow:** Relationship layer, one line ("A friend's first detail, on us") → native share (personal link) → friend's onboarding credits both → thread thank-you to the advocate (recognised, not gamified; `advocate` flag set). **Edge:** friend already a customer → link degrades to a warm no-op, both told honestly.

### C4 · Offer redemption
- **Ruling restated:** offers do not exist as inventory. A discount is a **reasoned proposal** (studio- or system-authored visit with adjusted amount + stated reason: "monsoon prep, members' week"). Redemption = B5 acceptance. There is no code entry, no offers page, no expiring-banner mechanics. **Edge:** a legacy printed coupon → the studio applies it at the desk; the chapter's amount simply reflects it.

---

## PART D - MEMORY & IDENTITY

### D1 · Customer adds a memory
- **Flow:** Timeline layer → `moment-add` → photo + one line → files chronologically. Queueable offline (M2). Delight follows Article 10: resurfaced later as a gift, never leveraged.

### D2 · Viewing / sharing an old invoice (recall at year 3)
- **Flow:** capsule → desk search ("march ceramic") → chapter → share (`/chapter/[id]`, amounts hidden to others). ≤2 gestures + query. **Edge:** pre-V3 (V2-era) visits → migrated chapters render typographically (no photos) with full facts - dignified, per the degradation law.

### D3 · Changing phone / details
- **Flow:** `you` sheet → phone edit → OTP re-verify → done. Address is not stored unless a future visit kind (pickup) needs it; when it does, it enters through `you` with its reason stated. **Edge:** phone is the party key for invites/transfers → change re-links pending invites automatically.

### D4 · Deleting the account
- **Intent:** "Remove me."
- **Flow:** `you` → "Leave AutoModz" → M6 confirm (plain: what is kept, what is erased) → party PII erased/anonymised; **vehicle twins persist anonymised** (service history integrity - stated honestly in the confirm); membership terminated with any owed balance surfaced first via thread.
- **Success:** leaving is as dignified as arriving. No retention theatre, no "are you really sure," one honest consequence statement. **Edge:** active visit in progress → deletion pends until the car is returned (stated plainly).

### D5 · Notification preferences
- **Flow:** `you` → plain sentences with switches (per IA §7 opt columns). The two "always" classes (custody, reveal, delay, dormancy-once) are shown but not switchable, with their reason.

---

## PART E - SYSTEM JOURNEYS

### E1 · Offline, wholesale
Any screen, no network: M2 everywhere. The Glance is fully useful from cache (portrait, truth-as-of, timeline). Queueable: moments, preferences, thread drafts. Non-queueable: visit agreement, payments, invites - single action disabled + whisper. Reconnection syncs silently; a queued thread message sends with its original timestamp.

### E2 · Errors, wholesale
No error cards, no toasts stacks, no red screens. Three renderings only: the whisper line (connectivity/staleness), the concierge line inside a sheet (submit failure, M1), and the thread (anything needing a human). Crashes → `/error` in the concierge voice with one action: "Back to the car."

### E3 · Notification arrival (every push)
Tap → deep link per IA §7 registry → exact object state. Notification arrives while app foregrounded → no banner duplication; the capsule/truth line is already current (live listeners). Push permission denied → product fully functional; the thread carries what pushes would have; one-time line explains what they're missing, never repeated.

---

## Coverage checklist (founder's list → flows)
First install A1 · First vehicle A1 · Second vehicle A2 · First booking B1 · Express wash B2 · Ceramic B3 · PPF B4 · Membership purchase C1 · Renewal C2 · Vehicle in studio B6 · Vehicle completed B7 · Delivery B7 · Invoice B7/D2 · Warranty B8 · Protection renewal B9 · Referral C3 · Offer redemption C4 · Adding family member A6 · Removing vehicle A3 · Selling vehicle A4 · Buying another vehicle A5 · Changing phone D3 · Changing address D3 · Deleting account D4 - **complete.**

**End of Phase 2. Awaiting flow approval; Phase 3 (the design system) begins only after.**
