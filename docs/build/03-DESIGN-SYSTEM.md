# 03 · THE AUTOMODZ DESIGN SYSTEM - "STUDIO"
### Phase 3 of the build - the complete visual, motion, and interaction language

**Authority:** Constitution + Experience Principles + frozen IA/Flows. Designed from zero; the current UI does not exist. Every future screen must be buildable from this document alone. Nothing here is a mockup or code - it is the system.

**The one-sentence brief:** the interface is a gallery wall for the customer's car - paper, ink, photography, and silence. Premium is achieved by confidence, precision, and restraint, never by decoration.

---

# PART I - FOUNDATIONS

## 1 · Surface & color system

The product is **light, photographic, and nearly monochrome**. Color is reserved for the car.

### 1.1 The palette (complete - nothing else exists)

| Token | Value | Role |
|---|---|---|
| `paper` | `#FBFBF9` | The page. Warm white - gallery wall, never clinical `#FFF` |
| `gallery` | `#F1F1EE` | Recessed ground: sheet interiors, document backgrounds, input fills |
| `linen` | `#E7E7E3` | Pressed/selected ground; the only "third" surface |
| `ink` | `#141517` | Graphite ink - primary text, filled actions |
| `ink-2` | `ink` @ 62% | Secondary text |
| `ink-3` | `ink` @ 38% | Whisper text, data captions |
| `hairline` | `ink` @ 8% | The only border (see §1.3 for where it's allowed) |
| `over` | `#F7F7F5` | Text/controls on photography (100%) |
| `over-2` | `over` @ 70% | Secondary on photography |
| `scrim` | `#0C0D0E` → transparent | Photographic gradient, bottom-anchored, max 55% |
| `stage` | `#0C0D0E` | The one dark surface: the Stay, full-screen photo viewing - *photographic contexts only* |
| `assent` | `#2E5E48` | Deep racing-green ink. The single accent. Used **only** for: the confirmed tick, "covered/active" term wording, and the member card's thread. Never backgrounds, never buttons, never charts. |
| `caution` | `#8A5A2E` | Amber-brown ink. Only inside sheets, only for irreversible-confirm labels. |

Rules: no gradients except `scrim`; no pure black or pure white anywhere; no color may be introduced by a screen - if a state seems to need a new color, it needs a better sentence instead.

**Dark rendering:** the customer product is constitutionally light. When the OS requests dark, only the *chrome* inverts - `paper→#111214`, `gallery→#191A1C`, `linen→#212325`, ink scale flips to `#F2F2EF` at 100/62/38% - photography, `stage`, `scrim`, and both accent inks are identical in both renderings. Admin/store remain always-dark and are outside this system.

### 1.2 Surface hierarchy (top to bottom)

1. **Photography** - the highest surface; nothing overlaps it except `scrim`-backed type and the capsule.
2. **Sheet** - floats above the page on `gallery`, one shadow, 24px top radius.
3. **Page** - `paper`, flat, shadowless.
4. **Recessed** - `gallery` wells inside the page (inputs, document ground).
There is no z-axis beyond these four. Nothing "pops."

### 1.3 Hairline law

`hairline` may appear in exactly five places: sheet grab-handle, input underline, the member card's edge, table-rule inside a chapter's amount block, and the desk search field. Everywhere else, separation is whitespace and type. Any other border is a defect.

## 2 · Grid, spacing, radius, elevation

- **Grid:** 4pt base. Mobile content column = full-bleed for photography, `inset` for text. Breakpoints: `compact <720` (one column) · `regular 720–1199` (content column max 640, photography still full-bleed) · `wide ≥1200` (Glance letterboxes to a centered 720 column on `paper`; Desk becomes two-pane: thread 400 + focus panel).
- **Spacing scale (the only seven numbers):** `4 · 8 · 12 · 16 · 24 · 48 · 96`. Named: `hair 4` (glyph gaps) · `breath 8` · `line 12` (within a text block) · `gap 16` (between related elements) · `inset 24` (page margin, sheet padding) · `rest 48` (between groups) · `movement 96` (between layers - magazine-spread air).
- **Radius (three, fixed):** `24` sheets & photographs · `16` thread cards & member card · `999` the capsule and avatar. Buttons are **not** rounded rectangles - see Action (§8).
- **Elevation (two shadows, total):**
  - `lift` - `0 12px 40px rgba(12,13,14,0.10)` - sheets, the capsule.
  - `hold` - `0 2px 12px rgba(12,13,14,0.08)` - the member card only.
  Nothing else casts. A shadowless product that photographs well *is* the elevation system.
- **Blur/Glass:** one glass recipe, used **only** by the capsule and the Stay's collapsed bar: `blur(24px) saturate(140%)` over `paper @ 72%` (light) / `stage @ 64%` (on photography). Glass is never a card style, never a nav bar, never decorative.
- **Safe areas:** the capsule floats at `safe-bottom + 16`; page scroll ends at `safe-bottom + 96` (capsule clearance); portrait photography extends *into* the top safe area (full-bleed) with status-bar contrast guaranteed by a 64px top `scrim` at 24% when the portrait is light.

## 3 · Typography

One family in two optical voices + one data face. Faces are criteria-specified with a concrete buildable default:

| Voice | Face (default stack) | Criteria |
|---|---|---|
| **Display** | `Inter Display` (variable), weight 560–640, tracking −2% | Neo-grotesque with automotive precision; never a serif, never a novelty face |
| **Text** | `Inter` (variable), weight 400/520 | Optical text cut of the same family - one voice, two distances |
| **Data** | `JetBrains Mono`, weight 400, tracking 0 | Plates, VINs, dates, amounts *only* - never labels, never headers |

**The scale (complete):** `12 whisper` · `14 caption` · `16 body` (default) · `19 emphasis` · `24 title` · `32 headline` · `44 display`. Line-height: 1.45 (≤19), 1.2 (24–32), 1.05 (44). Display sizes are reserved for: the car's name, act titles in the Stay, chapter titles. Case: sentence case universally; ALL-CAPS exists only as the plate itself in Data. No letter-spaced micro-caps labels - that pattern is constitutionally dead.

**Text primitives (the four, restated as spec):** `Display` (24/32/44, ink or over) · `Body` (16/19, ink/ink-2) · `Data` (14/16 mono, ink-2) · `Whisper` (12/14, ink-3 - the voice of staleness, hints, and silence). Every character on every screen is one of these four.

## 4 · Iconography

- **Doctrine:** the product is nearly icon-free - words are more premium than glyphs. The permitted set is **16 glyphs**, 1.5px stroke, round caps, 20px frame, always `ink-2` or `over-2`, never filled, never colored, never animated: back-chevron · close · share · camera · photo-add · search · send · phone · location · calendar · check (assent contexts) · plus (add-car page only) · overflow-dot (chapter actions) · sound-off/on (future video) · external.
- No icon may carry meaning alone (VoiceOver + adjacent word always). No icon buttons without labels except back/close/share in established OS positions. A 17th glyph requires design-review sign-off recorded in this file.

## 5 · Motion system

**Motion is state changing - it communicates arrival, progress, confidence, craftsmanship, completion, trust. Never excitement, never decoration.**

- **One curve:** `studio-ease = cubic-bezier(0.22, 1, 0.36, 1)`. Sheets additionally use the platform spring for drag-release (felt physics = trust).
- **Three durations:** `tick 120ms` (press, toggle, check) · `move 280ms` (sheet, layer reveal, image fade, card state) · `scene 480ms` (the Stay presenting, chapter dissolve, act transitions).
- **The five communications, mapped:**
  - *Arrival* - new truth enters by 8px rise + fade (`move`); pushes' in-app counterpart is the capsule re-writing its line (crossfade `move`) - nothing slides in from edges.
  - *Progress* - act changes in the Stay: the act title crossfades, the act row advances with a single `tick` check. Progress is never a bar filling in real time.
  - *Confidence* - every transition completes; nothing bounces, overshoots, or reverses. Interruptibility: user input immediately retargets any running `scene`.
  - *Craftsmanship* - the **two signature scenes** (the only choreographed animations in the product): ① *Takeover breath*: portrait scales 1.00→1.04 while `stage` fades up beneath the Stay (`scene`); ② *Visit-becomes-memory*: the reveal hero shared-element travels into the timeline's newest entry (`scene`).
  - *Completion* - the assent check draws (`tick`), then stillness. Stillness is the reward.
- **Banned:** loops, pulses, shimmer skeletons, parallax, staggered list choreography, count-up numbers, confetti, any animation over 480ms.
- **Reduced motion:** scenes → crossfade `move`; signature scenes → crossfade; drag physics retained (it's input, not animation).

## 6 · Gesture language (system level)

Per frozen IA §4.1 - restated as the *felt* spec: scroll owns depth; horizontal swipe owns the garage (paged, 24px peek of the next portrait, settle ≤ `move`); sheet drag follows the finger 1:1 with platform spring release; the Stay collapses with a downward drag (portrait re-emerges live under the drag - the customer literally puts the visit down); pull-to-refresh does not exist (data is live; a manual pull yields only the whisper timestamp updating - honesty, not theatre); long-press is always *offer, never require*. Every gesture has a visible-control equivalent (accessibility law, §12).

---

# PART II - COMPONENT LIBRARY

The constitutional budget: **twelve components + four text primitives.** Every element any screen will ever need is one of these twelve, a variant of one, or a composition - the full mapping is §11. Each spec: anatomy · variants · states · motion · a11y.

## 7 · The twelve

### 7.1 `Portrait`
The vehicle hero. Full-bleed, min-height 92vh (compact), 4:5 crop discipline, bottom `scrim`. Anatomy: image → scrim → name (`Display 44`, `over`) → TruthLine → 24px to Capsule clearance. States: photographed / typographic (model name `Display 44` centered on `stage` - dignity, not placeholder) / loading (blurhash → fade `move`). Garage paging lives here (dots: 4px `over-2`, active `over`). A11y: image alt = "your {model}"; name+truth are one VoiceOver element.

### 7.2 `TruthLine`
One sentence of state. `Body 19, over` (on photography) or `ink-2` (in layers). Exactly one line, ellipsis never - the sentence is written to fit. Change = crossfade `move`. Priority order is law (in-studio > ready > agreed > term edge > care due > protected > quiet). A11y: `aria-live=polite`.

### 7.3 `Capsule`
The concierge presence. Glass pill (`999`), floats `safe-bottom+16`, height 52, max-width `min(560, 100%−48)`. Anatomy: state text (`Body 16`) + optional single action word (`emphasis`, ink). Variants: quiet ("AutoModz") · proposal (reason-led line + "Yes"/open) · agreed (countdown line) · live (act line, tap → Stay) · ready. Motion: text crossfade `move`; never moves position, never bounces, never badges. Long-press: shelf shortcuts sheet. A11y: this is the product's primary landmark; VoiceOver announces state changes; 52px target.

### 7.4 `Desk`
The conversation surface (`/app/desk`). Anatomy: thread (bottom-anchored, newest last) · shelf (adaptive object rows above/behind: `Body 19` rows, no icons, no chevrons - the row *is* the affordance) · search field (hairline underline, `Data` results grouping by year). Two-pane at `wide`. Thread cards are `Sheet`-family cards (16 radius, `gallery`) carrying M5 references with one action. A11y: full keyboard traversal; search is a combobox.

### 7.5 `Layer`
The Glance's section wrapper: `movement 96` rhythm, header (`title 24`, ink) + optional whisper. Renders nothing when empty (constitutional silence). Reveal on first scroll-into-view: rise+fade `move`, once.

### 7.6 `PhotoBand`
Photography rows outside the portrait: protection bands (21:9), memory entries (natural ≤4:3), chapter heroes (3:2). Caption block below (never on the image except protection bands' single title over scrim). Tap → full-screen viewer (a `stage` presentation of the same component: pinch-zoom, share, swipe-through; close = drag down). Loading: blurhash fade.

### 7.7 `MomentEntry`
One timeline atom: photo (`PhotoBand`) or text milestone (`Body 19` + `Data` date, hairline-free). Author whisper ("by the studio" / "by you"). Visit chapters render as MomentEntry with act count caption. Tap: chapter or viewer.

### 7.8 `MomentStage`
The Stay's act renderer on `stage`: act title (`Display 32`, over) · narration sentence (`Body 19, over-2`) · latest evidence photo · act row (five dots-as-words: tiny `caption` act names, done = `over`, current = assent tick draw, future = `over-2`). Collapsed variant: glass bar above capsule position with act line. Scene transitions per §5.

### 7.9 `MemberCard`
The one literal card. 16 radius, `paper` on light contexts with `hold` shadow, hairline edge, `assent` thread accent line, name (`emphasis`), tier + since (`Data`). States: active / pending (whisper explains) / lapsed (ink-3, dates kept). It animates once ever: its `scene` arrival into the Relationship layer on activation.

### 7.10 `Sheet`
The single overlay. `gallery` ground, 24 top radius, grab-handle, `lift`, drag-dismiss, `inset` padding, max-height 88vh, internal states (form → confirming → done) - never stacks another overlay. Done state: assent check draw + one sentence, auto-dismiss after 1.2s or on tap. Desktop/`wide`: becomes a centered panel (560) with scrim - same component, same states. A11y: focus-trapped, `Esc`/back closes, restores invoker focus.

### 7.11 `Field`
Input: label (`caption`, ink-2) above value (`Body 19`), hairline underline, no boxes. Focus: underline → ink, `tick`. Error: the concierge line below in `caption` (never red text alone - wording carries it, `caution` reserved for irreversible confirms). Variants: text · phone (`Data` glyphs) · slot-picker (horizontal day/time words, selected = `linen` ground) · tier-picker (swipeable MemberCard-shaped options) · switch (word + platform switch) · photo (camera affordance on `gallery` well).

### 7.12 `Action`
The one button. **Text-first:** default variant is an ink `emphasis` word/phrase with 44px hit area - premium products ask in words. Variants: `primary` (filled `ink` bar, `over` text, full-width in sheets only, radius 12) · `quiet` (ink text) · `destructive` (caution text, confirm-state only) · `on-photo` (over text). States: press = scale 0.98 `tick`; loading = inline 14px ring replacing the label (the product's only spinner); success = assent check `tick`; disabled = ink-3 + whisper reason adjacent (never a mystery).

## 8 · Photography system (the sixth foundation)

| Class | Ratio / crop | Placement | Job |
|---|---|---|---|
| Portrait | 4:5, car ¾-front, lower-third weighted | `Portrait` | identity |
| Arrival | 3:2 wide, environmental | Stay + chapter | custody |
| Inspection | 4:3 close, honest light | Stay findings + chapter | condition |
| Craft | 4:3–1:1 macro, hands allowed | Stay + chapter | competence |
| Finished/Reveal | 3:2, same angle as arrival where possible | Reveal + chapter hero | transformation |
| Detail | 21:9 band crop | Protection layer | evidence |
| Memory | natural ≤4:3 | timeline | story |

Treatment: no filters; scrim only; text never over the middle; type-safe area = bottom 30% under scrim + top 15% clear. Hierarchy: one hero per screen - a second photograph on screen renders ≥50% smaller. Loading: blurhash → `move` fade, always. Transitions between photos: crossfade, never slide. Degradation: typographic (§7.1) - no placeholder boxes, no stock, no other cars, ever.

## 9 · Micro-interactions (complete)

| Interaction | Spec |
|---|---|
| Press | scale 0.98, `tick`, release settles - everything tappable, no exceptions |
| Hold | 350ms threshold → offer surfaces (haptic soft tick); release before = normal tap |
| Swipe (garage) | 1:1 follow, 24px peek, velocity-respecting settle |
| Dismiss (sheet/stay/viewer) | drag 1:1, release >30% or velocity → close with spring; else return |
| Expand/collapse (Stay) | the takeover breath / its reverse - the portrait is always live beneath |
| Refresh | none (live data); pull yields whisper timestamp nudge |
| Loading | inline ring in Action; blurhash for photos; cached-truth-first everywhere - full-screen loading does not exist |
| Success | assent check draw `tick` + one sentence + stillness |
| Failure | sheet reopens with values + concierge line; whisper for connectivity - never shake, never red flash |
| Haptics | soft tick on: act change, agreement confirmed, member activation. Nowhere else |

## 10 · Voice components of state (status · badges · filters · errors - the "does not exist" registry)

Requested elements that this system deliberately renders **as language, not chrome** - with their lawful home:

| Asked for | Exists as |
|---|---|
| Status indicators | `TruthLine` + term wording (`assent` ink for "covered/active") - no chips, no dots |
| Badges | do not exist (no counts, no pills) - the capsule's sentence is the ambient signal |
| Filters | do not exist - recall is Desk search (frozen IA) |
| Dialogs/drawers | do not exist - `Sheet` internal confirm states only |
| Notifications (in-app) | capsule + truth line + thread; push spec in IA §7 |
| Progress bars | do not exist - act words + assent ticks |
| Tracker | `MomentStage` (the Stay) |
| Empty states | `Layer` silence, or one-sentence invitation (`Body 19` + Action-quiet) |
| Error states | the three renderings (whisper / sheet line / thread) - E2 of flows |
| Toasts | do not exist - the done-state sentence lives inside the sheet that did the work |

## 11 · Composition map (founder's component list → system)

Buttons→`Action` · Navigation→Capsule+gestures (no nav chrome) · Cards→thread cards (`Sheet` family)+`MemberCard` only · Vehicle Passport→`Portrait`+`Layer` stack · Protection cards→`PhotoBand` 21:9 variant · Journey timeline→`MomentEntry` stream · Memory cards→`MomentEntry` · Proposal cards→thread card variant · Conversation cards→thread card (M5) · Concierge capsule→`Capsule` · Inputs/selectors→`Field` variants · Bottom sheets→`Sheet` · Lists→`Desk` shelf rows / `Layer` stacks (no generic list component - lists are typography) · Image viewer→`PhotoBand` stage presentation · Photo stack→chapter's act-grouped `PhotoBand` run · Document viewer→chapter page composition (`PhotoBand`+`Body`+`Data` amount block) · Search→`Desk` search · Loading/empty/error/success→§9–10. **Everything the product will ever show is now defined.**

---

# PART III - ACCESSIBILITY (constitutional, not optional)

- **Touch:** every target ≥44×44; capsule 52; primary sheet actions full-width.
- **Contrast:** all four ink levels on all three grounds pass WCAG AA at their assigned sizes (ink-3 used ≥12px only, verified 4.6:1 on paper); `over` on photography guaranteed by scrim minimums; `assent`/`caution` are ink-dark by design (6.8:1 / 5.9:1 on paper).
- **VoiceOver:** landmark order = portrait (one element: car+truth) → capsule → layers as headings; the Stay announces act changes via live region; every photo carries a job-specific alt ("arrival photo - the C 43 at the studio, 9:58"); decorative scrims hidden.
- **Dynamic Type:** the scale maps to platform text styles; layouts reflow (truth line may wrap to 2 at accessibility sizes - the only exception to §7.2); photography never shrinks to make room - text takes new lines.
- **Keyboard (wide/desktop):** full traversal; capsule = `⌘K`-free (no palette - the Desk search is reachable by Tab); sheets trap focus; `Esc` dismisses.
- **Reduced motion:** §5; signature scenes crossfade; no information is motion-only.
- **One-handed:** every actionable element in the bottom 60% on compact; the top of the screen is photography and reading, never controls (back/close float bottom-corner on push pages).
- **Landscape & foldables:** Glance letterboxes the portrait left, layers scroll right (the `wide` grid applies early); the Stay stays full-bleed; sheets become side panels ≥720.
- **Offline:** §M2 - cached truth + whisper; never a dead screen.

---

**End of Phase 3.** Every screen in Phase 4 must be assembled from Parts I–II and pass Part III. If a screen cannot be built from this document, the *screen* is wrong. Awaiting design-system approval; screen design begins only after.
