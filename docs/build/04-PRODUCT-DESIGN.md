# 04 · THE PRODUCT DESIGN
### Phase 4+5 — the complete application, screen by screen, with the internal design review applied

This is the design file in written form: every screen described so another designer recreates it exactly — geometry, states, copy, motion. Sources of truth: Constitution · Experience Principles · IA (frozen) · Flows (frozen) · Studio design system (frozen). All measures in pt on the compact class (iPhone) unless stated; tokens per system (`inset 24`, `movement 96`, etc.). All copy strings are final production copy unless marked ⟨variable⟩.

The design review (Part F) was performed on the finished design; its 14 findings are already folded in and each is marked ◆R# where it changed a screen.

---

# PART A — THRESHOLD

## A1 · Authentication `/auth/login`
Full `paper` screen. Vertically centred column, `inset` margins:
- Wordmark "AUTOMODZ" — Display 32, ink, tracking per logotype.
- `rest 48`.
- "Your car's home." — Body 19, ink-2. (One line. No feature list, no carousel. ◆R1 deleted a planned three-line value prop — the product should not pitch at its own door.)
- `movement`.
- Action-primary, full-width, radius 12: "Continue with Google".
- Whisper, `gap` below: "The studio will know you by this account."
States: pressing → inline ring in the button; auth failure → concierge line under the button: "That didn't work — try once more." Offline: button disabled, whisper: "You'll need a connection to come in."
Dark rendering: chrome inverts per system. No photography here — the first photograph the customer sees must be *their* car.

## A2 · Onboarding `/app/welcome` — four moments, forward-only
Progress is implied by movement; no step dots (◆R2 removed them — four moments don't need a map).

**W1 Welcome.** `paper`. Centred: "Welcome to AutoModz." Display 32 → `line` → Body 16 ink-2, max 3 lines: "This is where your car will live — its care, its protection, its story. It starts with the car." → `rest` → Action-primary "Begin".
**W2 You.** Title 24 "You". Two `Field`s prefilled from Google: Name, Phone (Data glyphs). Action-primary "That's me". Phone edit triggers OTP inline (Field variant, 6 glyphs).
**W3 The car.** Title 24 "The car". Four `Field`s: Make, Model, Year, Plate (Data, auto-caps). Action-primary "Next". No category/colour pickers (they don't exist in this product; the photograph carries what a colour dropdown pretended to).
**W4 The portrait.** `stage`. Over-text centred: Display 24 "Now, the portrait." → Body 16 over-2: "Take a photo of the ⟨model⟩ — front three-quarter, in good light. It becomes your home screen." → camera `Field-photo` full-width → Action-on-photo "Open camera" · Action-quiet (over-2) "Later".
Capture → preview full-bleed with 4:5 crop guide → "Use this" / "Again".
Exit scene (480ms): the captured portrait scales from preview to full-bleed and the Glance assembles over it — name rises, truth line fades in: "Welcome to the studio." This is the product's first signature moment and must feel like hanging a picture.
Skip path: lands on typographic portrait; capsule reads "Add the ⟨model⟩'s portrait".

---

# PART B — THE GLANCE `/app` (Car · Passport · vehicle switching)

One vertical composition. Layers render only when true (silence law). From top:

## B1 · Portrait region (92vh min)
- Photograph full-bleed 4:5, into the top safe area; 64pt top scrim @24% when needed for status-bar legibility.
- Bottom scrim (0→55%, lower 30%).
- Bottom-left, `inset` margins, stacked upward from 128pt above bottom edge (capsule clearance):
  - ⟨Car name⟩ — "Mercedes-AMG C 43" — Display 44, over. Wraps to 2 lines max on SE.
  - `line 12`.
  - TruthLine — Body 19, over-2 → examples (priority order per system):
    "In the studio — Deepak is on the interior." / "Ready for collection." / "Thursday 10:00 — we're ready for it." / "Ceramic coat — 212 days of protection left." / "Last washed 34 days ago." / "All quiet. Protected."
- Top-right, safe-area padded: avatar 36pt circle (photo or initial on `linen`), tap → `?sheet=you`.
- **Vehicle switching:** horizontal pager. Next portrait peeks 24pt at the trailing edge *during drag only* (rest state is clean full-bleed ◆R3). Page dots (4pt, over-2/over) bottom-centre 96pt up — **rendered only when vehicles ≥2** (◆R4). Last page = Add-a-car invitation: `stage` ground, centred Display 24 over: "Another car?" → Body 16 over-2 "The garage has room." → Action-on-photo "Add a car".
- States: typographic portrait (model name Display 44 centred on `stage`, plate in Data below); loading = blurhash→fade; offline = cached photo + whisper under truth line: "Offline — as of 7:40 pm".

## B2 · The Capsule (fixed, all screens except Stay-expanded/sheets)
Glass pill, bottom `safe+16`, height 52. Production strings by state:
- quiet: "AutoModZ" wordmark alone, caption, ink-2 — the product at rest says only its name (◆R5 replaced "Everything's fine" — the house doesn't narrate calm).
- proposal: "Ceramic maintenance is due · Thu 10:00 free" + trailing "Yes" (emphasis). Tap word = agree sheet; tap elsewhere = Desk.
- agreed: "Thursday 10:00 · confirmed".
- live: "In care — final checks soon" → tap = Stay.
- ready: "The ⟨model⟩ is ready." (assent ink on "ready").
Long-press (350ms): shelf sheet — six quiet rows (see D2), same component as Desk shelf.

## B3 · Now layer (only when a visit is `agreed` or live-collapsed)
Header none (it's the news, not a section). Content block at `inset`:
- "Thursday, 10 July · 10:00" — Title 24.
- "Ceramic maintenance wash · ₹1,200 · pay at the studio" — Body 16 ink-2.
- "We're ready for the C 43. Park at the front — ask for Arjun." — Body 16 ink-2 (studio-authored prep line, appears T-1).
- Actions row: quiet "Change" · quiet "Cancel" (→ `visit-adjust`).

## B4 · Protection layer
Header: "Protection" Title 24. Per protection, a `PhotoBand` 21:9 (detail photo of *this car's* panel; typographic band on `linen` if none): over-text bottom-left: "Ceramic coat" emphasis + "Applied March 2026 · 212 days left" caption over-2. Term states re-word: waning → "Renewal window open — 24 days left" (+ the capsule carries the proposal); expired → band converts to `gallery` ground, ink text: "Ceramic coat · 2026–2027 · ran its course." with quiet "Renew".
Empty: layer absent (silence).

## B5 · Timeline layer (Memories · Documents live one tap deeper)
Header: "The story" Title 24 + trailing quiet action "Add" (→ `moment-add`).
Stream of `MomentEntry`, newest first, `rest 48` rhythm:
- Visit chapter: photo (best of visit, ≤4:3) → caption line: "Full detail · 14 June 2026" Body 16 + "12 photos · Deepak" whisper. Tap → Chapter.
- Customer moment: photo natural → their caption Body 16 + "by you · Ladakh, May 2026" whisper.
- Milestone (no photo): "One year with AutoModz." Body 19 + Data date. Hairline-free.
First-use (no visits): single invitation — "The ⟨model⟩'s story starts with its first visit." Body 19 ink-2 + quiet "Arrange one".
Migrated V2 visits: typographic entry — service + date + amount block, dignified, no photo.

## B6 · Identity layer
Header: "Papers" Title 24 (◆R6 renamed from "Identity" — customers say papers, not identity).
- Plate + VIN — Data 16, ink-2, two lines.
- Records list: "Care record — 14 June 2026" Body 16 rows (tap → Chapter; future kinds → document view). Row count >6 collapses to "All records (12)" → Desk records focus.
- "What's it worth? Ask the studio." — quiet action → thread prefilled.
- "Who can see this car" — quiet → viewer management inside `car-form`.
- "Edit details" / "I no longer have this car" — quiet, the latter opening `car-form`'s retire state.

## B7 · Relationship layer (Membership · Referral · the signature)
Header: "The Club" Title 24.
- Member: `MemberCard` — 16 radius, paper, hold shadow, hairline edge, assent thread line at top; "N. Sharma" emphasis; "Club · since March 2026" Data; below card: "5 washes left this cycle · renews 3 August" Body 16 ink-2.
- Non-member (2nd visit onward): one line — "You wash often. The Club would suit the ⟨model⟩." Body 19 + quiet "Have a look" → `join-club`. Before that: layer absent.
- Pending: card at 62% + whisper "The studio is confirming — your card goes live within hours."
- Lapsed: card ink-3, "Club · 2026–2027"; line: "Rejoin any time — your history holds." + quiet "Rejoin".
- `rest` → "A friend's first detail is on us." Body 16 + quiet "Share" (native share).
- `movement` → the signature: wordmark caption ink-3, studio address Data 14 ink-3, "Message the studio" quiet → Desk. Page ends `safe+96`.

---

# PART C — THE STAY `/app/visit/[id]` (live) & THE CHAPTER

## C1 · The Stay — full-bleed `stage`, five acts
Presents via takeover breath. Layout (constant across acts): top 60% = evidence photograph (newest, blurhash-fade; if none, the car's portrait dimmed 40%); lower 40%:
- Act title — Display 32 over: "Received" / "Looked over" / "In care" / "Final checks" / "Ready".
- Narration — Body 19 over-2, one or two sentences, studio/system-authored:
  - Received: "The C 43 is with us — checked in at 9:58." (+time always real)
  - Looked over: "Arjun walked the car. Two notes — nothing serious. Have a look." → findings open as photo viewer with captions ("Existing swirl marks, bonnet — noted before work.").
  - In care: "Deepak is hand-finishing the hood." ⟨variable per craft moment⟩
  - Final checks: "Almost. We check everything twice."
  - Ready: transitions to the Reveal (C2).
- Act row — five act words in caption, done = over + assent tick, current = over, future = over-2. No bars, no percentages.
- Timing line — whisper: "Ready around 4:30" · delay re-word: "Running 40 minutes long — the interior deserved it." (Never silently late.)
- Scope addition (B3-flow): a thread card surfaces *inside* the Stay above the act row: "Arjun found paint swirls under the old coat. Correcting them properly adds ₹4,500 and a day. Photos attached." → "Go ahead" / "Leave it" — work waits.
Collapse: drag down — portrait re-emerges live beneath; collapsed state = glass act bar above capsule: "In care · Deepak on the interior" (tap re-expands). Close/back: bottom-left over-2 chevron, 44pt.
Reduced motion: crossfades. Offline: last act cached + whisper.

## C2 · The Reveal (Stay, act 5)
The screen quiets: evidence area shows **the finished portrait alone** for 1.2s before anything else renders (◆R7 — the car gets the first word). Then, rising:
- "Ready." Display 32.
- Before/after — single `PhotoBand`, drag-divider slider, arrival|finished, same angle.
- Craftsman's line — Body 19 over: ""The coat took beautifully — keep it dry for 48 hours." — Deepak".
- Amount block — Data 16 over-2: "Ceramic maintenance · ₹1,200 · pay at the desk" (or "Covered by the Club").
- Action-on-photo "Collect any time before 7".
No rating request here (constitution: nothing sells or asks beside the finished car). On physical handover → archive scene: the finished photo travels into the timeline (signature #2) and the Chapter opens.

## C3 · The Chapter `/app/chapter/[id]` (owner) · `/chapter/[id]` (public)
`paper` document page. Back chevron floats bottom-left; share top-right.
- Hero — finished photo 3:2 full-bleed, scrim; over it: "Full detail" Display 32 + "14 June 2026 · AutoModz Studio" Data over-2.
- The work — Body 16 list in human language ("Two-stage machine polish", "Ceramic maintenance layer", "Interior deep clean"), `line` rhythm.
- The evidence — act-grouped photo run (`PhotoBand`s with act captions: Arrival 9:58 → Looked over → In care → Finished). Tap → stage viewer, swipe-through.
- The people — "Cared for by Deepak · checked by Arjun" Body 16 ink-2.
- The promise — if protection applied: `gallery` block, radius 16: "Ceramic coat — protected until 14 June 2027." Body 19, assent on "protected" + "Warranty filed to the C 43's papers." whisper.
- The amount (owner only) — hairline-ruled Data table: items, total "₹8,400 · paid UPI". Public view omits this block entirely.
- Next — "First maintenance wash due around September. We'll suggest it." whisper.
- Rating (owner, once, ≤24h): "How was it?" Body 16 + five quiet tick-targets; after tap: "Thank you." and the block never returns.
Migrated V2 chapter: typographic hero (`stage` band, service name Display 24) — same page, no photos.

---

# PART D — THE CONVERSATION `/app/desk`

Presents as full-screen sheet (slides up `move`, grab-handle). Three regions:

## D1 · Thread (primary, bottom-anchored)
- Messages: studio = plain Body 16 ink blocks, left-aligned, timestamp whisper on day change; customer = Body 16 on `linen` 16-radius blocks, right.
- Cards (M5 references, 16 radius `gallery`): **Proposal** — "Ceramic maintenance · Thu 10:00 · ₹1,200" caption reason line on top: "The coat's first maintenance is due." + Action-primary word "Yes" + quiet "Another time" (→ agree sheet slot state). **Visit** — state-worded ("Thursday 10:00 · confirmed" / act line when live, tap→Stay). **Club** — tier + "Have a look". Cards update in place everywhere (references).
- Composer: `Field` bare, "Message the studio…", send glyph; queues offline with whisper "Will send when you're back."
First-use: one studio message pre-seeded at account creation: "Welcome. This is a direct line to the studio — booking, questions, anything about the ⟨model⟩. — AutoModz" (◆R8: the thread must never be empty; hospitality speaks first).

## D2 · Shelf (above thread, collapses on scroll into thread history)
Adaptive rows, Body 19, no icons/chevrons, ordered by relevance (live visit first, term edges next):
"The C 43's care" · "Protection" · "Papers & records" · "The Club" · "The studio" (address/phone/directions block) · "You". Rows exist only when their object does. Tap → the row expands the Desk into its focus panel (`focus=` deep-link equivalent): a `paper` sub-view listing that object's items (records list, protections list with term wording, club state) — each item → its home surface.

## D3 · Search
Field at shelf top, hairline underline, "Find anything — 'march ceramic', 'invoice'…". Results group by year, Data headers; rows = chapter/record/protection one-liners. Empty result: "Nothing for that — try the service or the month. Or just ask above." (routes to composer ◆R9 — search failure hands you to a human, dead-ends banned).

---

# PART E — SHEETS, SYSTEM, PLATFORM

## E1 · The eight sheets (production layouts)
All: `Sheet` anatomy, title Title 24, `inset` padding, primary full-width at bottom, internal confirm/done states, drag-dismiss.
- **visit-agree** — reason line ink-2 → summary block (car · service · slot · amount, Body 19/Data) → slot adjuster (`Field-slot`: day words row + time words row, selected `linen`) → Action-primary "Confirm Thursday 10:00" (label always carries the slot ◆R10). Done: assent tick + "Thursday's set. We'll be ready."
- **visit-arrange** — three stacked `Field` groups: The car (pager chips of owned cars, portrait thumbnails 3:2, selected `linen`) · The care (service rows: name Body 19 + honest from-price Data; "Something else?" → thread) · The time ("Today" leads if slots remain; else next-available highlighted). Express path: arriving with `service=wash` pre-answers group 2. Walk-in state: "Today's full — walk in before 6 and we'll fit the C 43 between jobs, or take tomorrow 10:00." + two Actions.
- **visit-adjust** — current summary → "Move it" (slot Field) / "Cancel the visit" → confirm state: "Cancel Thursday's visit?" Body 19 + Action-destructive "Cancel it" · quiet "Keep it".
- **join-club** — tier cards horizontally swipeable (MemberCard-shaped, `paper`, hold): tier name emphasis, "₹X/month · Y washes" Data, one honest line vs their cadence: "You've washed 3× monthly — this covers it." → pay choice (word-pair: "At the studio" / "UPI now" + ref Field) → Done: "Welcome to the Club." + card-arrival scene queued for the Relationship layer.
- **you** — Name/Phone Fields → "Notifications" section: sentence-switches per IA §7 ("Message me while the car's in care." etc.; always-on rows shown with whisper "Always — it's your car.") → "Install AutoModz" row (PWA) → "Sign out" quiet → `rest` → "Leave AutoModz" ink-3 → confirm state: plain consequence paragraph (twins anonymised, records kept) + Action-destructive "Delete my account".
- **car-form** — the four W3 Fields + portrait Field; edit mode adds viewer management ("Who can see this car": phone-invite Field + viewer rows with quiet "Remove") and "I no longer have this car" → retire confirm.
- **moment-add** — photo Field (camera/library) → caption Field "One line for the story…" → "Add to the story". Queues offline.
- **pay** — amount Data 24 centred → "At the studio" (default, selected `linen`) / "UPI" + reference Field → whisper "The studio confirms it — usually within hours."

## E2 · System states (global)
- **Loading:** cold start = cached Glance instantly (portrait from disk, truth-as-of) — the app has no splash beyond the OS's; first-ever run = `paper` + wordmark caption centred (≤1s target) → Glance assembles.
- **Offline:** whisper lines per surface; disabled single-actions with adjacent whisper "Needs a connection."
- **Errors:** the three renderings only. Crash page `/error`: `paper`, "Something went wrong on our side." Body 19 + Action-primary "Back to the car".
- **Deep links & notifications:** per frozen IA registries; every push's tap lands on the exact state; foreground pushes render nothing (surfaces are live).
- **Sharing:** chapter share = native sheet with OG card (finished photo + "The C 43 · Full detail · AutoModz"); referral share = personal line + link.

## E3 · Widgets & Live Activity
- **Home widget (S/M):** the portrait (S: square crop) + truth line (M adds next-visit line). Tap → `/app?car=X`. Data refresh = truth line cadence; never a logo-only widget.
- **Lock Screen / Dynamic Island (the Stay):** compact = act word + assent tick on change; expanded = act title + narration line + timing whisper; the Island's leading slot shows a 1:1 crop of the latest evidence photo. Ready state persists until collected. This is the Stay's constitutionally-correct off-app rendering: custody, honestly, at a glance.
- **Android:** identical geometry via widget + ongoing notification with act line (the platform's Live Activity analogue).

## E4 · Responsive & platform matrix
- **iPhone SE (375×667):** portrait region min-height relaxes to 88vh; car name wraps 2; layer headers 24→19 never (scale holds; spacing absorbs: `movement 96→72` on <700pt heights).
- **Pro Max:** capsule max-width caps at 560 centred; type scale unchanged (bigger canvas = more photograph, not bigger words).
- **Android:** identical design; system back = capsule-aware (closes sheet → collapses Stay → home); Material ripple replaced by the system press-scale (0.98) globally.
- **Tablet / `regular`:** text column 640 centred; photography full-bleed; sheets centre-panel 560; Desk two-pane at `wide` (thread 400 left, focus right).
- **Landscape (phone):** Glance = portrait letterboxed left 50%, layers scroll right; Stay remains full-bleed with lower-third text; sheets become right-side panels.
- **Split screen:** compact rules apply at <720 width regardless of device.
- **Keyboard:** sheets lift with keyboard, primary action stays visible above it; Desk composer docks.
- **Safe areas / Dynamic Island:** portrait bleeds behind the Island; no content in the top 15% photo-safe zone anyway (system law). Reduced-motion, Dynamic Type, VoiceOver: per system Part III, verified per screen.

---

# PART F — THE DESIGN REVIEW (performed on the finished design; findings applied above)

Method: every screen interrogated with the seven questions (disappear? merge? calmer? simpler? more premium? faster? more trust/delight?). Fourteen findings; all applied:

| ◆ | Finding | Ruling |
|---|---|---|
| R1 | Login value-prop pitched at the door | Deleted → one line: "Your car's home." |
| R2 | Onboarding step dots = bureaucracy for 4 moments | Deleted; movement implies progress |
| R3 | Permanent next-car peek cluttered the portrait at rest | Peek only during drag; rest state is a clean full-bleed |
| R4 | Page dots rendered for single-car owners | Render only at ≥2 vehicles |
| R5 | Idle capsule "Everything's fine" — the house narrating calm is noise | Idle = the wordmark alone; silence is the luxury |
| R6 | Layer name "Identity" is system language | Renamed "Papers" |
| R7 | Reveal showed before/after immediately — the comparison upstaged the car | Finished portrait alone for 1.2s first; then the story |
| R8 | Empty thread on first open = cold | Pre-seeded studio welcome message; hospitality speaks first |
| R9 | Search empty-state dead-ended | Routes to the composer — failure hands you to a human |
| R10 | Generic "Confirm" button on agree sheet | Label carries the commitment: "Confirm Thursday 10:00" |
| R11 | Duplicate idea: shelf sheet (capsule long-press) vs Desk shelf were drifting apart | Merged: one shelf component, two presentations |
| R12 | Chapter rating five-star row read as review-site | Kept one-tap ticks but quiet-styled, single-use, auto-vanishing; wording "How was it?" not "Rate us" |
| R13 | Protection expired band still photographic — the dead coat kept its glamour | Expired converts to typographic `gallery` band; photography is for living protection |
| R14 | Add-a-car page could read as upsell | Copy softened to "Another car? / The garage has room." — invitation, not acquisition |

**Cohesion verdict:** one motion language (3 durations, 2 scenes), one overlay, one accent used 3 ways, four text primitives everywhere, every screen answers the constitutional question, every state (empty/loading/offline/error/expired/first-use/returning/active/completed) defined in place. No screen failed the "deserves to exist" test after R1–R14; nothing further to delete.

**The product is designed. Ready for Phase 6 — the engineering implementation plan — upon approval.**
