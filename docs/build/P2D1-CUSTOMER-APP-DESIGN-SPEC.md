# AUTOMODZ CUSTOMER APP - COMPLETE DESIGN SPECIFICATION
### P2.D1 · Figma-level UX/UI blueprint · design only, no implementation

**Baseline:** commit `4c5d6ba`. Architecture is frozen (Constitution + IA); this specifies the **experience** only.
**Authority of values:** every number here is the canonical Studio system as shipped. Where this spec and code disagree, this spec is the design intent to converge on.
**How to read:** Part A = foundations (the token truth). Part B = components (exact specs). Part C = screens. Part D = sheets. Part E = transitions. Part F = states. Parts G–I = responsive, dark, accessibility. All measures in points (pt) on the compact class unless noted. No code, no CSS, no framework references - values are design specs.

---

# PART A - FOUNDATIONS

## A1 · Design principles (the lens for every screen)
1. The customer's car is the subject; the interface is a gallery wall.
2. Photography first, content second, controls last - in that visual order.
3. One sentence of truth beats a dashboard of numbers.
4. Silence is a valid state: when there's nothing true to say, show nothing.
5. Premium = confidence, precision, restraint - never decoration.
6. Motion communicates state change; it is never entertainment.

## A2 · Color & surface
Two renderings (light default / dark). Only *chrome* inverts - photography, the stage, scrims, and both accents are identical in both.

| Token | Light | Dark | Role |
|---|---|---|---|
| paper | `#FBFBF9` | `#111214` | The page ground |
| gallery | `#F1F1EE` | `#191A1C` | Recessed cards / sheet interior / input fill |
| linen | `#E7E7E3` | `#212325` | Pressed / selected / avatar ground |
| stage | `#0C0D0E` | `#0C0D0E` | The one dark surface: portrait fallback, the Stay, photo viewing |
| ink | `#141517` | `#F2F2EF` | Primary text, filled Action |
| ink-2 | ink @ 62% | fg @ 62% | Secondary text |
| ink-3 | ink @ 38% | fg @ 38% | Whisper, data captions, focus ring |
| hairline | ink @ 8% | fg @ 8% | The only border |
| over | `#F7F7F5` | `#F7F7F5` | Text on photography (100%) |
| over-2 | over @ 70% | over @ 70% | Secondary on photography |
| assent | `#2E5E48` | `#2E5E48` | The single accent (deep green ink). Confirmed tick · "covered/active" · member card thread. Never a background. |
| caution | `#8A5A2E` | `#8A5A2E` | Amber ink. Irreversible-confirm labels inside sheets only. |

**Laws:** no gradients except scrims; no pure black/white; color is never introduced by a screen - if a state seems to need color, it needs a better sentence.

## A3 · Typography
Three faces. Display = the car's name / act titles / chapter titles. Text = everything else. Data (mono) = plates, VINs, dates, amounts only - never labels.

| Style | Size / line-height | Weight | Face | Use |
|---|---|---|---|---|
| Display-L | 44 / 1.05, −2% tracking | 620 | display | Car name, reveal title |
| Display | 32 / 1.1, −2% | 620 | display | Act titles, chapter title |
| Title | 24 / 1.2, −1% | 560 | display | Layer headers, sheet titles |
| Emphasis | 19 / 1.45 | 520 | text | The working/advisor voice, key lines |
| Body | 16 / 1.45 | 400 | text | Sentences |
| Data | 14 / 1.45 | 400 | data | Plates, dates, amounts |
| Caption | 14 / 1.45 | 400 | text | Field labels |
| Whisper | 12 / 1.45 | 400 | text | Staleness, hints, silence, section micro-labels |

Ink usage: three text colours only (ink / ink-2 / ink-3), or over / over-2 on photography. Case: sentence case universally; ALL-CAPS only for the plate glyphs and the AUTOMODZ wordmark. No letter-spaced micro-cap labels.

## A4 · Spacing scale (the only seven numbers)
`hair 4 · breath 8 · line 12 · gap 16 · inset 24 · rest 48 · movement 96`
- Page inset (left/right margin, sheet padding): **inset 24**.
- Between layers (magazine air): **movement 96**.
- Within a text block: **line 12**. Between related controls: **gap 16**. Between sub-groups: **rest 48**.

## A5 · Radius (three, fixed + one chip)
`sheet 24 · card 16 · chip 12 · pill 999`. Buttons are not rounded rectangles; only the filled `primary` Action uses chip 12. Photographs use sheet 24. The member card and thread cards use card 16. Capsule, avatar, page-dots use pill.

## A6 · Elevation (two shadows total)
| Name | Spec | Used by |
|---|---|---|
| lift | `0 12 40 rgba(12,13,14,0.10)` | Sheets, the Capsule |
| hold | `0 2 12 rgba(12,13,14,0.08)` | The member card; card hover state |
Nothing else casts a shadow. A flat, photograph-led surface *is* the elevation system.

## A7 · Glass (one recipe)
Blur 24 / saturate 140%, over paper @ 72% (light) / #18191B @ 72% (dark), or stage @ 64% when over photography. Used **only** by the Capsule and the Stay's collapsed bar. Glass is never a card style or a nav background.

## A8 · Scrims (one hierarchy)
| Name | Spec | Use |
|---|---|---|
| scrim | `#0C0D0E @ 40%` | Sheet backdrop |
| scrim-strong | `→ 55%` bottom-anchored gradient, lower 30% | Portrait / PhotoBand bottom |
| scrim-soft | `→ 24%` top 64pt gradient | Status-bar legibility over photos |
Text never sits over the middle of a photograph - only in the bottom-30% scrim zone or top-15% cleared band.

## A9 · Motion
- **One curve:** `cubic-bezier(0.22, 1, 0.36, 1)` ("studio ease"). Sheets add platform spring on drag-release (felt physics = trust).
- **Three durations:** `tick 120ms` (press, toggle, check draw) · `move 280ms` (sheet, layer reveal, image fade, card state, text crossfade) · `scene 480ms` (the Stay presenting, chapter dissolve, act transitions).
- **Named transitions:**
  - *Rise* - new content: opacity 0→1 + 8pt upward, `move`, once.
  - *Crossfade* - changing text/state (TruthLine, Capsule): opacity swap, `move`.
  - *Press* - tap feedback: scale to 0.98, `tick`.
  - *Card hover* (pointer only): translateY −1 + hold shadow, `move`.
  - *Image load* - opacity 0→1 from surface, `move`.
  - *Takeover breath* (signature) - portrait scale 1.00→1.04 + stage fade-up as the Stay presents, `scene`.
  - *Visit→Memory dissolve* (signature) - reveal hero travels into the timeline's newest entry, `scene`, shared element.
- **Banned:** loops, pulses, shimmer, parallax inside the app, staggered list choreography, count-ups, confetti, anything > `scene`.
- **Reduced motion:** all transforms/reveals off (opacity kept); signature scenes become crossfades; press becomes instant; images appear without fade; drag physics retained (input, not animation).

## A10 · Iconography
Nearly icon-free - words outrank glyphs. Permitted set (16), 1.5pt stroke, round caps, 20pt frame, ink-2 or over-2, never filled/colored/animated: back-chevron · close · share · camera · photo-add · search · send · phone · location · calendar · check(assent) · plus · overflow-dot · sound · external. No icon carries meaning alone (always a paired word or aria-label). No icon buttons except back/close/share/avatar in established positions.

## A11 · Grid, breakpoints, safe areas
- 4pt base grid. Photography is full-bleed; text sits in the inset column.
- **compact** < 720: single column, full-bleed photos, inset 24.
- **regular** 720–1199: text column max 640 centered; photography still full-bleed.
- **wide** ≥ 1200: Glance letterboxes to a centered 720 column on paper; Desk becomes two-pane (thread 400 + focus panel).
- Portrait bleeds into the top safe area; capsule floats at `safe-bottom + 16`; scroll ends at `safe-bottom + movement` for capsule clearance; no content in the top 15% photo-safe band.

## A12 · Focus & baseline a11y
Keyboard focus ring: 2pt solid ink-3, 2pt offset, 4pt corner. Touch targets ≥ 44 (capsule 52). Contrast: all ink levels pass AA at their sizes; over-on-photo guaranteed by scrim minimums; assent 6.8:1, caution 5.9:1 on paper. VoiceOver landmark order: portrait (one element: name+truth) → capsule → layers as headings.

---

# PART B - COMPONENT LIBRARY

Each component: **anatomy · box (padding / radius / height) · spacing · type · icon · elevation / border · motion · interaction states.**

## B1 · Portrait (the vehicle hero)
- **Anatomy:** full-bleed image (or stage fallback) → scrim-soft top 64 → scrim-strong bottom 30% → name + TruthLine stacked bottom-left → overlay slot (avatar top-right, page-dots bottom-center).
- **Box:** min-height 92vh (88vh on ≤ 667pt heights); image object-fit cover, radius 0 (bleeds to edges); text block inset 24, bottom padding `safe-bottom + 128` (capsule clearance).
- **Type:** name = Display-L, `over`; truth = via TruthLine `onPhoto`.
- **Icon/overlay:** avatar 36 pill on linen, ink initial (Caption weight); page-dots 4pt pills, active `over` / rest `over-2`, at bottom 96, shown only when vehicles ≥ 2.
- **Elevation/border:** none.
- **Motion:** image *Image-load* fade; portrait is the source of the *Takeover breath*.
- **States:** photographed / typographic fallback (Display-L name centered on stage + plate in Data below) / loading (stage ground + blur-up) / offline (cached image + whisper under truth).

## B2 · TruthLine
- **Anatomy:** one live sentence; container reserves min-height 28.
- **Type:** Emphasis-size 19 / 1.45; over-2 on photography, ink-2 in layers.
- **Motion:** *Crossfade* on text change; `aria-live=polite`.
- **Rule:** exactly one line; the sentence is authored to fit - never ellipsis (may wrap to 2 lines only at accessibility text sizes).

## B3 · Capsule (the concierge presence)
- **Box:** height 52, radius pill, padding 0 / 22 horizontal, max-width min(560, 100%−48), min-width 180; fixed at `safe-bottom + 16`, centered, z above all but sheets.
- **Surface:** glass (A7). Never moves position; never badges.
- **Anatomy:** state text (Body 16) + optional trailing action word (Emphasis 16, ink/over).
- **Type:** resting shows the AUTOMODZ wordmark (Display 13, +8% tracking, ink-2). Active states use Body 16.
- **Motion:** text *Crossfade*; *Press* on tap; long-press (350ms) opens the Desk shelf.
- **States:** resting (wordmark) · proposal (headline + "Yes") · requested · confirmed · live (act line, tap→Stay) · ready (assent on "ready").

## B4 · Desk (the Conversation surface)
- **Anatomy (top→bottom):** Title "The studio" → search field → [open proposal card] → object shelf → thread (visit cards) → composer.
- **Search field:** full-width, hairline underline only (an allowed hairline), Body 16, placeholder ink-3, 8pt vertical padding; results group by year with Whisper headers.
- **Shelf rows:** height 52, 12 vertical padding, Emphasis 19 label + optional Whisper detail right-aligned; no icons, no chevrons - the row is the affordance. *Press* feedback.
- **Cards (proposal / visit):** gallery ground, radius card 16, padding 16; visit cards get *Card hover* + *Press*.
- **Composer:** the "Message the studio" Action-quiet (WhatsApp at launch).
- **Motion:** presents as a sheet (see D). Search failure routes to the composer (no dead-end).

## B5 · Layer (Glance section wrapper)
- **Box:** top margin `movement 96`, left/right inset 24; renders nothing when empty (silence law).
- **Header:** optional Title 24 + optional trailing Action-quiet, baseline-aligned, `inset 24` below to content.
- **Motion:** *Rise* on first scroll-into-view, once (position-only, so a missed observer tick can never hide content).

## B6 · PhotoBand
- **Ratios:** band 21:9 (protection), memory ≤ 4:3, hero 3:2 (chapter).
- **Box:** radius sheet 24, overflow hidden; ground stage (with photo) / linen (without).
- **Over-title (band only):** Emphasis `over` + caption `over-2 14`, in the bottom scrim, padding 48/24/16.
- **Below-caption:** Body (caption) 12 above, Whisper 4 above.
- **Motion:** *Image-load* fade; tappable variant gets *Press*.
- **Degradation:** no photo → typographic treatment on linen; never a placeholder image or stock car.

## B7 · MomentEntry (timeline atom)
- **Photo moment:** a PhotoBand (memory ratio) + caption + whisper.
- **Milestone:** text-only - Emphasis line + Data date, no card, no photo.
- **Photo-less visit:** dignified Body caption + Whisper (amount), *Press* if tappable.
- **Rhythm:** entries separated by `rest 48`.

## B8 · MomentStage (the Stay renderer)
- **Anatomy:** on stage - top 60% evidence photo (or dimmed portrait) → act title Display 32 `over` → narration Emphasis 19 `over-2` → act row (five word-dots) → timing Whisper.
- **Act row:** five act names in Whisper; done = over + assent check (drawn `tick`), current = over, future = over-2. No bars, no percentages.
- **Collapsed variant:** glass bar above capsule position with the act line; tap re-expands.
- **Motion:** *Takeover breath* to present; act change crossfades title + advances one check; *Visit→Memory dissolve* on archive.

## B9 · MemberCard (the one literal card)
- **Box:** radius card 16, hairline border, `hold` shadow, overflow hidden; a 3pt assent bar across the top (hairline when lapsed); inner padding 24.
- **Type:** name Emphasis; "tier · since" Data 14 ink-2; pending line Whisper.
- **States:** active (full) · pending (opacity 62%, internal confirming line - shown here only, never duplicated) · lapsed (ink-3, dates kept).
- **Motion:** animates in once (its scene arrival into the Relationship layer on activation).

## B10 · Sheet (the single overlay)
See Part D for full behavior. Box: gallery ground, top radius sheet 24, `lift` shadow, grab-handle 40×4 hairline (12 above), inner padding 24 / (24 + safe-bottom); max-height 88vh; backdrop scrim 40%.

## B11 · Field (the one input)
- **Anatomy:** Caption label (14, ink-2, 4 below) → input value → optional error line.
- **Box:** hairline underline only, no box, radius 0, 6pt vertical padding.
- **Type:** value 19; text kind weight 520 in text face; phone/data kinds 400 in data face (data uppercased).
- **States:** rest (hairline) → focus (underline → ink; keyboard adds the 2pt ink-3 ring) → error (a concierge line below in Caption ink-2, never red text alone; caution reserved for irreversible confirms).
- **Variants:** text · phone · data · (composed) slot-picker (day/time word chips) · tier-picker (member-card-shaped) · switch (label + 44×24 toggle, accent ink) · photo (camera affordance on gallery well).

## B12 · Action (the one button)
- **Variants & box:**
  - `primary` - filled ink bar, `over` text, full-width (in sheets), radius chip 12, padding 14/24, min-height 44, Body 16 weight 520.
  - `quiet` - ink text only, Emphasis 19 weight 520, padding 10/0, min-height 44.
  - `destructive` - caution text, quiet layout, confirm-state only.
  - `on-photo` - over text, quiet layout.
- **States:** press → scale 0.98 `tick`; loading → inline 14pt ring replaces label (the app's only spinner); success → assent check draw `tick`; disabled → ink-3 label + Whisper reason adjacent (never a mystery).

## B13 · Text primitives
Display-L / Display / Title / Emphasis / Body / Data / Whisper - exactly as A3. Every character on every screen is one of these. Raw type sizes outside them are a defect.

## B14 · EmptyState
One-sentence invitation: Emphasis-size Body 19 ink-2 + optional Action-quiet (`line 12` below). Silence (render nothing) is the other legitimate empty state; there is no "nothing here yet" card.

## B15 · Spinner
14pt ring, 1.5pt, currentColor, top transparent, one revolution ≈ 0.7s. **Only** inside a pressed Action. Static under reduced motion.

## B16 · Skeleton
Gallery-toned block, radius card 16 (overridable), a gentle opacity breathe 1→0.55→1 over 2.4s. **Only** for an image still loading - never for text (cached truth renders instantly). Fully static under reduced motion.

---

# PART C - SCREENS

Format per screen: **Purpose · Hierarchy · Layout · Spacing · Type · Cards · Imagery · Interactions · Animations · Sheet behavior · Gestures · Navigation · CTA hierarchy · States · Responsive · Dark · Accessibility.**

## C1 · THE GLANCE - Home + Vehicle (route: the root)
The Home and the Vehicle are one surface (the architecture merges them).

- **Purpose:** answer "what's happening with my car?" in under 5 seconds - which car, is it protected, what's next.
- **Hierarchy:** 1 Portrait (the car) → 2 Now (next action) → 3 Protection → 4 The story → 5 Papers → 6 The Club → 7 signature. Emotional order is law; no layer may jump it.
- **Layout:** a single vertical scroll. Portrait fills the first ~92vh. Layers follow at `movement 96` rhythm, inset 24. Bottom padding clears the capsule.
- **Spacing:** header→content within a layer = inset 24; text blocks = line 12; groups = rest 48.
- **Type:** car name Display-L; layer headers Title 24; truth Emphasis 19; captions Body/Whisper.
- **Cards:** almost none - protection is a PhotoBand, story is MomentEntry, the only literal card is the MemberCard in Club.
- **Imagery:** the customer's/studio's car photo is the hero; protection shows a detail shot of *that* car's panel; story shows the best shot per visit. One hero per screen; a second photo renders ≥ 50% smaller.
- **Interactions:** horizontal swipe = between vehicles (last page = add-a-car); vertical scroll = depth; avatar → You sheet; capsule → Desk (or the Stay when live); every tappable element has *Press*.
- **Animations:** portrait *Image-load*; layers *Rise* once; truth/capsule *Crossfade*; no stagger.
- **Sheet behavior:** You, Arrange, Desk, Add-car open as bottom sheets over the Glance (Part D).
- **Gestures:** swipe left/right (cars, 24pt peek during drag only), scroll (depth), capsule long-press (shelf shortcuts), avatar tap.
- **Navigation:** none visible. The capsule is the only global control. Deep-link `?car=<id>` positions the pager; `?sheet=<name>` opens a sheet.
- **CTA hierarchy:** (1) the capsule's contextual action; (2) the Now layer's single action (Arrange / Change-or-cancel); (3) contextual quiet actions deeper (Renew, Edit details, Share). Never two primaries on screen.

**Layer specs:**

**Now (§B3 region):**
- *Agreed/Reserved visit:* Whisper label ("Your next visit" if confirmed / "Requested" if proposed) → Title date · time → Body "service · ₹amount · pay at the studio" → (proposed only) Whisper "The studio is confirming your visit." → Action-quiet "Change or cancel".
- *No visit but an open proposal:* Whisper "A suggestion from the studio" → Emphasis reason sentence (advisor tone, cites the object, never a warning) → Action-quiet "Arrange it".
- *Neither:* renders nothing (silence).

**Protection:**
- Title "Protection". Per active protection: a PhotoBand (band 21:9) with over-title = protection name ("Ceramic coat"), over-caption:
  - healthy → "Protected until <Month Year>" (confidence, warranty surfaced - never a countdown).
  - waning/expiring → "Renewal window open - <n> days left" (the one place a number is actionable).
- Expired protection: converts to a typographic gallery block (radius sheet, inset padding): "Ceramic coat · 2026–2027 · ran its course." + Action-quiet "Renew". Photography is for *living* protection only.
- No protection → layer absent.

**The story:**
- Title "The story". Summarised to the **3 most recent** chapters (MomentEntry), newest first, `rest 48` apart; if more exist, Action-quiet "Show earlier visits (<n>)" reveals the rest (resets when switching cars).
- Each entry: best photo + "service · date" caption + "<n> photos · <craftsman>" whisper (or ₹amount when photo-less).
- Empty → EmptyState "The <car>'s story starts with its first visit." + "Arrange one".

**Papers:**
- Title "Papers". Plate in Data. Care records as tappable "Care record - <date>" rows (documents). Action-quiet "Edit details" (→ car-form). (In the vehicle-OS future this vault also holds RC/insurance/PUC.)

**The Club:** see C7.

**Signature:** AUTOMODZ wordmark (Whisper, display face, +8%), studio address (Data 14 ink-3), Action-quiet "Message the studio" (→ Desk). Ends the scroll like the signature on a letter.

- **States:** no-vehicle → the add-a-car invitation *is* the whole Glance (stage ground, "Another car? / The garage has room." - worded as first-run "Welcome"). Single vs multi-vehicle (dots only at ≥ 2). Offline → cached portrait + whisper. Live visit → the Stay auto-presents.
- **Responsive:** compact single column; regular text column 640 centered, photo full-bleed; wide letterboxes to 720 centered.
- **Dark:** chrome inverts; the car photo and stage fallback are identical; the capsule becomes dark glass.
- **Accessibility:** portrait is one VoiceOver element (name + truth); layers are headings; every photo has a job-specific alt; controls live in the bottom 60% (avatar is the only top control); Dynamic Type reflows (truth may wrap to 2).

## C2 · THE CONVERSATION - Desk (route: `?sheet=desk` / `/app/desk`)
- **Purpose:** the single place to talk with the studio and recall anything - booking, renewal, support, history are all sentences here, not features.
- **Hierarchy:** search (recall) → open proposal (the one suggestion) → object shelf (jump) → thread (real visit cards) → composer.
- **Layout:** presents as a bottom sheet (compact) / centered panel 560 (wide+); internally the Desk component (B4). Two-pane at wide: thread left 400, focus panel right.
- **Cards:** proposal card (reason + "Arrange it"); visit cards (state-worded line + amount whisper) with card 16 radius, hover + press.
- **Imagery:** none - the Conversation is words; the objects it references carry the imagery on their own surfaces.
- **Interactions:** typing filters search live; empty result → "Nothing for that - try the service or the month. Or just ask." + composer. Shelf row tap → the object's surface. Composer → WhatsApp (launch).
- **CTA hierarchy:** (1) accept the open proposal; (2) search; (3) shelf jumps; (4) message.
- **States:** first-open thread is pre-seeded with one studio welcome message (never empty). Offline → composer queues with a whisper.
- **Accessibility:** search is a combobox; full keyboard traversal; the thread reads newest-last.

## C3 · BOOKING - the Arrange sheet (route: `?sheet=arrange`)
Booking is deliberately minor - a sheet, not a screen.
- **Purpose:** agree a visit in under 20 seconds; the studio confirms after.
- **Hierarchy:** three pre-answered questions - the car (implicit) → the care → the time → confirm.
- **Layout (bottom sheet):** Title "Arrange a visit" → "For the <car>." → **1 Service**: a plain list, each row = service name (Emphasis 19) + "from ₹X" (Data) right-aligned, press feedback; selecting collapses it to a gallery summary chip with "change". → **2 Day**: a horizontal scroll of day chips (radius chip 12; selected = linen ground; full days at 35% opacity, disabled). → **3 Time**: wrapped time chips (selected = linen); "No room that day - try another." when empty. → confirm Action-primary whose label carries the commitment ("Confirm Wednesday 10:00", or "… · covered by the Club").
- **Imagery:** none (speed over spectacle); the car is already the context.
- **CTA hierarchy:** one primary - Confirm - appears only when day + time are chosen.
- **Sheet behavior:** see D3.
- **States:** membership-covered wash shows "covered by the Club" and ₹0 intent; error → the sheet reopens with values + a concierge line; done → the visit appears in Now as "Requested" with the honest confirming line.
- **Accessibility:** each step is a labelled group; chips are radio-like; the primary stays visible above the keyboard.

## C4 · THE STAY - live visit (route: `/app/visit/[id]`, auto-presents)
- **Purpose:** the hero moment - turn waiting into hospitality; answer "where is my car and is it okay?" continuously.
- **Hierarchy:** the current act → its narration → evidence photo → the five-act progress → honest timing.
- **Layout:** full-bleed stage. Top 60% evidence photograph (or dimmed portrait). Lower 40%: act title Display 32, narration Emphasis 19, act row, timing Whisper. A back/collapse chevron bottom-left (over-2, 44pt).
- **Five acts (customer-facing translation of ops states):** Received → Looked over → In care → Final checks → Ready. Each names the work and, when known, the person ("Deepak is hand-finishing the hood.").
- **Cards:** a mid-visit scope-addition surfaces as an inline thread card above the act row ("Arjun found paint swirls… correcting them adds ₹4,500 and a day. Photos attached." → "Go ahead" / "Leave it") - work waits for the yes.
- **Imagery:** the evidence chain - arrival (custody, timestamped) → inspection (honest, flaws named) → craft (close, hands allowed) → finished. Wide→close→macro→wide.
- **Interactions/Animations:** presents via *Takeover breath*; act change crossfades title + advances one assent check; drag-down collapses to the glass act-bar (portrait re-emerges live beneath - you literally put the visit down); on archive, *Visit→Memory dissolve* into the new Chapter.
- **The Reveal (act 5):** the finished portrait holds the screen alone for ~1.2s, *then* rises: "Ready." → before/after slider (arrival|finished, same angle) → craftsman's line → amount ("pay at the desk" / "Covered by the Club") → "Collect any time before 7." No rating or upsell beside the finished car.
- **CTA hierarchy:** during care, none (watching is the experience); at Ready, one - collection.
- **States:** photo-less degraded mode (acts narrate without images - never a broken frame); delay → one honest line ("running 40 minutes long - the interior deserved it."); offline → last act cached + whisper.
- **Off-app rendering:** Lock-Screen / Live Activity = act word + assent check; expanded = act title + narration + timing, with a 1:1 crop of the latest evidence photo. Ready persists until collected.
- **Accessibility:** act changes via live region; the Stay collapses with a visible control equivalent to the drag; reduced motion → crossfades.

## C5 · THE CHAPTER - care record (route: `/app/chapter/[id]` owner · `/chapter/[id]` public)
- **Purpose:** the permanent, shareable document of one visit - the invoice reborn as a keepsake.
- **Hierarchy:** hero photo → the work → the evidence → the people → the promise → (owner) the amount → next → (owner) rating.
- **Layout:** paper document page. Hero 3:2 full-bleed with scrim; over it Display 32 "Full detail" + Data "date · AutoModz Studio". Back chevron bottom-left, share top-right.
- **Sections:** *the work* = human-language Body list; *the evidence* = act-grouped PhotoBand run (tap → stage viewer, swipe-through); *the people* = "Cared for by <lead> · checked by <qc>" Body ink-2; *the promise* = a gallery block "Protected until <date>" (assent on "protected") + "Warranty filed to the <car>'s papers." whisper; *the amount* (owner only) = hairline-ruled Data table, items + total + method - omitted entirely in the public view; *next* = a whisper next-due; *rating* (owner, once, ≤ 24h) = "How was it?" + five quiet tick targets → "Thank you.", never returns.
- **Imagery:** the full evidence chain; the public share shows the beauty, hides the money.
- **CTA hierarchy:** share (top); rating (once); otherwise a document to read.
- **States:** migrated pre-V3 visit → typographic hero (stage band, service name Display) with full facts, no photos.
- **Accessibility:** the amount table is a proper table; photos carry act-labelled alts.

## C6 · PROTECTION - detail (lives as the Glance layer; a focus panel in the Desk at `focus=protection`)
- **Purpose:** show what shields the car, confidently.
- **Hierarchy:** each protection = name → state → evidence. Confidence over countdown (until-date), except waning/expiring where the number is the action.
- **Layout/Imagery:** PhotoBand bands (C1). The Desk focus panel lists all protections with their term wording and links each to its source Chapter.
- **Future:** insurance / warranty / RSA / tyres enter as new protection types on the same band + term wording - no new layout.
- **States:** healthy / waning / expiring / expired (typographic) / none (absent).

## C7 · MEMBERSHIP - The Club (Glance layer + Join sheet `?sheet=join-club`)
- **Purpose:** make membership an object you hold and privileges you feel, not a pricing page.
- **Hierarchy:** the card (identity) → the benefit in context → renewal (only when near) → referral.
- **Layout:** MemberCard (B9) → below it Body ink-2 "<n> washes left this cycle · renews <date>"; pending → the card's own confirming line (no duplicate); lapsed → "Rejoin any time - your history holds." + "Rejoin". Non-member (after 2nd visit) → EmptyState "You wash often. The Club would suit the <car>." + "Have a look". Then referral: "A friend's first detail is on us." + "Share".
- **Join sheet:** tier cards (member-card-shaped, swipeable) each with honest arithmetic vs the customer's own cadence → pay choice (at studio / UPI reference) → pending state, honest ("The studio confirms and your card goes live - usually within hours.") → the card animates into the Relationship layer on activation.
- **CTA hierarchy:** join / renew (contextual) → share.
- **States:** none / non-member-invite / pending / active / grace / lapsed. Never guilt, never a countdown to lapse.
- **Accessibility:** the card is a labelled region; tier chips are radio-like.

## C8 · PROFILE + SETTINGS - the You sheet (`?sheet=you`)
Profile and Settings are one small sheet - settings are maintenance, not a place.
- **Purpose:** identity + preferences + escape hatches. No stats, no link farm.
- **Layout (bottom sheet):** Title "You" → Field Name → Field Phone → "Notifications" group of sentence-switches (each a Body line + 44×24 toggle; the always-on classes shown with a Whisper "Always - it's your car.") → Install AutoModz (when available) → Sign out → (deep) "Leave AutoModz" with an in-sheet confirm state that plainly states what's kept (anonymised vehicle history) and what's erased.
- **CTA hierarchy:** implicit save on dismiss; destructive delete is a two-text-action confirm state, never a second overlay.
- **Accessibility:** switches are labelled by their sentence; focus trapped; Esc/back saves and closes.

## C9 · NOTIFICATIONS - philosophy, not a screen
There is **no inbox, no bell, no badge**. The ambient surface is the capsule + truth line; history lives in the thread.
- **Emitters (the lifecycles are the whole list):** prep-note (visit-eve) · custody "arrived" (always) · inspection note (if findings) · craft photo (opt-in) · honest delay (always) · the reveal (always) · chapter filed · follow-up (studio, human) · protection waning/expiring (once each) · membership renewing (once) · one delight/week (anniversary, milestone, memory, seasonal) · dormancy line (once ever).
- **Budget:** ≤ 2 pushes/week outside live visits; every push deep-links to the exact state.
- **Preferences:** plain sentences in the You sheet.
- **Voice:** one calm studio host; the car by name; reasons always given; no urgency, guilt, emoji, or ops vocabulary.

## C10 · ONBOARDING / FIRST VISIT (route: `/app/welcome`, once)
- **Purpose:** produce a photographed car so the Glance can exist; form the mental model in one session.
- **Four moments (forward-only, no step dots):**
  1. *Welcome* - paper; Display 32 "Welcome to AutoModz." + one Body paragraph ("This is where your car will live - its care, its protection, its story. It starts with the car.") + Action-primary "Begin".
  2. *You* - Title "You"; Name + Phone Fields (prefilled), phone edit → inline OTP; "That's me".
  3. *The car* - Title "The car"; Make / Model / Year / Plate Fields (Data, auto-caps); "Next". No colour/category pickers - the photo carries what a dropdown pretended to.
  4. *The portrait* - stage; "Now, the portrait." + "Take a photo of the <model> - front three-quarter, in good light. It becomes your home screen." + camera Field + Action-quiet "Later".
- **Exit:** the captured portrait scales from preview to full-bleed and the Glance assembles over it (the first signature moment - hanging a picture); truth line "Welcome to the studio."
- **Skip path:** typographic portrait + capsule "Add the <model>'s portrait" until done.
- **States:** existing-user first V3 open skips to the Glance (photo capture offered if missing). Requires connectivity (creates objects others react to).

---

# PART D - BOTTOM SHEETS (one system)

There is exactly **one overlay primitive** - no modals, no drawers. Destructive confirmation is a *state inside* the invoking sheet. Sheets are addressable via `?sheet=` so each is deep-linkable and back-correct.

## D1 · Shared sheet behavior
- **Collapsed:** not used as a resting state on compact - sheets are either open or dismissed. (The Stay is the only surface with a collapsed resting state, and it collapses to the glass act-bar, not a sheet.)
- **Expanded:** slides up from the bottom, `move`, studio ease + spring on release; backdrop scrim fades to 40% in parallel; content max-height 88vh, scrolls internally.
- **Snap points:** compact = a single expanded snap (content-height, capped 88vh). No half-snaps (avoids the "tray" feeling). The Desk may grow to the 88vh cap and scroll.
- **Drag behavior:** the grab-handle and the sheet body follow the finger 1:1; release past 30% of height or with downward velocity dismisses (spring); otherwise it settles back.
- **Dismiss:** drag-down, backdrop tap, Esc/back. Dismiss is never a warning; unsaved trivial edits (You) save on dismiss.
- **Keyboard:** the sheet lifts to keep the focused Field and the primary Action visible above the keyboard; the composer docks to the keyboard top.
- **Wide+:** the sheet becomes a centered 560 panel with the same scrim and internal states.

## D2 · Sheet inventory
| Sheet | Purpose | Snap / notes |
|---|---|---|
| `you` | Identity, preferences, install, sign out, delete | content-height; delete = internal confirm state |
| `arrange` | Agree a visit (C3) | content-height; primary docks above keyboard |
| `visit-adjust` | Reschedule / cancel | content-height; cancel = internal confirm state (plain "Cancel Wednesday's visit" / "Keep it") |
| `join-club` | Join / rejoin | content-height; swipeable tier cards; pay-choice |
| `car-form` | Add / edit vehicle (+ portrait) | content-height; retire = internal confirm |
| `moment-add` | Customer adds a memory | content-height; photo + one line; queues offline |
| `pay` | Record payment intent | content-height; amount centered; "at studio" default |
| `desk` | The Conversation (C2) | expands to 88vh cap; internal scroll; search + thread + composer |

## D3 · Arrange sheet - worked example
- **Collapsed:** n/a (task sheet). **Expanded:** content-height, grows as steps reveal.
- **Snap:** single; if content exceeds 88vh (long service list), the body scrolls, the confirm Action stays pinned to the bottom inset.
- **Drag/Dismiss:** drag-down or backdrop dismisses with no warning (nothing committed until Confirm).
- **Keyboard:** none required (all chip selection) - no keyboard case unless a future note field is added.

---

# PART E - TRANSITIONS

| # | Source → Destination | Animation | Duration | Curve | Reduced-motion |
|---|---|---|---|---|---|
| 1 | Auth → Glance (returning) | cached Glance renders instantly; portrait *Image-load* | move | studio ease | image appears, no fade |
| 2 | Onboarding photo → Glance | portrait scales preview→full-bleed, Glance assembles over it, truth fades in | scene | studio ease | crossfade to assembled Glance |
| 3 | Glance ↔ Glance (car swipe) | horizontal paged scroll, 24pt peek during drag, snap | ~move | velocity-aware | instant snap, no peek animation |
| 4 | Layer enters viewport | *Rise* (opacity + 8pt up), once | move | studio ease | opacity only, no translate |
| 5 | TruthLine / Capsule text change | *Crossfade* | move | studio ease | crossfade (unchanged) |
| 6 | Any tappable press | *Press* scale 0.98 | tick | studio ease | none (instant) |
| 7 | Card hover (pointer) | translateY −1 + hold shadow | move | studio ease | none |
| 8 | Open any sheet | slide-up + backdrop scrim fade + spring release | move | studio ease + spring | slide replaced by fade; spring kept (input) |
| 9 | Drag-dismiss sheet | 1:1 finger follow, spring settle/close | live | spring | unchanged (input, not animation) |
| 10 | Glance → the Stay (visit goes live) | *Takeover breath*: portrait 1.00→1.04 + stage fade-up | scene | studio ease | crossfade to the Stay |
| 11 | Stay collapse/expand | portrait re-emerges under drag / breath reverses | scene | studio ease | crossfade |
| 12 | Stay act change | title crossfade + one assent check draws | move / tick | studio ease | crossfade, check appears instantly |
| 13 | Stay archive → Chapter | *Visit→Memory dissolve*: reveal hero travels into timeline | scene | studio ease | crossfade; hero appears in place |
| 14 | Open image viewer (stage) | photo scales from its band into full-screen | move | studio ease | crossfade |
| 15 | MemberCard activation | card scene-arrives into Relationship layer | scene | studio ease | appears in place |
| 16 | Assent check (confirm/success) | stroke draws | tick | studio ease | appears complete |

---

# PART F - STATES CATALOG

| State | Where | Presentation |
|---|---|---|
| **Empty - silence** | Now, Protection, Club-extras when nothing is true | render nothing; the scroll simply shortens |
| **Empty - invitation** | Story, Club (non-member), no-photo portrait | one EmptyState sentence + one quiet action |
| **No vehicle** | Glance root | the add-a-car invitation *is* the whole screen ("The garage is open.") |
| **No protection** | Glance | Protection layer absent |
| **No membership** | Glance | Club shows the non-member invitation only after the 2nd visit; else absent |
| **First use** | first authenticated open | onboarding (C10); thread pre-seeded with the studio welcome |
| **Returning** | daily | opens on yesterday's cached truth, silently corrects; no spinner |
| **Loading** | cold start | paper + AUTOMODZ wordmark (no spinner); images blur-up; the only spinner is inside a pressed Action |
| **Offline** | any | cached objects + one Whisper ("Offline - last updated 7:40 pm"); queueable writes queue; non-queueable single-actions disable with the whisper |
| **Error** | any | three renderings only - the whisper (connectivity), a concierge line inside the acting sheet (submit failure), the thread (needs a human). Crash → `/error` in the concierge voice, one action "Back to the car." No error cards, no toasts. |
| **Expired** | protection / membership | rendered with dignity (typographic / greyed card, dates kept), never red, never punitive |
| **Active** | protection / membership / visit | confidence wording; assent ink for "covered/active" |
| **Completed** | visit | becomes a Chapter; the deposit into the twin is made visible |

---

# PART G - RESPONSIVE MATRIX

| Surface | compact (<720) | regular (720–1199) | wide (≥1200) |
|---|---|---|---|
| Glance | single column, full-bleed photo, inset 24 | text column 640 centered, photo full-bleed | letterbox to 720 centered on paper |
| Portrait | 92vh (88vh if height ≤ 667) | 92vh | 92vh, centered column |
| Layers | inset 24, movement 96 (→ 72 if height ≤ 700) | same, centered column | centered column |
| Sheets | bottom sheet | bottom sheet | centered 560 panel |
| Desk | bottom sheet, single column | bottom sheet | two-pane (thread 400 + focus) |
| Capsule | max-width 100%−48 | same | capped 560 centered |
| The Stay | full-bleed | full-bleed | full-bleed, lower-third text |
| Type scale | as A3 | unchanged (bigger canvas = more photo, not bigger type) | unchanged |

Landscape (phone): Glance letterboxes the portrait to the left 50%, layers scroll right; sheets become right-side panels ≥ 720 width; the Stay stays full-bleed with lower-third text. Split screen at < 720 width uses compact rules regardless of device.

---

# PART H - DARK MODE

- Only chrome inverts (paper/gallery/linen/ink scale + glass). Photography, stage, scrims, assent, caution are identical in both renderings.
- The capsule glass reads as dark glass on dark (theme-aware), never a light pill.
- The Stay and image viewer are always dark (stage) in both renderings - photography contexts don't invert.
- Admin and `/store` are always-dark ops surfaces and are outside this spec; the boundary is absolute.
- Contrast is re-verified per rendering; over-on-photo is guaranteed by scrim minimums, which are rendering-independent.

---

# PART I - ACCESSIBILITY

- **Targets:** ≥ 44 (capsule 52). Every gesture has a visible-control equivalent (car-swipe ↔ page dots + deep-link; Stay-collapse ↔ chevron).
- **Focus:** 2pt ink-3 ring, 2pt offset, 4pt corner; logical order portrait → capsule → layers; sheets trap focus, restore to invoker on close; Esc/back dismisses.
- **VoiceOver:** portrait = one element (name + truth); layers are headings; the Stay announces act changes via a live region; every photo carries a job-specific alt ("arrival photo - the C 43 at the studio, 9:58"); decorative scrims hidden.
- **Dynamic Type:** the scale maps to platform text styles; layouts reflow (truth may wrap to 2); photography never shrinks to make room - text takes new lines.
- **Reduced motion:** the whole customer tree honours the OS setting (transforms/reveals off, opacity kept; signature scenes → crossfade; press instant; images no fade; drag physics retained). Nothing is information-bearing through motion alone.
- **Keyboard (wide/desktop):** full traversal; no palette (search is Tab-reachable in the Desk); sheets are focus-scoped.
- **One-handed:** all actionable elements in the bottom 60% on compact; the top is photography + reading (back/close/share float in established bottom/edge corners on push pages).
- **Contrast law:** ink-3 used ≥ 12pt only; assent/caution are ink-dark by design; semantic colour never the sole signal (always paired with wording).

---

# APPENDIX - SCREEN ↔ ROUTE ↔ STATE INDEX

| Screen | Route / trigger | Owning phase |
|---|---|---|
| The Glance (Home + Vehicle) | `/app` | shipped |
| The Conversation | `?sheet=desk` / `/app/desk` | shipped |
| Arrange (Booking) | `?sheet=arrange` | shipped |
| You (Profile + Settings) | `?sheet=you` | shipped |
| Add/Edit car | `?sheet=car-form` | onboarding (P7 for full portrait capture) |
| The Stay (live visit) | `/app/visit/[id]` (auto) | P3 |
| The Chapter (care record) | `/app/chapter/[id]`, `/chapter/[id]` | P4 (absorbs `/invoice`) |
| Protection detail | Glance layer · `focus=protection` | P5 |
| The Club (Join) | `?sheet=join-club` · `focus=club` | P6 |
| Onboarding | `/app/welcome` | P7 |
| Notifications | no screen (capsule + thread) | ongoing |

*End of specification. Design only - no implementation performed. Awaiting review.*
