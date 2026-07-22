# AUTOMODZ - FIGMA MASTER SPECIFICATION
### P2.D3 · The complete production design source · design only, no code

**Sources of truth (reused verbatim, never contradicted):**
`P2D1-CUSTOMER-APP-DESIGN-SPEC.md` (customer, Studio White / light) and `P2D2-ADMIN-DESIGN-SPEC.md` (staff, dark ops). This document is the **Figma-production layer** on top of them: it adds frames, auto-layout, constraints, variants, component properties, naming, and the master matrices so a designer can rebuild both apps without questions. Where a value already exists in P2D1/P2D2, it is referenced, not re-invented.

**Two design systems, one file, absolute boundary:** *Studio* (customer, light, paper) and *Ops* (staff, dark, void). No token, component, or screen crosses the boundary. Prefixes keep them apart everywhere (`st/…` vs `ops/…`).

---

# 0 · FIGMA FILE ARCHITECTURE

## 0.1 File & page structure
```
AutoModz ▸ (one Figma file)
├── 00 · Cover
├── 01 · Foundations - Studio   (tokens, type, grid, elevation, motion - light)
├── 02 · Foundations - Ops      (tokens, type, grid, elevation, motion - dark)
├── 03 · Components - Studio     (customer component library + variants)
├── 04 · Components - Ops        (staff component library + variants)
├── 05 · Icons & Media           (icon set, photography frames, illustration policy)
├── 06 · Customer - Screens      (all customer frames, by flow)
├── 07 · Customer - Overlays     (sheets, states, toasts)
├── 08 · Admin - Screens         (all staff frames, by mode)
├── 09 · Admin - Overlays        (drawers, dialogs, palette, kiosk, toasts)
├── 10 · Flows & Prototype       (wired click-through)
└── 11 · Matrices                (screen/nav/component/interaction/motion/a11y/responsive)
```

## 0.2 Frame sizes (device presets)
| Preset | Frame | Use |
|---|---|---|
| Phone-SE | 320 × 568 | smallest supported |
| Phone | 375 × 812 | **primary mobile design frame** |
| Phone-Max | 430 × 932 | large phone |
| Phone-Land | 812 × 375 | landscape |
| Fold-cover | 344 × 882 | foldable closed |
| Fold-open | 768 × 882 | foldable open (≈ tablet) |
| Tablet | 768 × 1024 | customer regular / staff floor |
| Tablet-Land | 1024 × 768 | staff floor landscape (primary ops touch) |
| Desktop | 1440 × 900 | **primary desktop design frame (admin)** |
| Ultra | 1920 × 1080 | ultra-wide cockpit |

Design the **Phone 375** frame first for customer; **Desktop 1440** first for admin; derive the rest.

## 0.3 Naming conventions (strict)
- **Tokens:** `st/color/paper`, `st/space/inset`, `ops/color/void`, `ops/status/success` (system-prefixed, category, name).
- **Text styles:** `st/Display-L`, `st/Body`, `ops/H1`, `ops/Data`.
- **Effect styles:** `st/elevation/lift`, `ops/shadow/sm`.
- **Grid styles:** `st/grid/compact`, `ops/grid/desktop`.
- **Components:** `st/Action`, `st/Sheet`, `ops/DataTable`, `ops/BayCard`. Variants use properties, not name suffixes.
- **Component properties:** boolean `Is…` (`isLoading`), variant `Variant`/`State`/`Size`/`Tone`, instance-swap `Icon`, text `Label`.
- **Frames:** `C-<Flow>-<Screen>-<Device>-<State>` e.g. `C-Home-Glance-Phone-Live`; `A-<Mode>-<Screen>-<Device>-<State>` e.g. `A-Studio-Board-Desktop-Default`.
- **Layers:** semantic, not visual - "Truth line", not "Text 3".

## 0.4 Auto-layout conventions (global)
- Every frame and card uses auto-layout. Direction, gap, and padding are given per component/screen below.
- **Padding & gap always come from the space scale** (Studio: 4/8/12/16/24/48/96; Ops: 4/8/12/16/20/24/32/48). No arbitrary values.
- **Resizing:** containers = Fill horizontal, Hug vertical (lists) or Fixed (frames). Text = Fill; icons = Fixed.
- **Constraints:** pin the capsule/action bars to bottom + center; pin top bars to top + L/R stretch; content = L/R stretch, top-anchored.
- **Min width guard:** every screen must hold at 320 with no horizontal overflow (verified layouts, Studio; Ops mobile uses sticky-column tables).

---

# 1 · TOKEN LIBRARY (unified)

Two token sets. Values below are canonical (from P2D1/P2D2). Publish each as Figma variables in two modes only where a system itself has modes.

## 1.1 STUDIO - color / surface (Figma variable collection `st`, modes: Light default, Dark)
| Token | Light | Dark |
|---|---|---|
| st/color/paper | #FBFBF9 | #111214 |
| st/color/gallery | #F1F1EE | #191A1C |
| st/color/linen | #E7E7E3 | #212325 |
| st/color/stage | #0C0D0E | #0C0D0E |
| st/color/ink | #141517 | #F2F2EF |
| st/color/ink-2 | ink @62% | fg @62% |
| st/color/ink-3 | ink @38% | fg @38% |
| st/color/hairline | ink @8% | fg @8% |
| st/color/over | #F7F7F5 | #F7F7F5 |
| st/color/over-2 | over @70% | over @70% |
| st/color/assent | #2E5E48 | #2E5E48 |
| st/color/caution | #8A5A2E | #8A5A2E |

## 1.2 STUDIO - spacing / radius / elevation / opacity / glass / blur / shadow / scrim
- **st/space:** hair 4 · breath 8 · line 12 · gap 16 · inset 24 · rest 48 · movement 96.
- **st/radius:** chip 12 · card 16 · sheet 24 · pill 999.
- **st/elevation (effect styles):** lift `0 12 40 rgba(12,13,14,.10)` · hold `0 2 12 rgba(12,13,14,.08)`.
- **st/opacity:** ink-2 62 · ink-3 38 · hairline 8 · over-2 70 · pending-card 62 · disabled-day 35.
- **st/glass:** fill paper @72% (light) / #18191B @72% (dark) or stage @64% on photo · blur 24 · saturate 140.
- **st/scrim:** scrim `#0C0D0E @40%` · scrim-strong gradient →55% · scrim-soft gradient →24%.

## 1.3 STUDIO - typography (text styles)
| Style | Size/lh | Weight | Face | Tracking |
|---|---|---|---|---|
| st/Display-L | 44/1.05 | 620 | Display | −2% |
| st/Display | 32/1.10 | 620 | Display | −2% |
| st/Title | 24/1.20 | 560 | Display | −1% |
| st/Emphasis | 19/1.45 | 520 | Text | 0 |
| st/Body | 16/1.45 | 400 | Text | 0 |
| st/Data | 14/1.45 | 400 | Mono | 0 |
| st/Caption | 14/1.45 | 400 | Text | 0 |
| st/Whisper | 12/1.45 | 400 | Text | 0 |
Faces: Display = Inter Display (or brand display); Text = Inter; Mono = JetBrains Mono. (Match P2D1 A3.)

## 1.4 STUDIO - motion tokens
- st/ease `cubic-bezier(0.22,1,0.36,1)` · st/dur/tick 120 · st/dur/move 280 · st/dur/scene 480.
- Named: rise · crossfade · press · card-hover · image-load · takeover-breath · visit-dissolve (defs in §6 motion / P2D1 A9).

## 1.5 OPS - color / surface (Figma collection `ops`, single dark mode)
- Surfaces: void #08090B · abyss #0C0D0F · deep #101114 · cavern #17191C · dark #1F2226 · dim #282B30 · surface #33373D · lifted #40454C · peak #4F555D.
- Ink: chrome #F5F6F7 · silver @80 · pewter @55 · steel @35 · smoke @16 · ash @8 · fog @4.
- Status: success #5FBF8F · warning #D9A94A · danger #E06C75 · info #6FA8C9.

## 1.6 OPS - spacing / radius / elevation / typography / motion
- **ops/space:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48.
- **ops/radius:** control 8 · card 12 · drawer 16 · pill 999.
- **ops/shadow (effect styles):** sm `0 2 12 rgba(0,0,0,.6)` · md `0 8 32 rgba(0,0,0,.7)` · lg `0 16 56 rgba(0,0,0,.8)`.
- **ops/type:** Display 28/1.15/700 · H1 22/1.2/700 · H2 18/1.25/600 · Body 14/1.5/400 · Body-strong 14/1.5/600 · Label 12/1.4/600 +6% · Data 13/1.4/400 mono · Micro 11/1.4/500 mono. Faces: Outfit (display), DM Sans (body), DM Mono (data).
- **ops/motion:** ease same curve · micro 120 · element 200 · scene 280.
- **ops/focus:** ring chrome @70%, 2pt, offset 2.

## 1.7 Icons, photography, illustration (shared policy)
- **Icons - Studio:** 16-glyph set (P2D1 A10), 20pt frame, 1.5pt stroke, round cap, `ink-2`/`over-2`, never filled/colored. Figma component set `st/icon/*` with a `Name` variant + `Tone` variant.
- **Icons - Ops:** Lucide, 18–20pt, 1.75pt stroke, steel/pewter/chrome, `ops/icon/*` with `Name`, `Size (18|20)`, `Tone`.
- **Photography - Studio:** the product's surface. Ratios: portrait 4:5, arrival 3:2, inspection 4:3, craft 4:3–1:1, reveal 3:2, detail 21:9, memory ≤4:3. No filters; scrim only; text only in bottom-30% scrim / top-15% clear. Degradation = typographic on stage (never placeholder boxes/stock). Figma: image-fill frames named `st/photo/<class>` with the scrim overlay component.
- **Photography - Ops:** documentary work photos (Gallery/job); no treatment; broken-load = retry tile.
- **Illustration:** **none.** Neither system uses illustration or decorative imagery - empty states are typographic (Studio) or plain (Ops). Do not create an illustration library.

---

# 2 · COMPONENT INVENTORY

Each entry: **variants · states · properties · auto-layout (dir/gap/pad) · sizing/constraints · a11y · motion.** Values from P2D1 B / P2D2 B.

## 2.1 STUDIO components (customer)

**st/text (Display-L, Display, Title, Emphasis, Body, Data, Whisper)** - text styles, not components; `Tone` variable binding (ink/ink-2/ink-3/over/over-2/assent/caution).

**st/Action** - the one button.
- Properties: `Variant {primary|quiet|destructive|on-photo}`, `State {default|pressed|loading|disabled|success}`, `Label` (text), `Icon?` (rarely).
- Auto-layout: horizontal, gap 8, pad primary 14×24 / quiet 10×0; min-height 44. Primary = Fill width (in sheets); quiet = Hug.
- Fills: primary ink bg + over text, radius chip 12; quiet ink text, no bg; destructive caution text; on-photo over text.
- States: pressed scale 0.98; loading → st/Spinner replaces label; disabled → ink-3 + Whisper reason below; success → assent check.
- a11y: role button, 44 target, disabled reason announced. Motion: press (tick).

**st/TruthLine** - one live sentence.
- Properties: `Text`, `OnPhoto (bool)`. Auto-layout: min-height 28, single line. Style Emphasis-19; over-2 on photo / ink-2 in layer. Motion: crossfade on `Text` change. a11y: aria-live polite.

**st/Capsule** - concierge pill.
- Properties: `State {resting|proposal|requested|confirmed|live|ready}`, `Label`, `ActionWord?`, `OnPhoto(bool)`.
- Box: height 52, radius pill, pad 0×22, max-w min(560,100%−48), min-w 180; glass fill (st/glass); constraint bottom+center at safe-bottom+16.
- States: resting = AUTOMODZ wordmark (Display 13 +8% ink-2); others Body 16 + optional Emphasis action word.
- a11y: primary landmark; announces state; 52 target. Motion: text crossfade; press; long-press → Desk.

**st/Portrait** - vehicle hero.
- Properties: `Mode {photo|typographic}`, `Loading(bool)`, `MultiCar(bool)`, `Name`, `Plate?`, `Truth`.
- Box: Fixed, min-h 92vh (88vh ≤667h); image Fill cover; scrim-soft top 64, scrim-strong bottom 30%; text block pad L/R 24, bottom safe+128; name Display-L over; TruthLine slot; overlay slots: avatar (top-right, 36 pill linen, safe-top+16 / right 24), dots (bottom 96, 4pt pills, ≥2 cars).
- Motion: image-load fade; source of takeover-breath. a11y: one VO element (name+truth); job-specific alt.

**st/Layer** - Glance section wrapper.
- Properties: `Title?`, `Action?`, `HasContent(bool)`.
- Auto-layout: vertical, top margin movement 96, pad L/R inset 24; header row (Title 24 + trailing Action, baseline) with inset 24 below. Renders nothing when `HasContent=false`. Motion: rise once on scroll-in.

**st/PhotoBand** - photography row.
- Properties: `Ratio {band 21:9|memory ≤4:3|hero 3:2}`, `HasPhoto(bool)`, `OverTitle?`, `OverCaption?`, `Caption?`, `Whisper?`, `Tappable(bool)`.
- Box: radius sheet 24, clip; ground stage(photo)/linen(none); over-title in bottom scrim pad 48/24/16 (Emphasis over + Caption over-2 14). Below: Body caption / Whisper. Motion: image-load; press if tappable. Degradation: typographic on linen.

**st/MomentEntry** - timeline atom.
- Properties: `Type {photo|milestone|photoless}`, `Caption`, `Whisper?`, `Date?`, `Tappable(bool)`.
- photo → PhotoBand(memory); milestone → Emphasis + Data date (no card); photoless → Body + Whisper. Rhythm rest 48 (parent gap). press if tappable.

**st/MomentStage** - the Stay renderer.
- Properties: `Act {received|looked_over|in_care|final_checks|ready}`, `Narration`, `Timing?`, `Collapsed(bool)`, `EvidencePhoto?`.
- Box: stage ground; top 60% evidence (or dimmed portrait); act title Display 32 over; narration Emphasis over-2; act row (5 word-dots: done over+assent check, current over, future over-2); timing Whisper. Collapsed = glass bar above capsule. Motion: takeover-breath present; act crossfade + check draw; visit-dissolve on archive.

**st/MemberCard** - the one literal card.
- Properties: `State {active|pending|lapsed}`, `Name`, `Tier`, `Since`.
- Box: radius card 16, hairline border, hold shadow, clip; 3pt top bar (assent / hairline lapsed); inner pad 24; name Emphasis, "tier · since" Data 14 ink-2; pending line Whisper (here only). Opacity pending 62. Motion: scene-arrival once.

**st/Sheet** - the one overlay.
- Properties: `Content(slot)`, `HasKeyboard(bool)`, `HasConfirmState(bool)`.
- Box: gallery ground, top radius sheet 24, lift shadow, grab-handle 40×4 hairline (12 above), inner pad 24 / (24+safe-bottom), max-h 88vh, backdrop scrim 40%. Auto-layout vertical, gap 24. Behavior per §7. Wide → centered 560 panel.

**st/Field** - the one input.
- Properties: `Kind {text|phone|data|slot|tier|switch|photo}`, `Label`, `Value`, `Placeholder?`, `State {rest|focus|error}`, `Error?`.
- Box: label Caption 14 ink-2 (4 below) → input value 19 (text 520 / mono 400), hairline underline, pad 6×0, radius 0; focus underline→ink + focus ring; error → Caption ink-2 line. Composed variants: slot (day/time chips radius chip 12, selected linen), tier (member-card-shaped), switch (label + 44×24 toggle, assent), photo (camera on gallery well).

**st/EmptyState** - invitation.
- Properties: `Line`, `ActionLabel?`. Body 19 ink-2 + optional Action-quiet (line 12 below). (Silence = no instance.)

**st/Spinner** - the only spinner. 14pt ring, 1.5pt currentColor, ~0.7s; inside a pressed Action only; static reduced-motion.

**st/Skeleton** - image-load placeholder. Gallery block, radius card (override), opacity breathe 1→.55→1 2.4s; images only; static reduced-motion.

**Interaction utilities (Figma: component states / interactive components):** press (scale .98), card-hover (translateY −1 + hold, pointer), image-load (opacity 0→1), focus-visible (2pt ink-3 ring, offset 2).

## 2.2 OPS components (staff) - from P2D2 F
**ops/AppShell** (sidebar mode-grouped/role-filtered/collapsible + top bar + content + drawer host) · **ops/CommandPalette** (⌘K) · **ops/DataTable** (sticky header, sortable, density {comfortable 44|compact 36}, row-tap, overflow ⋯, bulk-bar, sticky identity col mobile) · **ops/FilterBar** (segmented chips + range + search + removable pills) · **ops/StatusToken** (`Form {dot|rule|pill}`, `Status {…}` per B17) · **ops/Drawer** (`Side {right 480|workspace 640|bottomsheet}`, header+body+sticky action bar) · **ops/ConfirmDialog** (`Tone {default|destructive}`) · **ops/Field/Form** (inline-editable cells, ₹-mono) · **ops/KpiTile** (mono number + delta + sparkline?) · **ops/Chart** (`Type {line|bar|stacked|sparkline}`, tooltip, table fallback) · **ops/BayCard** · **ops/QueueCard** · **ops/TechChip** + **ops/TechnicianDrawer** · **ops/FeedRow** (live) · **ops/OpsTimeline** (2 lanes) · **ops/StatusStepper** (job lifecycle) · **ops/PhotoGrid + Camera + Lightbox** · **ops/AssignmentControl** · **ops/PaymentControl** · **ops/Toast/InlineAlert/Banner** · **ops/KioskLock + ActorChip** · **ops/AuditRow**.
Each: variants/states/properties/auto-layout as its P2D2 F entry; naming `ops/<Name>`; every icon-only control has an aria-label property; density and status are variant props, not duplicated components.

---

# 3 · CUSTOMER SCREENS (system `st`, primary frame Phone 375)

Per screen: **Purpose · Hierarchy (top↓bottom) · Spacing · Type · Visual-hierarchy why · Motion · Interaction · A11y · States · Responsive · Figma notes.** Composed from §2.1 components; only screen-level layout values are given (component internals live in §2). Colors/tokens per §1.

## C-01 · Login - `/auth/login`
- **Purpose:** the calm threshold - one tap into the customer's car.
- **Hierarchy:** [top safe 24] AUTOMODZ wordmark (Display 32 ink) → rest 48 → "Your car's home." (Body 19 ink-2) → movement → **Continue with Google** (Action-primary, Fill width) → gap → "The studio will know you by this account." (Whisper ink-3) → [bottom safe].
- **Spacing:** frame pad L/R inset 24; column centered vertically, gap as listed; max content-w 360, centered.
- **Type:** wordmark Display 32; sub Body 19; caption Whisper 12.
- **Why:** wordmark first (identity), the single action second (only choice), the reassurance last. No pitch, no photo (first photo the user sees is *their* car).
- **Motion:** entry = rise (once). Press on button; loading = Spinner in button. Reduced-motion: no rise.
- **Interaction:** tap/Enter → auth; failure → concierge line under button ("That didn't work - try once more."); offline → button disabled + Whisper.
- **A11y:** button 44+, focus ring; single H1 = wordmark; contrast AA.
- **States:** default · pressing(loading) · error(line) · offline(disabled).
- **Responsive:** identical all sizes (centered 360 column); desktop centers on paper.
- **Figma:** `C-Auth-Login-Phone-{Default|Loading|Error|Offline}`; auto-layout vertical center, gap tokens; constraints center.

## C-02 · OTP (phone verify - inside onboarding/You)
- **Purpose:** confirm a phone number with a 6-digit code, calmly.
- **Hierarchy:** Title 24 "Verify your number" → Body 16 ink-2 "Code sent to +91 …" → OTP field (6 mono cells, st/Field data-composed, gap 8, each 44×52, underline) → Action-quiet "Resend" (with cooldown Whisper) → primary "Confirm".
- **Spacing:** sheet pad inset 24, gap 24; cells gap breath 8.
- **Type:** cells Data 24; title Title 24.
- **Why:** the code cells dominate (the task); resend/confirm secondary.
- **Motion:** cell fill = crossfade per digit; error = the row's underlines go caution (no shake). Reduced-motion unaffected.
- **Interaction:** auto-advance, paste fills all, auto-submit on 6th; wrong code → caution underline + line "That code didn't match."; resend disabled during cooldown.
- **A11y:** one labelled input group; each cell announced position; keyboard fully operable.
- **States:** empty · typing · verifying · error · success(assent) → dismiss.
- **Responsive:** sheet on phone; centered panel on desktop. **Figma:** `C-Auth-OTP-*`.

## C-03 · Vehicle onboarding - `/app/welcome` (4 moments)
- **Purpose:** produce a photographed car so the home can exist.
- **Hierarchy per moment** (full-screen, forward-only, no step dots):
  - **W1 Welcome** - paper; Display 32 "Welcome to AutoModz." → line 12 → Body 16 (3-line paragraph) → rest → Action-primary "Begin".
  - **W2 You** - Title 24 "You" → st/Field Name → st/Field Phone → Action-primary "That's me" (phone edit → C-02 OTP inline).
  - **W3 The car** - Title 24 "The car" → 4× st/Field (Make/Model/Year/Plate, data) → Action-primary "Next".
  - **W4 Portrait** - stage; Display 24 over "Now, the portrait." → Body 16 over-2 instruction → st/Field photo (camera) → Action-quiet over "Later".
- **Spacing:** pad inset 24; field gap gap 16; section gap rest 48.
- **Why:** one decision per screen; the car's portrait is the climax.
- **Motion:** between moments = crossfade + 8pt (move); **exit = takeover-breath into the assembled Glance** (scene) - the signature "hanging a picture." Reduced-motion: crossfade only.
- **Interaction:** forward-only (no back within flow beyond field edits); skip photo → typographic portrait + capsule "Add the <model>'s portrait".
- **A11y:** each moment a labelled step; camera control labelled; OTP as C-02.
- **States:** per moment default/typing/error; capture preview (Use this / Again).
- **Responsive:** full-screen all sizes; camera uses native. **Figma:** `C-Onboard-W{1..4}-Phone-*`.

## C-04 · Empty garage (no vehicle) - `/app` fallback
- **Purpose:** invite the first car; the invitation *is* the whole screen.
- **Hierarchy:** stage ground, centered: Display 24 over "Welcome to AutoModz." → Body 16 over-2 "Your car will live here. Add it to begin." → Action-on-photo "Add a car". Avatar top-right.
- **Spacing:** centered, gap line 12, pad inset 24.
- **Why:** single call - nothing else exists yet. **Motion:** rise once. **Interaction:** tap → car-form sheet. **A11y:** one action, focus ring. **States:** the only state. **Responsive:** centered all sizes. **Figma:** `C-Home-EmptyGarage-*`.

## C-05 · Home / Vehicle (the Glance) - `/app`  ★ the core screen
- **Purpose:** answer "what's happening with my car?" in 5 seconds.
- **Hierarchy (single vertical scroll):**
  1. **st/Portrait** (~92vh): avatar (top-right), car name Display-L over (bottom-left), TruthLine, page-dots (≥2 cars).
  2. **Now** (st/Layer, no header): agreed/proposed visit *or* the suggestion *or* nothing (silence). Whisper label → Title date·time → Body service·₹ → (proposed) Whisper "The studio is confirming your visit." → Action-quiet. Proposal variant: Whisper "A suggestion from the studio" → Emphasis reason → Action-quiet "Arrange it".
  3. **Protection** (Layer "Protection"): st/PhotoBand band per protection - healthy "Protected until <MMM YYYY>", waning "Renewal window open - <n> days left"; expired → typographic gallery block + "Renew".
  4. **The story** (Layer "The story"): 3 recent st/MomentEntry (rest 48 apart) + Action-quiet "Show earlier visits (<n>)"; empty → st/EmptyState + "Arrange one".
  5. **Papers** (Layer "Papers"): plate Data → care-record rows → Action-quiet "Edit details".
  6. **The Club** (Layer "The Club"): st/MemberCard + context line / non-member EmptyState / referral line + "Share".
  7. **Signature:** AUTOMODZ Whisper + address Data ink-3 + Action-quiet "Message the studio". Bottom pad safe+movement.
  - Fixed: **st/Capsule** (bottom).
- **Spacing:** layers movement 96 apart; header→content inset 24; text blocks line 12; groups rest 48; page inset 24.
- **Type:** name Display-L; layer titles Title 24; truth Emphasis 19; captions Body/Whisper; plate/amounts Data.
- **Why:** the **car photo** first (identity + emotion), the **truth line** second (state), the **capsule** third (next action), layers on demand below. Emotional order My car → Care → Protection → Memories → Relationship is law.
- **Motion:** portrait image-load; layers rise once; truth/capsule crossfade; car-swipe paged snap (24pt peek during drag). Live visit → takeover-breath into the Stay. Reduced-motion: no rise/peek, opacity only.
- **Interaction:** swipe = cars (last page = add-a-car); scroll = depth; avatar → You; capsule tap → Desk (or Stay when live); capsule long-press → Desk shelf; every tappable = press; cards = card-hover on pointer.
- **A11y:** portrait one VO element; layers headings; controls in bottom 60% (avatar the only top control); Dynamic Type reflows (truth →2 lines); job-specific alts.
- **States:** empty(silence) · proposal · requested · confirmed · live · loading(cached) · offline(whisper) · single/multi car.
- **Responsive:** compact single column; regular text column 640 centered + full-bleed photo; wide letterbox to 720; landscape = portrait left 50% + layers right; fold-open = tablet rules.
- **Figma:** `C-Home-Glance-{Phone|Tablet|Desktop|Land}-{Default|Live|Proposal|Requested|EmptyStory|Offline}`; auto-layout vertical, gap movement; portrait Fixed 92vh; capsule pinned bottom-center.

## C-06 · Vehicle swipe (multi-car) - a state of C-05
- **Purpose:** move between owned cars like held assets.
- **Hierarchy:** horizontal pager of Portraits; last page = add-a-car (stage, "Another car? / The garage has room.", Action-on-photo). Page-dots bottom 96.
- **Motion:** paged scroll-snap, 24pt trailing peek *during drag only*; layers below reset to the fronted car; "Show earlier visits" resets per car. Reduced-motion: instant snap.
- **Interaction:** swipe L/R; dots indicate; deep-link `?car=<id>` positions. **A11y:** each page labelled "your <car>"; dots decorative (aria-hidden) with a labelled position elsewhere. **Figma:** `C-Home-Glance-Phone-MultiCar` + `…-AddCar`.

## C-07 · Story (memories) - Glance layer + full list
- **Purpose:** the car's photographic history.
- **Hierarchy:** Layer "The story" → 3 recent MomentEntry (photo + "service · date" + "<n> photos · <craftsman>") → "Show earlier visits (<n>)" reveals all → each entry taps to its Chapter. Empty → EmptyState "The <car>'s story starts with its first visit." + "Arrange one".
- **Spacing:** entries rest 48; caption line 12. **Type:** caption Body 16; whisper Whisper 12. **Motion:** entries rise; reveal expands in place. **Interaction:** tap → Chapter; press feedback. **A11y:** ordered list. **States:** empty · summarized · expanded. **Figma:** part of `C-Home-Glance-*` + `C-Story-Expanded-*`.

## C-08 · Protection - Glance layer (+ Desk focus)
- **Purpose:** show what shields the car, confidently.
- **Hierarchy:** Layer "Protection" → PhotoBand band per protection (over-title name, over-caption state). Confidence copy (until-date) except waning/expiring (actionable countdown); expired → typographic gallery block + "Renew".
- **Spacing:** bands gap inset 24. **Motion:** image-load. **Interaction:** Renew → arrange sheet (prefilled). **A11y:** state paired with words + dates. **States:** healthy · waning · expiring · expired · none(absent). **Figma:** `C-Protection-{Healthy|Waning|Expired}-*`.

## C-09 · Papers - Glance layer
- **Purpose:** the documents/identity vault.
- **Hierarchy:** Layer "Papers" → plate Data ink-2 → "Care record - <date>" rows (press → record/chapter) → Action-quiet "Edit details" (→ car-form).
- **Spacing:** records gap line 12, group gap inset 24. **A11y:** rows labelled documents. **States:** with/without records. **Figma:** `C-Papers-*`.

## C-10 · Membership (Club) - Glance layer + Join sheet
- **Purpose:** membership as an object you hold.
- **Hierarchy (layer):** MemberCard → context line ("<n> washes left · renews <date>") / pending(card line only) / lapsed("Rejoin any time…" + Rejoin) / non-member EmptyState "You wash often. The Club would suit the <car>." + "Have a look" → referral "A friend's first detail is on us." + "Share".
- **Join sheet:** tier cards (member-card-shaped, swipeable, honest arithmetic) → pay choice (at studio / UPI reference) → pending honest line → card scene-arrives on activation.
- **Motion:** card scene-arrival; sheet slide-up. **Interaction:** join/renew/share. **A11y:** card region; tier chips radio-like. **States:** none · non-member · pending · active · grace · lapsed. **Figma:** `C-Club-{Member|NonMember|Pending|Lapsed}-*`, `C-Sheet-JoinClub-*`.

## C-11 · Booking (Arrange sheet) - `?sheet=arrange`
- **Purpose:** agree a visit in <20s.
- **Hierarchy (sheet, gap 24):** Title "Arrange a visit" → Body ink-2 "For the <car>." → **Service** list (rows: Emphasis name + Data "from ₹X", press) → on select collapses to a gallery summary + "change" → **Day** chips (horizontal, radius chip 12, selected linen, full=35% disabled) → **Time** chips (wrap) → Action-primary "Confirm <Day> <time>" (or "· covered by the Club") pinned bottom.
- **Spacing:** sheet pad inset 24; chip gap breath 8; step gap gap 16.
- **Why:** service list first (the decision), day, time, then the single commit; the primary only appears when day+time chosen.
- **Motion:** steps reveal (move); confirm success (assent). Reduced-motion: instant. **Interaction:** all chip selection (no keyboard needed); membership auto-covers a wash; error → sheet reopens with values + concierge line. **A11y:** labelled step groups; chips radio-like; primary above keyboard. **States:** step1..3 · covered · error · done. **Figma:** `C-Sheet-Arrange-{Service|Day|Time|Ready|Covered}-*`.

## C-12 · Live stay - `/app/visit/[id]` (auto-presents)  ★ hero moment
- **Purpose:** turn waiting into hospitality; where is my car, is it okay.
- **Hierarchy (full-bleed stage):** top 60% evidence photo (or dimmed portrait) → act title Display 32 over → narration Emphasis over-2 → 5-act row (word-dots + assent checks) → timing Whisper. Back/collapse chevron bottom-left (over-2, 44). Mid-visit scope-add = inline thread card above the act row (photos + "Go ahead"/"Leave it").
- **Acts:** Received → Looked over → In care → Final checks → Ready (customer translation of ops states).
- **Reveal (act 5):** finished portrait alone ~1.2s → "Ready." Display 32 → before/after slider → craftsman line Emphasis → amount Data → Action-on-photo "Collect any time before 7." No rating/upsell beside the car.
- **Spacing:** lower-40% content pad inset 24, gap line 12. **Type:** act Display 32; narration Emphasis 19; timing Whisper.
- **Why:** the act + its photo dominate (what's happening now); progress + timing support; collection last.
- **Motion:** takeover-breath present; act change = title crossfade + one check draw; collapse = portrait re-emerges under drag → glass act-bar; archive = visit-dissolve into Chapter. Reduced-motion: crossfades, checks appear complete.
- **Interaction:** drag-down collapse/expand; scope-add decision; at Ready, collection. **A11y:** act changes live region; collapse has a visible control; alts per act.
- **States:** each act · photo-less degraded · delay(honest line) · offline(cached+whisper) · reveal · collected. Off-app: Live Activity/Lock-screen (act word + check; expanded act+narration+timing+evidence crop; Ready persists).
- **Responsive:** full-bleed all sizes; lower-third text. **Figma:** `C-Stay-{Received|LookedOver|InCare|FinalChecks|Reveal|Collapsed|Degraded}-*`, `C-Stay-LiveActivity-{Compact|Expanded}`.

## C-13 · Chapter (care record) - `/app/chapter/[id]` owner · `/chapter/[id]` public
- **Purpose:** the permanent, shareable document of one visit.
- **Hierarchy:** hero PhotoBand 3:2 + Display 32 "Full detail" + Data "date · AutoModz Studio" (share top-right, back bottom-left) → **the work** (Body list) → **evidence** (act-grouped PhotoBand run → stage lightbox) → **people** ("Cared for by … · checked by …" Body ink-2) → **promise** (gallery block "Protected until <date>" assent + "Warranty filed…" Whisper) → **amount** owner-only (hairline-ruled Data table) → **next** Whisper → **rating** owner ≤24h ("How was it?" + 5 quiet ticks → "Thank you.").
- **Spacing:** sections rest 48; hero full-bleed; amount table row 44. **Type:** title Display 32; work Body; amounts Data.
- **Why:** the finished photo first (the payoff), the work, the proof, the money last (owner), the ask once.
- **Motion:** hero receives visit-dissolve from the Stay; lightbox scales from thumb. Reduced-motion: appears in place. **Interaction:** photo tap → lightbox (swipe, Esc); share (native, amounts hidden in public); rating once. **A11y:** amount = real table; act-labelled alts; public omits money block. **States:** owner · public · migrated(typographic hero) · rated. **Figma:** `C-Chapter-{Owner|Public|Migrated}-*`, `C-Chapter-Lightbox-*`.

## C-14 · Notifications (no screen)
- **Purpose:** the concierge speaking, rarely - no inbox, bell, or badge.
- **Surface:** the Capsule + TruthLine ambient; history in the (WhatsApp-at-launch) thread. **Push variants (design as OS-notification frames):** prep-note · custody(arrived) · inspection · craft(opt-in) · delay · reveal · chapter-filed · follow-up · protection waning/expiring · membership renewing · one delight/week · dormancy(once). Each deep-links to its exact state. **Voice:** one host, car by name, reasons given, no urgency/emoji/ops words. **Figma:** `C-Push-{PrepNote|Arrived|Reveal|…}` OS-style frames; `C-Notif-Prefs` lives in You (C-16).

## C-15 · Profile - the You sheet (`?sheet=you`)
- **Purpose:** identity + escape hatches (no stats, no link farm).
- **Hierarchy (sheet):** Title "You" → Field Name → Field Phone → (see Settings block) → Install → Sign out → "Leave AutoModz".
- **Figma:** merged with C-16 (one sheet). See below.

## C-16 · Settings (inside You sheet)
- **Hierarchy:** after Name/Phone: "Notifications" group of sentence-switches (Body line + 44×24 toggle; always-on classes shown with Whisper "Always - it's your car.") → Action-quiet "Install AutoModz" (when available) → Action-quiet "Sign out" → rest 48 → Action-quiet ink-3 "Leave AutoModz" → in-sheet confirm state (plain paragraph: twins anonymised, records kept + Action-destructive "Delete my account").
- **Spacing:** groups gap 24; switch rows gap gap 16. **Why:** identity first, preferences, then destructive last. **Motion:** switch = press; delete = internal confirm (no second overlay). **Interaction:** implicit save on dismiss; delete confirmed. **A11y:** switches labelled by sentence; focus trapped; Esc saves+closes. **States:** default · install-available · delete-confirm. **Figma:** `C-Sheet-You-{Default|InstallAvailable|DeleteConfirm}-*`.

## C-17 · Install PWA
- **Purpose:** offer home-screen install without nagging.
- **Surface:** a single Action-quiet "Install AutoModz" inside You (appears only when the OS install prompt is available) → tapping triggers the native prompt. **No custom banner, no interstitial.** iOS (no native prompt) → a one-time Whisper hint in You with the share-to-home steps. **Figma:** state of C-16; `C-Install-iOSHint` note frame.

## C-18 · Offline (global state, not a screen)
- **Purpose:** stay useful with no network.
- **Behavior:** every surface renders last-cached objects instantly + one Whisper "Offline - last updated 7:40 pm" (under truth / at surface top). Queueable writes (moments, prefs, thread) queue; non-queueable single actions (arrange, pay) disable with the Whisper. **No dead screen, no error card.** **Motion:** none. **A11y:** the whisper is aria-live polite. **Figma:** overlay note + `C-*-Offline` variants on affected frames.

## C-19 · Errors (global)
- **Purpose:** three renderings only, never an error card.
- **Renderings:** (a) Whisper line = connectivity/staleness; (b) concierge line *inside* the acting sheet = submit failure ("That didn't reach us - try again."); (c) the thread = needs a human. **Crash →** `/error`: paper, Body 19 "Something went wrong on our side." + Action-primary "Back to the car." **Figma:** `C-Error-Crash-*`, plus error variants on sheets.

## C-20 · Empty states (catalog)
- **Silence:** Now/Protection/Club-extras render nothing (scroll shortens). **Invitation:** Story ("… starts with its first visit." + Arrange one), Club non-member, no-photo portrait ("Add a photo of your car - it becomes your home screen."), empty garage (C-04). **No** "nothing here yet" cards, **no** illustrations. **Figma:** `C-Empty-{Story|Club|Portrait|Garage}-*`.

## C-21 · Success states (catalog)
- Pattern: assent check draw (tick) + one sentence + stillness; auto-dismiss where inside a sheet. Instances: arrange confirmed ("Thursday's set. We'll be ready."), join-club ("Welcome to the Club."), moment added, rating ("Thank you."), profile saved (silent). No toasts in the customer app - success lives in the sheet that did the work. **Figma:** `C-Success-{Arrange|Club|Rating}-*` (sheet done-states).

---

# 4 · ADMIN SCREENS (system `ops`, primary frame Desktop 1440)

Per screen: same facets, composed from §2.2. Only screen-level layout given.

## A-01 · Login (staff) - `/auth/login` (staff branch)
- **Purpose:** sign staff in; route by role (admin→Office, employee→Studio).
- **Hierarchy:** centered on void: Wordmark → H2 "Sign in" → Body pewter one line → Action "Continue with Google" (surface bg, control radius) → footer Micro (studio address).
- **Spacing:** centered card max-w 400, pad 24, gap 16. **Type:** H2 18/600; button Body-strong. **Why:** wordmark, single action, minimal. **Motion:** fade-in; button press 120ms. **Interaction:** Google → role redirect; kiosk devices land on `/store` PIN. **A11y:** focus ring; one action. **States:** default · loading · error. **Responsive:** identical; on the floor tablet this rarely shows (kiosk). **Figma:** `A-Auth-Login-Desktop-*`.

## A-02 · Office Dashboard - `/admin/office`
- **Purpose:** business health at a glance.
- **Hierarchy:** top bar (title "Dashboard", search, mode=OFFICE, actor) → **KPI row** (revenue today · jobs done · avg ticket · unpaid - ops/KpiTile) → **alerts** (unverified payments · low stock · open shift - ops/InlineAlert) → **charts** (revenue trend line, jobs-by-service bar) → quick links (Close, Invoices, Reports).
- **Spacing:** page inset 24; KPI row gap 16, tiles Fill (4-up → wrap); section gap 32. **Type:** KPI number Data 28-equiv (big mono), label Label, delta success/danger. **Why:** money today first, attention items second, trends third. **Motion:** KPI crossfade on update; alerts rise; charts draw-in 280 once. **Interaction:** tile → its list; alert → jump. **A11y:** KPIs labelled figures + delta; charts have table fallback. **States:** first-run("Your first day's numbers…") · loading(skeleton tiles) · metric-fail("-"). **Responsive:** tiles 4→2→1; charts stack; ultra = wider tiles + side charts. **Figma:** `A-Office-Dashboard-{Desktop|Tablet|Mobile|Ultra}-{Default|FirstRun|Loading}`.

## A-03 · Studio Board - `/admin`  ★ the ops core
- **Purpose:** run the whole working day on one screen.
- **Hierarchy:** top bar (date/clock · pipeline counts · "New walk-in" · search) → **capacity strip** (utilization bar + next-free per bay) → 3 columns: **Waiting queue** (left) · **Bay cards ×2** (center) · **QC/Ready** (right) → **Technician rail** → **Studio feed** (live) → **OpsTimeline** (2 lanes). Ultra: Feed+Tech rail dock as persistent right column.
- **Spacing:** page inset 24; column gap 16; card gap 12; dense. **Type:** counts Data; card titles Body-strong; feed Micro time + Body. **Why:** capacity (can we take work) → queue (who's next) → bays (now) → QC/ready (finishing) → team → record. **Motion:** feed rise once; status advance = occupant chip crossfade + success tick; realtime updates in-place (never scroll-jump); drawer slide 200. **Interaction:** tap waiting → Job Workspace drawer; inline status advance on bay card; assign from card; `n`/`/`/⌘K. **A11y:** each bay a labelled region (occupant+state+remaining); feed live region; lateness color + "late 12m" word. **States:** clear-day empty · loading(skeleton capacity+bays) · listener-drop(reconnecting banner + last-known). **Responsive:** columns stack (mobile) with sticky capacity; tablet landscape = queue+bays side-by-side (floor device, ≥44 targets, actor chip); ultra = persistent right column. **Figma:** `A-Studio-Board-{Desktop|TabletLand|Mobile|Ultra}-{Default|ClearDay|Loading|Reconnecting}`.

## A-04 · Bay view (bay card detail) - component/section of A-03
- **Purpose:** the full state of one physical bay (resource).
- **Hierarchy (BayCard):** header (bay name + resource icon) → occupant (customer · vehicle · plate) → service + elapsed/remaining (late-colored) → tech chip → inline status-advance + assign.
- **Spacing:** card pad 16, gap 12. **Motion:** occupant crossfade on change. **Interaction:** advance/assign inline; tap → Job Workspace. **A11y:** labelled region; remaining time as text. **States:** empty(bay free, "Next free now") · occupied · overrun(danger). **Figma:** `A-Studio-BayCard-{Empty|Occupied|Overrun}`.

## A-05 · Job Workspace - drawer over board (`/admin/jobs/[id]`)
- **Purpose:** everything about one car-in-care in one scroll.
- **Hierarchy (Drawer 640):** header (customer · vehicle · plate · source · status pill · close) → **StatusStepper** (checked_in→…→delivered; next step = primary) → service items (name · category · price · membership badge) → assignments (lead/assist add/remove) → photos (Camera + grid) → notes (timestamped, per-actor) → payment (amount mono · method · status · Collect) → sticky action bar (advance / collect / deliver).
- **Spacing:** drawer pad 20, section gap 24. **Type:** header H2; amounts Data. **Why:** current status + next action first, then work, evidence, money. **Motion:** slide-in 200; status tick 120; photo fade-in. **Interaction:** 1-tap advance; camera capture (act-tagged); assign searchable; deliver-with-balance → ConfirmDialog (attributed). **A11y:** stepper ordered list w/ current; camera + payment labelled. **States:** each status · no-photos("capture the arrival") · save-fail(inline retry). **Responsive:** drawer→bottom sheet (mobile/portrait), action bar above keyboard. **Figma:** `A-Studio-JobWorkspace-{Desktop|Mobile}-{CheckedIn|InProgress|QC|Ready|DeliverBalance}`.

## A-06 · Customer profile (360) - `/admin/customers/[id]`
- **Purpose:** the single customer view.
- **Hierarchy:** header (name · phone · WhatsApp · tags · lifetime value) → vehicles (→ vehicle profile) → visit history → memberships → invoices/payments → notes(admin) → actions (message, add note, add vehicle, new booking).
- **Spacing:** page inset 24; section gap 24. **Why:** who → owns → done → owes/holds. **Motion:** section expand 200. **Interaction:** each section drills. **A11y:** sections landmarks; notes marked admin-only. **States:** empty · loading(skeleton) · error(retry). **Responsive:** single scroll + collapsible sections (mobile). **Figma:** `A-Office-Customer360-{Desktop|Mobile}-*`.

## A-07 · Vehicle profile & timeline - `/admin/vehicles/[reg]`
- **Purpose:** shop-side twin - identity + care timeline.
- **Hierarchy:** header (make/model/year · plate · owner · derived protection) → timeline (job/visit rows: date · service · tech · photos · amount) → active protections (warranty/expiry) → documents/invoices → actions.
- **Spacing:** inset 24; timeline row gap 12. **Motion:** entries rise. **Interaction:** row → job/chapter; new booking. **A11y:** ordered timeline; protection words+dates. **States:** empty("No visits yet") · loading · error. **Responsive:** compact list + photo strip (mobile). **Figma:** `A-Studio-VehicleProfile-*`.

## A-08 · Calendar / Schedule - `/admin/schedule`
- **Purpose:** place and see work across the 2 bays over time.
- **Hierarchy:** day/week toggle → 2 resource lanes (Wash, Protection) with time axis → booking blocks (customer · service · duration) → capacity/blocked overlays → side "pending/unscheduled" list.
- **Spacing:** grid gutter 12; block pad 8. **Motion:** blocks rise; drag ghost 1:1 + snap. **Interaction:** click slot → new; block → booking drawer; drag reschedule (confirm if confirmed booking). **A11y:** blocks are labelled buttons; keyboard move via dialog. **States:** empty("No bookings this day"+New) · loading(lane skeleton). **Responsive:** week(desktop)→day(tablet)→agenda list(mobile, edit not drag). **Figma:** `A-Studio-Schedule-{Desktop|Tablet|Mobile}-{Week|Day|Agenda|Empty}`.

## A-09 · Bookings list & detail - `/admin/bookings(+/[id])`
- **Purpose:** the full bookings ledger.
- **Hierarchy:** FilterBar (All·Today·Upcoming·Completed·Cancelled · range · search) → DataTable (Customer · Vehicle · Service · Date/Time · Amount · Payment · Status) → row → Booking Detail drawer (breakdown · source · payment · status timeline · actions confirm/reschedule/cancel/check-in/message).
- **Spacing:** table row 44; page inset 24. **Motion:** row hover 120; drawer 200. **Interaction:** sort, filter, bulk, row→drawer. **A11y:** semantic table; status paired with text. **States:** empty("No bookings match"+clear) · loading(skeleton rows) · row-error(retry). **Responsive:** stacked cards + full-sheet detail (mobile), sticky identity col (tablet). **Figma:** `A-Studio-Bookings-{Desktop|Mobile}-*`, `A-Studio-BookingDetail-*`.

## A-10 · Inventory & Products - `/admin/inventory(+/recipes)`
- **Purpose:** stock + consumption + recipe mapping.
- **Hierarchy:** low-stock banner → FilterBar (All·Low·Out·category·search) → DataTable (Product · SKU · Category · On-hand · Unit · Reorder pt · Status · Last movement; low/out left-rule) → inline adjust on-hand. **Recipes:** per service, products × qty (drives auto-deduction).
- **Spacing:** table row 44. **Motion:** stock change crossfade (no count-up). **Interaction:** inline adjust (logged); set reorder; recipe map. **A11y:** status words; adjust announced. **States:** empty("No products yet") · loading · adjust-error(inline). **Responsive:** stacked cards (mobile) status prominent. **Figma:** `A-Warehouse-Inventory-*`, `A-Warehouse-Recipes-*`.

## A-11 · Employees - `/admin/employees(+/[id])`
- **Purpose:** roster, roles, per-person detail.
- **Hierarchy:** DataTable (Name · Role · Phone · Status today · Jobs done · Attendance %) → detail (profile · role · PIN/kiosk access · assignment history · attendance · payroll summary).
- **Spacing:** row 44; detail inset 24. **Motion:** detail drawer 200. **Interaction:** add/edit; grant kiosk PIN. **A11y:** role/status labelled; PIN never shown. **States:** empty("Add your first") · loading. **Responsive:** cards (mobile). **Figma:** `A-Team-Employees-*`, `A-Team-EmployeeDetail-*`.

## A-12 · Attendance - `/admin/attendance`
- **Purpose:** today's shifts + history.
- **Hierarchy:** Today (per employee: status · clock-in · break · hours + clock/break actions) → History tab (date-range table). Leave/off shown inline.
- **Spacing:** touch-first rows (floor tablet, ≥44). **Motion:** clock → status crossfade + tick. **Interaction:** clock/break (kiosk self-actions attributed). **A11y:** clock buttons labelled; times mono. **States:** empty("No one clocked in yet") · loading. **Responsive:** big clock buttons (tablet); history table→cards (mobile). **Figma:** `A-Studio-Attendance-{Today|History}-*`.

## A-13 · Payroll (summary within Employees/Reports)
- **Purpose:** period pay summary derived from attendance (owner). *Grounded: payroll math exists; presented as a summary view, not a full payroll product.*
- **Hierarchy:** period selector → per-employee (hours · rate · gross · adjustments · net Data) → totals → export. 
- **Spacing:** table row 44; totals row emphasized (dark ground). **Motion:** none beyond table. **Interaction:** period change; export; adjustments logged. **A11y:** money mono + announced; a real table. **States:** empty("No payroll data for this period") · loading. **Responsive:** table→cards (mobile). **Figma:** `A-Team-Payroll-*`.

## A-14 · Memberships - `/admin/subscriptions`
- **Purpose:** manage Club memberships; verify pending.
- **Hierarchy:** FilterBar (Pending·Active·Expiring·Lapsed) → DataTable (Customer · Tier · Since · Washes used/total · Renews · Status · Payment); pending first → detail (credits ledger; verify/activate/adjust/cancel).
- **Motion:** verify → status crossfade to active + tick. **Interaction:** verify/activate/adjust. **A11y:** counts mono; status words. **States:** empty · loading · verify-confirm. **Responsive:** cards (mobile), pending prominent. **Figma:** `A-Office-Memberships-*`.

## A-15 · Quotes - `/admin/quotes`
- **Purpose:** size-priced quotes (PPF) request→sent→accepted.
- **Hierarchy:** FilterBar (status) → DataTable (Customer · Vehicle · Service · Amount · Status · Date) → detail drawer (line items · send · convert to booking). **States:** empty("No quotes") · loading. **Figma:** `A-Office-Quotes-*`.

## A-16 · Expenses - `/admin/expenses`
- **Purpose:** record outgoings for close/reports.
- **Hierarchy:** "Add expense" drawer (amount · category · method · note · date · receipt photo) → DataTable (Date · Category · Amount · Method · Note · Added by) + filters.
- **Motion:** new expense rise at top. **Interaction:** add (validated); filter. **A11y:** amount mono; added-by attributed. **States:** empty("No expenses recorded") · loading. **Responsive:** add sheet + cards (mobile). **Figma:** `A-Accounting-Expenses-*`, `A-Accounting-AddExpense-*`.

## A-17 · Invoices & Payments - `/admin/invoices`
- **Purpose:** every invoice, its state, payment.
- **Hierarchy:** unpaid banner → FilterBar (All·Draft·Paid·Unpaid·range·search) → DataTable (Invoice# · Customer · Vehicle · Amount · Method · Status · Date) → detail (line items · taxes · discounts · payment · link to job/booking; mark paid · void(reason) · share · download).
- **Motion:** mark-paid → row status crossfade to success + tick. **Interaction:** mark paid; void (ConfirmDialog + reason); refund (dialog). **A11y:** amounts mono; void reasoned. **States:** empty("No invoices match") · loading · void-confirm · refund-confirm. **Responsive:** cards (mobile). **Figma:** `A-Accounting-Invoices-*`, `A-Accounting-InvoiceDetail-*`.

## A-18 · Daily Close - `/admin/close`
- **Purpose:** reconcile the day, lock it.
- **Hierarchy:** guided single flow: expected vs counted (cash, UPI) → unpaid/pending flags (jump) → day's expenses → net → **Confirm close** (ConfirmDialog; reopen = owner override, logged).
- **Why:** discrepancies first. **Motion:** section-to-section 200; final success draw. **Interaction:** count entry; resolve flags; confirm. **A11y:** each field labelled; close attributed. **States:** empty("Nothing to reconcile") · discrepancy(danger banner + jump) · closed. **Responsive:** vertical guided all sizes. **Figma:** `A-Accounting-Close-{Reconcile|Discrepancy|Confirm|Closed}-*`.

## A-19 · Reports / Analytics - `/admin/reports`
- **Purpose:** deeper analysis (revenue, mix, throughput, membership, retention).
- **Hierarchy:** range + dimension controls → chart cards (trend line · composition stacked · leaderboard bar) each with table + export.
- **Motion:** chart draw-in 280 once; reduced-motion static. **Interaction:** range/dimension; export. **A11y:** every chart has a labelled table + text headline summary. **States:** empty("Not enough data for this range") · loading(chart skeleton) · series-fail(→table). **Responsive:** charts stack; sticky-header tables. **Figma:** `A-Analytics-Reports-*`.

## A-20 · Settings (Services) - `/admin/settings`
- **Purpose:** service catalog + pricing + business settings.
- **Hierarchy:** category sections (PPF · Ceramic · Detailing · Wash) → inline-editable table (name · brand · price · duration · warranty · active · popular · order) → business settings (hours · bays/capacity · tax · studio profile).
- **Motion:** inline edit expands cell 120 + save tick. **Interaction:** inline edit (autosave-on-blur), drag reorder, toggle active (money changes logged). **A11y:** each editable cell labelled; reorder keyboard alt. **States:** empty("No services-add one") · saving · validation-error. **Responsive:** editable cards (mobile). **Figma:** `A-Settings-Services-*`.

## A-21 · Roles & Permissions - `/admin/settings` (roles) 
- **Purpose:** show/edit who may do what (grounded in `lib/permissions.ts`).
- **Hierarchy:** a role × capability grid (owner/admin · technician · kiosk; Studio/Office/finance/pricing/overrides) → editable where allowed (e.g. which employees get kiosk PINs). Plus Audit Logs + Notifications sub-sections.
- **Motion:** minimal. **Interaction:** toggle grant (logged). **A11y:** real grid; labelled toggles. **States:** read-only(most) · editable(PIN grants). **Figma:** `A-Settings-Roles-*`, `A-Settings-Audit-*`, `A-Settings-Notifications-*`.

## A-22 · Command Palette (⌘K) - global overlay
- **Purpose:** fastest nav + actions.
- **Hierarchy:** centered overlay (shadow-lg) → search field → grouped results (Go to · Quick actions · [entities]) → keyboard hints.
- **Spacing:** overlay max-w 560, pad 12; row 40. **Motion:** scale-in 120; no selection motion (speed). **Interaction:** fuzzy; ↑↓/⏎/Esc; role-filtered; recents top. **A11y:** combobox; focus trapped; options labelled. **States:** default · results · empty("No matches"). **Responsive:** full-screen sheet (mobile). **Figma:** `A-Overlay-Palette-{Default|Results|Empty}`.

## A-23 · Kiosk - `/store` (shared-tablet lock)
- **Purpose:** PIN unlock an employee onto the floor shell; auto-relock.
- **Hierarchy:** void ground → Wordmark → "Tap to unlock" → employee picker or PIN pad (Data, big keys) → unlock → Studio Board (actor chip set) → inactivity → relock here.
- **Spacing:** centered; PIN keys ≥64 (tablet touch). **Type:** keys Data 24. **Motion:** key press 120; relock fade. **Interaction:** PIN entry; wrong PIN → caution shake-free line; auto-relock timer. **A11y:** keys labelled; large targets; PIN masked. **States:** locked · entering · error · unlocked(→board). **Responsive:** tablet-first (this is the floor device); scales down. **Figma:** `A-Kiosk-{Locked|Entering|Error}-Tablet`.

## A-24 · Mobile staff mode
- **Purpose:** the manager's pocket + technician on a phone.
- **Behavior:** hamburger drawer nav + **bottom tab bar** (Board · Schedule · Attendance · Gallery for technicians; managers get the same + a "More" drawer to Office); tables → stacked identity cards or horizontal scroll with sticky identity column; details → full bottom sheets; the board stacks columns with a sticky capacity strip; ≥44 targets. **Figma:** every `A-*-Mobile-*` frame + `A-Shell-Mobile-{Drawer|Tabbar}`.

## A-25 · Tablet mode (the floor)
- **Purpose:** the always-on studio device.
- **Behavior:** icon-rail sidebar / hamburger; Studio Board touch-tuned (≥44), landscape = queue+bays side-by-side, portrait stacked; drawers right(land)/bottom(port); kiosk lives here; actor chip always visible. **Figma:** `A-*-TabletLand-*` / `A-*-TabletPortrait-*`.

## A-26 · Desktop mode
- **Purpose:** the manager/owner cockpit.
- **Behavior:** expanded sidebar + top bar + content; details as right drawers over context; full tables; ⌘K primary nav; ultra (≥1600) = persistent board right column + two-pane list+detail + capped content width. **Figma:** `A-*-Desktop-*`, `A-*-Ultra-*`.

---

# 5 · OVERLAYS INVENTORY (both apps)

| Overlay | System | Trigger | Behavior |
|---|---|---|---|
| st/Sheet: arrange · you · visit-adjust · join-club · car-form · moment-add · pay · desk | Studio | `?sheet=` | bottom sheet, single content-height snap (desk → 88vh cap), grab-handle, drag-dismiss, backdrop 40%, wide → centered 560; internal confirm states |
| st crash `/error` | Studio | uncaught | full paper screen, one action |
| st push frames | Studio | lifecycle | OS-style notification frames (C-14) |
| ops/Drawer: JobWorkspace · BookingDetail · Customer/Vehicle quickview · Walk-in · AddExpense · Assign | Ops | row/board | right drawer (480/640) / bottom sheet (mobile), sticky action bar |
| ops/ConfirmDialog | Ops | irreversible/money | centered 420, title + sentence + cancel/confirm(destructive tint) |
| ops/CommandPalette | Ops | ⌘K | centered overlay (A-22) |
| ops/menus (overflow ⋯, filter, column, density) | Ops | row/table | dropdown, deep ground, shadow-sm |
| ops/Toast | Ops | action result | bottom-center, status rule, 3–4s (errors persist) |
| ops/InlineAlert/Banner | Ops | persistent condition | status-ruled banner, one line + action |
| ops/KioskLock | Ops | idle/logout | full-screen PIN (A-23) |
| Loading | both | data pending | Studio: cached + wordmark, Spinner only in pressed Action, Skeleton for images; Ops: structural skeletons (tables/tiles/lanes), no shimmer theatre |

---

# 6 · MATRICES

## 6.1 Screen map (index)
```
CUSTOMER (st, light)
Auth: Login C-01 · OTP C-02
Onboard: W1–W4 C-03 · EmptyGarage C-04
Home: Glance C-05 (Portrait · Now · Protection C-08 · Story C-07 · Papers C-09 · Club C-10 · Signature) · Swipe C-06
Care: Arrange C-11 (sheet) · Stay C-12 · Chapter C-13
Relationship: JoinClub C-10 (sheet) · You/Settings C-15/16 · Install C-17
System: Notifications C-14 · Offline C-18 · Errors C-19 · Empty C-20 · Success C-21

ADMIN (ops, dark)
Auth: Login A-01
Studio: Board A-03 · Bay A-04 · JobWorkspace A-05 · Schedule A-08 · Bookings A-09 · Attendance A-12 · Gallery(D15) · VehicleProfile A-07 · Walk-in(D19) · Kiosk A-23
Office: Dashboard A-02 · Customers/360 A-06 · Memberships A-14 · Quotes A-15 · Invoices A-17 · Expenses A-16 · Close A-18 · Inventory/Recipes A-10 · Reports A-19 · Employees/Detail A-11 · Payroll A-13 · Services A-20 · Roles/Audit/Notif A-21
Global: Palette A-22 · Mobile A-24 · Tablet A-25 · Desktop A-26
```

## 6.2 Navigation map
```
CUSTOMER - no chrome; scroll + swipe + state:
  Glance ⇄(swipe) Glance(car n) →(swipe end) AddCar
  Glance →(capsule tap) Desk | →(capsule tap, live) Stay
  Glance →(avatar) You · →(Now/Renew/Arrange) Arrange · →(story tap) Chapter · →(Club) JoinClub
  Stay →(archive) Chapter · Stay ⇄(drag) collapsed
  Push →(deep link) exact state
ADMIN - sidebar(mode-grouped, role-filtered) + top bar + ⌘K:
  Board ⇄ drawers (JobWorkspace/Walk-in/Tech) without route change
  Any list →(row) detail drawer; detail →(links) related entity
  ⌘K → any nav dest or quick action; Kiosk(/store) →(PIN) Board
```

## 6.3 Component dependency graph
```
STUDIO
  Glance → Portrait → {TruthLine, image, scrim, avatar, dots}
  Glance → Layer → {PhotoBand, MomentEntry→PhotoBand, MemberCard, EmptyState, Action, text}
  Capsule (independent, fixed)
  Sheet → {Field(variants), Action, text}   (arrange/you/join/car-form/pay/moment)
  Desk → {Field(search), Action, cards(text)}
  Stay → MomentStage → {PhotoBand, text, assent-check}
  Chapter → {PhotoBand(hero+evidence), text, amount-table, rating(Action)}
  Action → Spinner ; PhotoBand/Portrait → image-load ; Skeleton (image)
OPS
  AppShell → {Sidebar, TopBar, Drawer host, CommandPalette}
  Board → {capacity, BayCard, QueueCard, TechChip/Drawer, FeedRow, OpsTimeline, StatusStepper}
  JobWorkspace(Drawer) → {StatusStepper, AssignmentControl, PhotoGrid/Camera/Lightbox, PaymentControl, Action bar}
  Lists → DataTable → {FilterBar, StatusToken, row→Drawer, bulk-bar}
  Office → {KpiTile, Chart(+table fallback), InlineAlert}
  Global → {ConfirmDialog, Toast, Banner, KioskLock/ActorChip, AuditRow}
```

## 6.4 Design-system dependency graph
```
Variables(st light/dark, ops dark)
  → Text styles → components → screens
  → Effect styles(elevation/shadow) → cards/sheets/drawers/dialogs/palette
  → Grid styles → frames
  → Motion tokens → interaction components(press/hover/rise/…)
  → Icon sets(st 16 / ops lucide) → nav/actions/status
  → Photography frames(st classes) → Portrait/PhotoBand/Gallery
No cross-system references (st never imports ops, vice-versa). No illustration dependency.
```

## 6.5 Interaction matrix
| Gesture/Input | Studio | Ops |
|---|---|---|
| Tap | act (press feedback) | act (press) |
| Long-press | capsule → shelf; photo → save/share | (n/a) |
| Swipe horizontal | between cars | mobile table scroll |
| Swipe down | dismiss sheet / collapse Stay | dismiss bottom sheet |
| Scroll | depth | list/board scroll (position remembered per page/workflow) |
| Hover (pointer) | card-hover lift | row/control ground shift |
| Keyboard | Tab/Enter/Esc; sheets trap | full: ⌘K, sort/select, inline-edit (Enter/Esc), Esc close |
| Drag | sheet dismiss | drawer dismiss; Schedule reschedule; bulk not-drag |

## 6.6 Animation matrix
| Event | Studio | Dur | Ops | Dur | Reduced-motion |
|---|---|---|---|---|---|
| Screen/section enter | rise | move 280 | crossfade+4pt | scene 280 | opacity only |
| Text/state change | crossfade | move | crossfade | element 200 | crossfade |
| Press | scale .98 | tick 120 | settle | micro 120 | none |
| Hover | card lift | move | ground shift | micro 120 | none |
| Sheet/Drawer | slide-up+scrim | move | slide+scrim | element 200 | fade; spring kept |
| Dialog/Palette | (n/a)/- | - | scale-in | 120/200 | fade |
| Image load | fade from surface | move | thumb fade | - | none |
| Signature | takeover-breath / visit-dissolve | scene 480 | (n/a) | - | crossfade |
| Status advance | assent check draw | tick | crossfade+success tick | 120 | appears complete |
| KPI/stock update | - | - | crossfade (no count-up) | 200 | instant |
| Chart draw | - | - | path reveal once | scene 280 | static |

## 6.7 Accessibility matrix
| Concern | Studio | Ops |
|---|---|---|
| Focus ring | 2pt ink-3, offset 2 | 2pt chrome@70, offset 2 |
| Target | ≥44 (capsule 52) | ≥40 (≥44 floor) |
| Landmarks | portrait(1 element)→capsule→layers(headings) | shell regions; table headers; section landmarks |
| Live regions | TruthLine, Stay acts (polite) | studio feed, status changes (polite) |
| Color-alone | never (words+tone) | never (status word+dot) |
| Contrast | AA on paper/dark; scrim guarantees over-on-photo | tuned dark ramp; steel ≥12pt |
| Dynamic Type | reflow; photo never shrinks | scales; tables scroll |
| Reduced motion | whole tree (MotionConfig + CSS) | transforms off, opacity kept |
| Keyboard | complete; sheets trap | complete; palette/drawers/inline-edit |
| Alt text | job-specific per photo | job-context per photo |

## 6.8 Responsive matrix
| Surface | Phone <720 | Tablet 720–1199 | Desktop 1200–1599 | Ultra ≥1600 | Landscape | Fold-open |
|---|---|---|---|---|---|---|
| Glance | 1 col, full photo | text col 640 + full photo | letterbox 720 | letterbox 720 | portrait 50% + layers | tablet rules |
| Sheets | bottom sheet | bottom sheet | centered 560 | centered 560 | side panel ≥720 | centered |
| Desk | sheet 1-col | sheet | sheet | two-pane | side panel | two-pane |
| Stay | full-bleed | full-bleed | full-bleed | full-bleed | full-bleed | full-bleed |
| Admin shell | drawer + bottom tabs | icon rail/hamburger | expanded sidebar | expanded + persistent columns | side-by-side board | tablet rules |
| Admin tables | stacked cards / sticky-col scroll | sticky identity col | full | more columns | full | full |
| Admin details | full bottom sheet | drawer right/bottom | drawer right | two-pane (no drawer) | drawer right | two-pane |
| Type scale | as system | unchanged | unchanged | unchanged (more content, not bigger type) | unchanged | unchanged |

---

# 7 · FIGMA BUILD CHECKLIST (for the design team)
1. Foundations pages 01/02: publish `st` (2 modes) and `ops` (1 mode) variable collections, text/effect/grid styles per §1. 
2. Icons & Media page 05: build `st/icon/*` (16, Name+Tone) and `ops/icon/*` (Lucide, Name+Size+Tone); photography frames per class with scrim overlay; **no illustration library**.
3. Components pages 03/04: build every §2 component with the listed variant/state/property enums, auto-layout, and constraints; wire interactive-component states (press/hover/focus). Name per §0.3.
4. Screens 06/08: assemble every §3/§4 frame at its primary device, then derive responsive frames per §6.8; apply states as variants; annotate spacing from tokens only.
5. Overlays 07/09: build every §5 overlay as components; attach to screens via prototype.
6. Flows 10: wire the navigation map §6.2 and the animation matrix §6.6 as prototype interactions (with reduced-motion notes).
7. Matrices 11: paste §6 as reference boards.

*Everything above reuses P2D1 (Studio) and P2D2 (Ops) verbatim; no competing system, no duplicated component, no contradiction. End of master specification - design only, no code, no commit.*
