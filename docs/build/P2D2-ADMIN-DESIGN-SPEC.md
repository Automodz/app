# AUTOMODZ STAFF (ADMIN) APP — COMPLETE DESIGN SPECIFICATION
### P2.D2 · Figma-level UX/UI blueprint · design only, no implementation

**Baseline:** commit `4c5d6ba`. Architecture is real and frozen; this specifies the **experience** only.
**Companion to:** `P2D1-CUSTOMER-APP-DESIGN-SPEC.md`. The customer app is Studio White and light; the staff app is a separate, **always-dark operations OS**. The boundary is absolute — no customer surface ever renders dark chrome, no staff surface ever renders paper.
**Grounding audit:** one staff shell (`app/admin/layout.tsx`) with **two operating modes** — STUDIO (the floor) and OFFICE (the business) — filtered by role (`lib/permissions.ts`). Real routes: Studio Board `/admin`, Schedule, Bookings(+detail), Attendance, Gallery, Walk-in, Jobs(+detail), Vehicles/[reg]; Office Dashboard `/admin/office`, Customers(+profile), Memberships, Quotes, Invoices, Expenses, Daily Close, Inventory(+recipes), Reports, Employees(+detail), Services(Settings), Cars(+leads), Promos. Command palette (⌘K), kiosk (shared-tablet PIN unlock with actor attribution + auto-relock to `/store`). Job lifecycle: `checked_in → in_progress → quality_check → ready_for_delivery → completed/delivered`. Two physical resources (bays): **wash** and **protection**. This spec designs *within* that reality — no invented modules, no fake features.
**How to read:** Part A philosophy · B visual language · C IA/navigation · D screens · E operational flows · F components · G motion · H responsive · I accessibility · J future. No code, no CSS, no framework references — values are design specs (points).

---

# PART A — ADMIN DESIGN PHILOSOPHY

The staff app is not a CRM the team must feed; it is the **instrument the studio runs on**. Every pixel earns its place by reducing effort or increasing certainty. The three people who use it should feel different things:

**The technician (employee) should feel: guided and fast.** They live on the Studio Board. They should never think about "which screen" — the day's next action is always in front of them: the next car to check in, the next status to advance, the next photo to take. One tap advances a job; the drawer holds the detail without leaving the board. No finance, no reports, no decisions — the shell hard-redirects them to the floor. The feeling: *a well-run kitchen pass*, not a database.

**The manager should feel: in control without policing.** They move between Studio (is the day flowing?) and Office (is the business healthy?). The board tells them capacity, queue pressure, who's idle, what's late — at a glance, in one screen, without asking anyone. Office gives them the money and the decisions. The feeling: *a cockpit* — dense with truth, calm under load.

**The owner should feel: the whole business is legible and trustworthy.** Every rupee is traceable (invoices, expenses, daily close), every action is attributed (kiosk actor), every override is deliberate. They should be able to close the day in minutes and trust the number. The feeling: *Stripe-grade financial clarity* applied to a detailing studio.

**Doctrine:**
1. **The day runs on one screen.** The Studio Board is the operating system, not a landing page. Everything the floor needs is reachable without a route change (drawers, inline actions).
2. **Minimize clicks; the common path is one tap.** Check-in, status advance, assign, photo, collect payment, deliver — each is a single deliberate action, confirmed only when irreversible or money-moving.
3. **Operational clarity over aesthetics.** Dark, monochrome, dense, quiet. Color is a signal, never decoration. No glass everywhere, no decorative gradients.
4. **Attribution is sacred.** On the shared tablet, every action is stamped with the unlocked employee. Trust is built by knowing who did what.
5. **Roles are the guardrails, in one place.** `lib/permissions.ts` is the single source; the UI simply reflects it (technicians never *see* Office).
6. **Never punish the floor for the office's needs.** Business gates (unpaid-delivery override) exist but are the manager's, surfaced only when relevant, never blocking a technician mid-task.

---

# PART B — VISUAL LANGUAGE (dark operations)

The staff app uses the existing dark ops token system. Monochrome — a graphite-to-white ramp with **semantic status color as the only chromatic signal**. No brand accent color; the "accent" is near-white on graphite.

## B1 · Surfaces (depth ramp, dark)
A single deepening ramp establishes hierarchy by elevation, not by borders.

| Token | Value | Role |
|---|---|---|
| void | `#08090B` | App background (deepest) |
| abyss | `#0C0D0F` | Page ground |
| deep | `#101114` | Section ground |
| cavern | `#17191C` | Card ground (the default card) |
| dark | `#1F2226` | Raised card / row hover |
| dim | `#282B30` | Input fill, pressed |
| surface | `#33373D` | Control ground |
| lifted / peak | `#40454C` / `#4F555D` | Rare top elevation (drawer headers) |

## B2 · Ink (text ramp on dark)
| Token | Value | Use |
|---|---|---|
| chrome | `#F5F6F7` | Primary text, headings, the "accent" |
| silver | chrome @ 80% | Emphasis / secondary heading |
| pewter | chrome @ 55% | Body secondary |
| steel | chrome @ 35% | Captions, disabled, placeholders |
| smoke / ash / fog | @16 / @8 / @4% | Dividers, hairlines, faint fills |

## B3 · Status color (the only chroma — used sparingly, as signal)
| Token | Value | Meaning |
|---|---|---|
| success | `#5FBF8F` | Paid · delivered · in-stock · present · on-time |
| warning | `#D9A94A` | Late < 15m · low stock · pending verification · on-break |
| danger | `#E06C75` | Late 15m+ · out-of-stock · overdue · unpaid-at-delivery · absent |
| info | `#6FA8C9` | Neutral informational (rarely; prefer ink) |

Status color appears as: a 6–8pt **status dot**, a **left rule** on a row/card, or a **pill** (12/1.4 text, color @ 16% fill + color text). Never as a full background. A status is always paired with a word (color is never the sole signal — accessibility law).

## B4 · Typography
| Style | Size / lh | Weight | Face | Use |
|---|---|---|---|---|
| Display | 28 / 1.15 | 700 | display (Outfit) | Screen titles (rare; usually the top bar suffices) |
| H1 | 22 / 1.2 | 700 | display | Card/section titles |
| H2 | 18 / 1.25 | 600 | display | Sub-sections, drawer titles |
| Body | 14 / 1.5 | 400 | body (DM Sans) | Default text, table cells |
| Body-strong | 14 / 1.5 | 600 | body | Emphasis in rows |
| Label | 12 / 1.4, +6% tracking | 600 | body | Group headers (STUDIO / BUSINESS), table column heads |
| Data | 13 / 1.4 | 400 | mono (DM Mono) | Money, counts, times, plates, IDs, SKUs |
| Micro | 11 / 1.4, +8% | 500 | mono | Timestamps, meta, kiosk actor |

Money and time are **always** mono (Data) — right-aligned in tables so digits scan vertically. Titles are display; everything operational is body/mono.

## B5 · Spacing
4pt base. Scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`. Dense but breathing: table row height 44 (comfortable) / 36 (compact toggle); card padding 16–20; section gap 24; page inset 20 (mobile) / 24 (desktop content). The board is dense (12–16 gaps); Office reports breathe more (24).

## B6 · Radius
`control 8 · card 12 · drawer 16 (top) · pill 999`. Tighter than the customer app — operational, not luxurious.

## B7 · Elevation & shadow
Depth is primarily the surface ramp (B1). Shadows are subtle and reserved:
| Name | Spec | Used by |
|---|---|---|
| shadow-sm | `0 2 12 rgba(0,0,0,0.6)` | Raised cards, dropdowns |
| shadow | `0 8 32 rgba(0,0,0,0.7)` | Drawers, dialogs |
| shadow-lg | `0 16 56 rgba(0,0,0,0.8)` | Command palette, full-screen overlays |
No glow, no colored shadow.

## B8 · Cards
Default card = `cavern` ground, radius 12, padding 16–20, 1pt `ash` hairline optional (used when cards sit on the same ground). Hover (pointer) → `dark` ground, `shadow-sm`, `move`. A card may carry a status left-rule (3pt, status color). Cards never nest more than one level.

## B9 · Tables (the workhorse)
- **Structure:** sticky header (Label style column heads, `deep` ground, bottom `ash` hairline), rows 44 tall, zebra off (dark), row separators = `fog` hairline, hover → `dark` ground.
- **Alignment:** text left, money/counts/dates right (mono). Status = leftmost dot or a pill column.
- **Density toggle:** comfortable (44) ↔ compact (36) per table, remembered.
- **Row action:** entire row is the primary tap (opens detail/drawer); a trailing overflow (⋯) reveals secondary actions on hover/focus.
- **Bulk:** checkbox column appears on first selection; a selection action bar docks to the bottom of the table ("3 selected · Mark paid · Export").
- **Sort:** click a column head; one sort at a time; arrow indicator.
- **Sticky first column** on mobile horizontal scroll (the identity column — customer/vehicle).
- **Empty / loading / error:** see F-Table.

## B10 · Forms
- **Field:** label (Label style, steel) above input; input on `dim` ground, radius 8, 1pt `smoke` border, height 40; focus → border chrome + 2pt focus ring (see I). Help/error text below (12, error = danger).
- **Layout:** single column by default; two-column only on wide for short paired fields (price/duration). Money inputs are mono, ₹-prefixed.
- **Inline edit:** table cells that are editable (price, stock) become an input on click without a modal — Notion/Stripe style. Enter commits, Esc cancels, blur commits.
- **Validation:** on blur and on submit; the submit button shows the count of blocking errors; never a silent failure.
- **Autosave** where safe (settings, notes); explicit Save for money-moving forms.

## B11 · Sheets & Drawers
The staff app's detail pattern is the **right-side drawer** (desktop/tablet) / **bottom sheet** (mobile), *not* full-page navigation — so context (the board, the list) stays behind.
- **Drawer (desktop):** slides in from the right, width 480 (detail) / 640 (workspace), `deep` ground, `shadow`, backdrop `void @ 55%`. Header = title + status + close. Body scrolls; a sticky action bar docks at the bottom.
- **Bottom sheet (mobile):** the same content, slides up, radius 16 top, drag-to-dismiss, 90vh max, sticky action bar above the safe area.
- Used by: Job Workspace, Booking detail, Customer/Vehicle quick-view, Walk-in intake, Add expense, Assign employee.

## B12 · Dialogs (confirm only)
Reserved for **irreversible or money-moving** confirmations (delete, refund, deliver-with-balance override, reopen shift, void invoice). Centered, `deep` ground, radius 12, `shadow-lg`, max-width 420. Title (H2) + one plain sentence + two actions (cancel ghost, confirm filled — danger-tinted for destructive). Never used for routine input (that's a drawer/inline).

## B13 · Alerts & toasts
- **Toast** (react-hot-toast): bottom-center, `dark` ground, 1pt status rule, auto-dismiss 3–4s; used for action confirmation ("Marked paid", "Assigned to Ravi"). Errors persist until dismissed.
- **Inline alert** (banner): on a screen when a persistent condition needs attention (unverified UPI payments, low-stock items, an open shift at close) — status-tinted left rule, one line + one action.
- No alert stacking theatre; one toast at a time (queued).

## B14 · Search & Command Palette
- **Global search** lives in the top bar (a field on desktop, an icon on mobile) and in the palette.
- **Command Palette (⌘K / Ctrl-K):** the power surface. Fuzzy over: every nav destination (grouped "Go to · Studio/Business/…"), quick actions (New walk-in, Start daily close, Add expense, Office, Sign out), and — future — entities (customers, vehicles, invoices by number/plate). Role-filtered from the same permission list. Keyboard: ↑↓ navigate, ⏎ run, Esc close; recent/most-used float to top. This is the fastest path for the manager/owner.

## B15 · Navigation
- **Sidebar** (desktop, collapsible to icon rail): grouped by mode — STUDIO group, then BUSINESS/CUSTOMERS/ACCOUNTING/WAREHOUSE/ANALYTICS/TEAM/SETTINGS (Office). Group headers = Label style. Active item = `dark` fill + chrome text + 2pt left rule. Technicians see only STUDIO.
- **Top bar:** current section title (derived from the longest-matching nav href) + global search + a **STUDIO/OFFICE mode indicator** + primary quick action (contextual: "New walk-in" on the board) + user/kiosk-actor chip.
- **Mobile:** the sidebar becomes a slide-in drawer (hamburger); a bottom tab bar carries the 3–5 highest-frequency Studio destinations for technicians (Board · Schedule · Attendance · Gallery); Office is drawer-only.

## B16 · Filters
- **Filter bar** above tables: segmented chips for the primary axis (e.g. Bookings: All · Today · Upcoming · Completed · Cancelled), plus a date range and a search field. Chips are single-select for status, multi for tags. Active filters show as removable pills; "Clear" resets. Filters persist per table per session.
- Never a modal filter panel for common axes — chips are one click.

## B17 · Status system (operational)
Every operational object renders its state as a **status token** (dot + word, or pill). Canonical vocabularies (ops-side; the customer never sees these):
- **Job:** Checked-in · In progress · Quality check · Ready · Delivered. (Left-rule color: neutral → info → warning → success → steel.)
- **Booking:** Pending · Confirmed · Received · In progress · QC · Ready · Completed · Cancelled.
- **Payment:** Unpaid (danger) · Pending verification (warning) · Paid (success).
- **Attendance:** Present (success) · On break (warning) · Absent (danger) · Off.
- **Stock:** In stock (success) · Low (warning) · Out (danger).
- **Membership:** Active (success) · Pending (warning) · Expired/Cancelled (steel).
- **Invoice:** Draft (steel) · Paid (success).

## B18 · Charts (Reports)
- Minimal, monochrome-first: chrome/silver lines and bars on `cavern`, one status color only when the series *is* a status (paid vs unpaid). Grid = `fog`; axes = steel; no 3D, no gradients-for-decoration, no chart junk.
- Chart types kept to: line (trend), bar (comparison/period), stacked bar (composition), single big number + delta (KPI tile), sparkline (in-row). Tooltips = `deep` card, mono values.
- Every chart has a table fallback (accessible, exportable).

## B19 · Motion
- Curve: `cubic-bezier(0.22, 1, 0.36, 1)`. Durations: `120ms` micro (hover, press, toggle), `200ms` element (drawer, dropdown, row expand), `280ms` scene (page/section change, palette). Operational feel = quick and certain; nothing lingers.
- See Part G for the full table.

## B20 · Icons
Lucide, 18–20pt, 1.75pt stroke, steel/pewter default, chrome when active. Icons pair with words in nav and actions; icon-only allowed for universal controls (close, overflow, search, add) with aria-labels. Status is a colored dot, not a colored icon.

## B21 · Dark mode
The staff app **is** dark — there is no light rendering. (This is deliberate: an always-on floor tablet in a studio, and a manager's cockpit, read best dark; it also hard-separates staff from the light customer app.) Contrast is tuned for the dark ramp (Part I). No theme toggle.

## B22 · Accessibility baseline
Focus ring 2pt chrome @ 70%, 2pt offset; targets ≥ 40 (44 on the floor tablet); status never color-alone; tables are real tables with headers; the palette and all drawers are keyboard-complete. Full spec in Part I.

---

# PART C — NAVIGATION ARCHITECTURE (complete IA)

## C1 · The model
**One application, two modes, four human roles** (owner/admin · technician · kiosk · — customer is elsewhere). Mode follows the route; role gates visibility. There is no separate "employee app" — the shell redirects technicians to Studio.

```
STAFF SHELL (/admin, always dark)
│
├── STUDIO  (the floor — technicians + managers)
│   ├── Studio Board        /admin            ← the day's operating system (home)
│   │   ├── Waiting queue · Bays · QC/Ready · Tech rail · Feed · Timeline
│   │   ├── Job Workspace   (drawer)  · deep-link /admin/jobs/[id]
│   │   ├── Walk-in intake  (drawer)  · /admin/walkin
│   │   └── Technician card (drawer)
│   ├── Schedule            /admin/schedule   ← resource calendar (2 bays)
│   ├── Bookings            /admin/bookings   ← list + /admin/bookings/[id]
│   ├── Attendance          /admin/attendance ← today's shifts / clock
│   ├── Gallery             /admin/gallery    ← work photos by job/date
│   └── Vehicle profile     /admin/vehicles/[reg]  ← the shop-side twin + timeline
│
└── OFFICE  (the business — owner/manager only)
    ├── Dashboard           /admin/office
    ├── CUSTOMERS
    │   ├── Customers        /admin/customers  · /admin/customers/[id] (Customer 360)
    │   ├── Memberships      /admin/subscriptions
    │   └── Quotes           /admin/quotes
    ├── ACCOUNTING
    │   ├── Invoices         /admin/invoices
    │   ├── Expenses         /admin/expenses
    │   └── Daily Close      /admin/close
    ├── WAREHOUSE
    │   └── Inventory        /admin/inventory · /admin/inventory/recipes
    ├── ANALYTICS
    │   └── Reports          /admin/reports
    ├── TEAM
    │   └── Employees        /admin/employees · /admin/employees/[id]
    ├── SETTINGS
    │   └── Services         /admin/settings
    └── (business lines) Cars marketplace /admin/cars(+/leads) · Promos /admin/promos

KIOSK  (/store) — PIN unlock screen for the shared floor tablet; unlocks an
employee onto the shell (Studio only), auto-relocks here after inactivity.
```

## C2 · Relationships (entity graph, staff view)
```
Customer ─< Vehicle ─< Booking ──> Job ──> Invoice ──> Payment
                         │           │        └─> Daily Close (aggregates)
                         │           ├─> Photos (Gallery)
                         │           └─> Assignments ──> Employee ──> Attendance
Customer ─< Membership (── wash credits ──> Job/Booking)
Inventory Product ─< Recipe ──(deducts on)──> Job
Quote ──(converts to)──> Booking
Promo ──(applies to)──> Booking/Invoice
```
Every list drills to a detail; every detail links to its related entities (a Job → its Customer, Vehicle, Booking, Invoice, Photos, Assignees). No dead ends.

## C3 · Cross-device IA
- **Desktop (≥ 1200):** sidebar (expanded) + top bar + content; details open as right drawers over context.
- **Tablet (720–1199) — the floor device:** sidebar collapses to an icon rail (or hamburger); the Studio Board is optimized for touch; details open as drawers (right on landscape, bottom on portrait); kiosk mode lives here.
- **Mobile (< 720) — the manager's pocket:** hamburger drawer nav + a bottom tab bar for the top Studio destinations; tables become stacked cards or horizontally-scroll with a sticky identity column; details are full bottom sheets.
- **Ultra-wide (≥ 1600):** the board gains a persistent right column (Feed + Tech rail always visible); Office tables cap content width and center; a two-pane list+detail is available (list left, detail right) without a drawer.

## C4 · Navigation flows (representative)
- **Floor loop:** Board → (tap waiting car) → Job Workspace drawer → advance status → close drawer → Board. Zero route changes.
- **Manager audit:** ⌘K → "Invoices" → filter Unpaid → row → drawer → Mark paid. Three keystrokes + two clicks.
- **Owner close:** ⌘K → "Start daily close" → reconcile → confirm. One command.

---

# PART D — SCREEN SPECIFICATIONS

Format: **Purpose · Layout · Hierarchy · Components · Empty · Loading · Errors · Mobile · Tablet · Desktop · Motion · Accessibility.** (Screens are grouped; shared table/drawer behavior is defined once in F and referenced.)

## D1 · STUDIO BOARD — `/admin` (the home of the floor)
- **Purpose:** run the entire working day on one screen — capacity, queue, live work, team, money-in-motion — with the next action always one tap away. Derives from one realtime jobs listener + the floor model (no duplicate listeners).
- **Layout (desktop):** top bar (date/clock, pipeline counts, "New walk-in", search) → **live capacity strip** (utilization bar + next-free time per bay) → three-column working area: **Waiting queue** (left), **Bay cards** ×2 (center, the physical resources with occupant detail), **QC / Ready** (right tail) → **Technician rail** (who's working/break/idle, ETA, jobs-done) → **Studio feed** (realtime event stream) → **Timeline** (today's bookings + live work on two resource lanes). On ultra-wide, Feed + Tech rail dock as a persistent right column.
- **Hierarchy:** capacity (can we take work?) → queue (who's next?) → bays (what's happening now?) → QC/ready (what's finishing?) → team (who's free?) → feed/timeline (the record).
- **Components:** capacity bar, bay card (occupant, service, elapsed/remaining, tech, late color), queue card (auto-prioritized: appointments > wait time > walk-ins), QC/ready card, tech chip, feed row, OpsTimeline (two lanes), StudioDrawer (job workspace), TechnicianDrawer.
- **Key interactions (one-tap):** tap a waiting car → Job Workspace drawer; **advance status** inline on the bay card (Received → In progress → QC → Ready → Delivered) with a single confirm only at Delivered-with-balance; assign/reassign a tech from the bay card; "New walk-in" → intake drawer. Late jobs color their remaining-time (warning < 15m, danger 15m+).
- **Empty:** before opening / no jobs today → a calm "The day is clear. First car arrives at 10:00." with the schedule preview and "New walk-in".
- **Loading:** the board skeletons the capacity bar + bay cards (structure-only, no shimmer theatre); realtime fills in.
- **Errors:** listener drop → a persistent inline banner "Reconnecting…" with last-updated time; the board keeps showing last-known state (never blank).
- **Mobile:** the columns stack (Queue → Bays → QC/Ready → Tech → Feed); the capacity strip stays sticky at top; drawers are bottom sheets; the timeline scrolls horizontally.
- **Tablet (floor):** touch-tuned targets (≥ 44); landscape shows queue+bays side by side; kiosk actor shown in the top bar; this is the always-on device.
- **Desktop:** three columns + persistent rail; keyboard: `n` new walk-in, `/` search, ⌘K palette.
- **Motion:** feed rows *rise*-in (200ms, once); status advance = the occupant chip crossfades to the next state + a success tick (120ms); drawer slides from the right (200ms). Realtime updates never jump the scroll.
- **Accessibility:** each bay card is a labelled region announcing occupant + state + remaining time; status advance is a labelled button; the feed is a live region (polite); color-coded lateness is paired with a "late 12m" label.

## D2 · JOB WORKSPACE — drawer over the board (deep-link `/admin/jobs/[id]`)
- **Purpose:** everything about one car-in-care in a single scroll, without leaving the board: identity, service items, status, assignees, photos, notes, payment, delivery.
- **Layout (drawer 640):** header (customer · vehicle · plate · booking source · current status pill · close) → **status stepper** (checked_in → in_progress → quality_check → ready_for_delivery → delivered) with the next step as the primary action → **service items** (name · category · price · membership-wash badge) → **assignments** (lead + assist, add/remove) → **photos** (capture: before/during/after, grid, add) → **notes** (timestamped, per-actor) → **payment** (amount, method, status; collect) → sticky action bar (advance status / collect payment / deliver).
- **Hierarchy:** current status + next action (top) → the work → the evidence → the money.
- **Components:** status stepper, service-item rows, AssignmentControl, PhotoGrid + Camera, NoteList, PaymentControl, sticky action bar.
- **Interactions:** one tap advances status; camera opens for capture (before/after by act); assign from a searchable employee list; collect payment (cash/UPI, UPI needs reference); **deliver** requires the confirm dialog only when a balance is due (owner/kiosk override, attributed).
- **Empty/Loading/Errors:** a job always has data; photo section empty → "No photos yet — capture the arrival." ; save failure → inline retry, never lose the note.
- **Responsive:** drawer (desktop/tablet-landscape) → bottom sheet (mobile/portrait); the sticky action bar persists above the keyboard/safe area.
- **Motion:** slide-in 200ms; status tick 120ms; photo add fades in.
- **Accessibility:** stepper is an ordered list with the current step marked; camera control labelled; payment amount is mono and announced.

## D3 · SCHEDULE — `/admin/schedule`
- **Purpose:** see and place work across the two bays over time (resource calendar).
- **Layout:** day/week toggle → two resource lanes (Wash, Protection) with time on the vertical axis → booking blocks (customer · service · duration) → capacity/blocked overlays. A side "unscheduled/pending" list to drag or assign.
- **Interactions:** click a slot → new booking/intake; click a block → booking detail drawer; drag to reschedule (with confirm if it moves a confirmed booking). Full days show as blocked.
- **Empty/Loading:** "No bookings this day." + New. Loading skeletons the lanes.
- **Responsive:** desktop = week grid; tablet = day grid; mobile = a vertical agenda list per bay (drag replaced by an edit action).
- **Motion:** blocks *rise* in; drag uses a 1:1 ghost; snap on drop.
- **Accessibility:** blocks are buttons with full labels (time · bay · customer · service); keyboard move via a reschedule dialog.

## D4 · BOOKINGS — `/admin/bookings` (+ detail `/[id]`)
- **Purpose:** the full ledger of bookings across time (past + future), searchable and filterable.
- **Layout:** filter bar (All · Today · Upcoming · Completed · Cancelled · date range · search) → table (Customer · Vehicle · Service · Date/Time · Amount · Payment · Status). Row → **Booking Detail drawer**.
- **Booking Detail:** customer/vehicle, service + price breakdown, schedule, source (customer app / walk-in / manual), payment, status timeline, actions (confirm, reschedule, cancel, convert to job / check-in, message customer).
- **Empty:** "No bookings match." with a clear-filters action. **Loading:** table skeleton rows. **Errors:** row-level retry.
- **Responsive:** desktop table; mobile = stacked cards (identity + status + amount) → full-sheet detail; sticky identity column on tablet scroll.
- **Motion:** row hover 120ms; drawer 200ms.
- **Accessibility:** sortable columns announced; status pills paired with text.

## D5 · CUSTOMERS — `/admin/customers` (+ Customer 360 `/[id]`)
- **Purpose:** the CRM ledger and the single customer view.
- **List layout:** search + tag filter → table (Name · Phone · Vehicles · Visits · Lifetime value · Last seen · Tags). Row → Customer 360.
- **Customer 360:** header (name · phone · WhatsApp · tags · lifetime value) → **vehicles** (each links to Vehicle profile) → **visit history** (bookings/jobs) → **memberships** → **invoices/payments** → **notes** (admin-only) → actions (message, add note, add vehicle, new booking).
- **Hierarchy:** who they are → what they own → what they've done → what they owe/hold.
- **Empty/Loading/Errors:** "No customers yet." ; skeleton; inline retry.
- **Responsive:** 360 becomes a single scroll with collapsible sections on mobile.
- **Motion:** section expand 200ms.
- **Accessibility:** each section is a landmark; notes are marked admin-only.

## D6 · VEHICLE PROFILE & TIMELINE — `/admin/vehicles/[reg]`
- **Purpose:** the shop-side digital twin — identity + full care timeline (the staff mirror of the customer's Vehicle/Passport).
- **Layout:** header (make/model/year · plate · owner · derived protection state) → **timeline** (every job/visit, newest first: date · service · tech · photos · amount) → **active protections** (with warranty/expiry, derived from completed jobs × catalog warranties) → documents/invoices → actions (new booking, add note).
- **Hierarchy:** identity → history → what protects it now.
- **Empty:** "No visits yet for this vehicle." **Loading:** skeleton timeline. **Errors:** retry.
- **Responsive:** timeline collapses to a compact list on mobile; photos become a horizontal strip.
- **Motion:** timeline entries *rise* in.
- **Accessibility:** timeline is an ordered list; protection state paired with words + dates.

## D7 · SERVICES (Settings) — `/admin/settings`
- **Purpose:** the service catalog + pricing (PPF, Ceramic, Detailing/Coating, Washing) and business settings.
- **Layout:** tabs or sections by category (PPF · Ceramic · Detailing · Wash) → per service: name · brand · price · duration · warranty · active toggle · popular flag · order. **Inline-editable** table (price/duration edit in place). Plus business settings (hours, bays/capacity, tax, studio profile).
- **Interactions:** inline edit with autosave-on-blur for catalog fields; drag to reorder; toggle active. Money-affecting changes are logged (audit).
- **Empty/Loading/Errors:** "No services in this category — add one." ; skeleton; inline validation.
- **Responsive:** table → stacked editable cards on mobile.
- **Motion:** inline edit expands the cell 120ms; save tick.
- **Accessibility:** each editable cell is a labelled input; reorder has a keyboard alternative.

## D8 · INVENTORY — `/admin/inventory` (+ Recipes `/recipes`)
- **Purpose:** stock levels, consumption, and the recipe mapping (which products a service deducts).
- **Layout:** filter (All · Low · Out · category · search) → table (Product · SKU · Category · On-hand · Unit · Reorder point · Status · Last movement). Low/Out rows carry a warning/danger left-rule. **Recipes**: per service, the products + quantities it consumes (drives auto-deduction on job completion).
- **Interactions:** inline adjust on-hand (stock refill/correction, logged); set reorder point; a "low stock" inline banner at top with a jump. Recipe editing maps service → products × qty.
- **Empty/Loading/Errors:** "No products yet." ; skeleton; adjust failures inline.
- **Responsive:** desktop table; mobile stacked cards with the status rule prominent.
- **Motion:** stock change animates the number (no count-up theatre — a single crossfade).
- **Accessibility:** status paired with words; adjustments announced.

## D9 · INVOICES — `/admin/invoices`
- **Purpose:** every invoice, its state, and payment.
- **Layout:** filter (All · Draft · Paid · Unpaid · date · search) → table (Invoice # · Customer · Vehicle · Amount · Method · Status · Date). Row → invoice detail (line items, taxes, discounts, payment, link to job/booking; actions: mark paid, void with reason, resend/share, download).
- **Hierarchy:** unpaid/overdue surface first (a top banner counts them).
- **Empty/Loading/Errors:** "No invoices match." ; skeleton; void requires a dialog + reason.
- **Responsive:** stacked cards on mobile with amount + status prominent.
- **Motion:** mark-paid → row status crossfades to success + tick.
- **Accessibility:** amounts mono + announced; void is a confirmed, reasoned action.

## D10 · EXPENSES — `/admin/expenses`
- **Purpose:** record and categorize outgoings for the daily close and reports.
- **Layout:** "Add expense" (drawer: amount · category · method · note · date · optional receipt photo) → table (Date · Category · Amount · Method · Note · Added by). Filters by category/date.
- **Empty/Loading/Errors:** "No expenses recorded." ; skeleton; add validated.
- **Responsive:** add as bottom sheet; table → cards.
- **Motion:** new expense *rise*-ins at top.
- **Accessibility:** amount mono; added-by attributed.

## D11 · DAILY CLOSE — `/admin/close`
- **Purpose:** the end-of-day ritual — reconcile cash/UPI against jobs & invoices, record the close, lock the day. (Owner/manager.)
- **Layout:** a guided single screen: expected vs counted (cash, UPI) → unpaid/pending flags (jobs delivered without payment, unverified UPI) → expenses of the day → net → **confirm close** (dialog; reopening a closed shift is an owner override, logged).
- **Hierarchy:** discrepancies first; you cannot calmly close over an unresolved flag without acknowledging it.
- **Empty/Loading/Errors:** if nothing to close → "Nothing to reconcile today." ; a discrepancy shows a danger banner with a jump to the offending job/invoice.
- **Responsive:** a vertical guided flow on all sizes; confirm always reachable.
- **Motion:** section-to-section 200ms; the final confirm draws a success state.
- **Accessibility:** each reconcile field labelled; the close is a confirmed, attributed action.

## D12 · MEMBERSHIPS — `/admin/subscriptions`
- **Purpose:** manage Club memberships — verify pending joins, track wash credits, renewals.
- **Layout:** filter (Pending · Active · Expiring · Lapsed) → table (Customer · Tier · Since · Washes used/total · Renews · Status · Payment). **Pending** rows surface first (verify → activate). Row → membership detail (history, credits ledger, actions: verify, activate, adjust credits, cancel).
- **Empty/Loading/Errors:** "No memberships." ; skeleton; verify is a confirmed action.
- **Responsive:** cards on mobile; pending prominent.
- **Motion:** verify → status crossfades to active + tick.
- **Accessibility:** credit counts mono; status paired with words.

## D13 · EMPLOYEES — `/admin/employees` (+ detail `/[id]`)
- **Purpose:** the team roster, roles, and per-person detail.
- **Layout:** table (Name · Role · Phone · Status today · Jobs done (period) · Attendance %). Row → employee detail (profile, role, PIN/kiosk access, assignment history, attendance history, payroll summary if enabled).
- **Hierarchy:** who's on today → performance → admin.
- **Empty/Loading/Errors:** "No employees yet — add your first." ; skeleton.
- **Responsive:** cards on mobile.
- **Motion:** detail drawer 200ms.
- **Accessibility:** role and status labelled; PIN never displayed in plain text.

## D14 · ATTENDANCE — `/admin/attendance`
- **Purpose:** today's shifts — clock in/out, breaks, presence — plus history.
- **Layout:** today view: each employee row (status · clock-in · break · hours) with clock/break actions (on the shared tablet these are the employee's self-actions via kiosk). History tab: date range table. Leave/off shown inline (leave & calendar are lightweight here; a dedicated leave workflow is a future addition, not a current module).
- **Empty/Loading/Errors:** "No one clocked in yet." ; skeleton.
- **Responsive:** the today view is touch-first (big clock buttons on tablet); history is a table → cards on mobile.
- **Motion:** clock action → status crossfade + tick.
- **Accessibility:** clock buttons labelled; times mono.

## D15 · GALLERY — `/admin/gallery`
- **Purpose:** the studio's work photography, organized by job/date, for QC, records, and marketing selection.
- **Layout:** date/job filter → responsive photo grid; tap → lightbox (job context, before/after, tags). Select multiple → export/share to the customer's chapter (feeds the customer app's evidence chain).
- **Empty/Loading/Errors:** "No photos for this day." ; grid skeleton; failed loads show a retry tile (never a broken image).
- **Responsive:** grid columns scale (2 mobile → 6 ultra-wide); lightbox full-screen on mobile.
- **Motion:** thumbnails fade in on load; lightbox scales from the thumbnail.
- **Accessibility:** every photo has job-context alt; lightbox is keyboard-navigable (←/→, Esc).

## D16 · OFFICE DASHBOARD — `/admin/office`
- **Purpose:** the manager/owner's at-a-glance business health (money, throughput, alerts) — the Office home.
- **Layout:** KPI tile row (today's revenue · jobs done · avg ticket · unpaid count — big number + delta) → alerts (unverified payments, low stock, open shift) → mini charts (revenue trend, jobs by service) → quick links (Close, Invoices, Reports).
- **Hierarchy:** money today → things needing attention → trends.
- **Empty/Loading/Errors:** first-run → "Your first day's numbers will appear here." ; KPI skeletons; a failed metric shows "—" not a crash.
- **Responsive:** KPI tiles wrap 4→2→1; charts stack.
- **Motion:** KPIs crossfade to new values (no count-up); *rise* on alerts.
- **Accessibility:** each KPI is a labelled figure with its delta; charts have table fallbacks.

## D17 · REPORTS / ANALYTICS — `/admin/reports`
- **Purpose:** deeper analysis — revenue, services mix, technician throughput, membership, retention.
- **Layout:** date-range + dimension controls → a set of chart cards (trend, composition, leaderboard) each with an underlying table + export.
- **Hierarchy:** headline trend → breakdowns → per-entity leaderboards.
- **Empty/Loading/Errors:** "Not enough data for this range." ; chart skeletons; a broken series degrades to its table.
- **Responsive:** charts stack; tables scroll with sticky headers.
- **Motion:** chart draw-in 280ms (once); reduced-motion → static.
- **Accessibility:** every chart has a labelled table equivalent and text summary of the headline.

## D18 · QUOTES — `/admin/quotes` · PROMOS — `/admin/promos` · CARS — `/admin/cars(+/leads)`
- **Quotes:** requested/sent/accepted quotes (for size-priced services like PPF); table + detail drawer; convert to booking. Empty "No quotes." 
- **Promos:** discount codes/campaigns; table (code · type · value · window · redemptions · active); create/edit drawer. Empty "No promos."
- **Cars marketplace + leads:** the used-car business line — listings + inbound leads (the twin-powered listing); table + detail. Out of the core service loop but part of Office.
- All follow the shared table + drawer + status patterns; each: purpose, table, detail drawer, empty/loading/errors, responsive cards on mobile.

## D19 · WALK-IN INTAKE — `/admin/walkin` (drawer over the board)
- **Purpose:** the fastest path from "a car just arrived" to a live job — minimal fields, maximum speed.
- **Layout (drawer):** plate (with lookup → prefill known vehicle/customer) → customer (new or matched) → service(s) → assign bay/tech (optional) → create → the job appears on the board **Received**.
- **Hierarchy:** plate first (it resolves everything); everything else defaults.
- **Interactions:** plate lookup prefills; one "Create & check in" primary; membership auto-detected (wash credit).
- **Empty/Errors:** unknown plate → inline "New vehicle" mini-form; validation inline.
- **Responsive:** bottom sheet on the tablet/mobile.
- **Motion:** on create, the drawer closes and the new queue/bay card *rise*-ins on the board.
- **Accessibility:** plate field autofocused; the whole flow is keyboard/enter-completable.

## D20 · GLOBAL SEARCH & COMMAND PALETTE (⌘K)
- **Purpose:** the fastest navigation + action surface for managers/owners.
- **Layout:** centered overlay (`shadow-lg`), search field, grouped results (Go to · Quick actions · [future] entities), keyboard hints.
- **Behavior:** fuzzy match; ↑↓/⏎/Esc; role-filtered; recents on top; quick actions (New walk-in, Start daily close, Add expense, Office, Sign out). Future: jump to any customer/vehicle/invoice by name/plate/number.
- **Empty/Loading:** "No matches." ; instant (local).
- **Responsive:** full-screen sheet on mobile.
- **Motion:** scale-in 120ms; result selection has no motion (speed).
- **Accessibility:** combobox semantics; focus trapped; every result is a labelled option.

## D21 · SETTINGS: PERMISSIONS · ROLES · AUDIT LOGS · NOTIFICATIONS
These are settings surfaces (owner), grounded in the real permission model:
- **Roles & Permissions:** a read-first view of the matrix (owner/admin · technician · kiosk) — what each role may access (Studio vs Office, finance, pricing, overrides). Editable where the business allows (e.g., which employees get kiosk PINs). Presented as a clear grid (role × capability), not free-form ACLs.
- **Audit Logs:** the attributed action stream — status advances, payments, voids, overrides, shift reopens, price changes — filterable by actor/date/type. Every money-moving or override action appears here (this is how attribution becomes trust). Table + detail; export.
- **Notifications:** operational push/notify configuration (the cron/notify/whatsapp rails) — which events notify whom (e.g., low-stock to owner, ready-for-delivery to the desk). Sentence-style toggles.
- Each: purpose, grid/table layout, empty/loading/errors, responsive (grid → stacked), motion (minimal), accessibility (real tables/grids, labelled toggles).

---

# PART E — OPERATIONAL FLOWS (click-minimized)

Each flow lists the **happy path** with the target number of deliberate actions. The design goal: the floor's common flows are 1–2 taps; money/irreversible steps add exactly one confirm.

1. **Customer arrives (appointment):** Board shows them in the waiting queue (auto, from the booking). → *0 actions to see them.*
2. **Vehicle check-in:** tap the waiting card → "Check in" (or Walk-in drawer for an unknown car: plate → prefill → Create & check in). → *1–2 actions.* Job created **Received**; membership wash auto-detected.
3. **Job creation (walk-in):** plate lookup → defaults → Create & check in. → *1 action after plate.*
4. **Employee assignment:** on the bay/job card → Assign → pick tech (searchable) → done; reassign the same way. Kiosk attributes to the unlocked actor. → *2 actions.*
5. **Photo capture:** job workspace → Camera → shoot (before/during/after auto-tagged by current act) → auto-saved to Gallery + the vehicle timeline. → *1 action per photo.*
6. **Quality control:** advance In progress → **Quality check** (one tap) → QC checklist optional → advance to Ready. → *1–2 actions.*
7. **Invoice:** generated from the job's service items (draft) on completion; adjust line items inline if needed. → *0 actions default.*
8. **Payment:** job workspace → Collect → method (cash/UPI; UPI requires reference) → Paid. → *2 actions.*
9. **Delivery:** advance Ready → **Delivered**; if a balance is due, a confirm dialog (owner/kiosk override, attributed) — otherwise one tap. → *1 action (+1 confirm if unpaid).*
10. **Membership purchase:** customer app join → **pending** → Office › Memberships surfaces it → Verify → Active. → *1 action (verify).* Or in-studio: create membership in the customer's 360.
11. **Inventory deduction:** automatic on job completion via the service's recipe (product × qty). → *0 actions.* Manual correction is an inline adjust (logged).
12. **Stock refill:** Inventory → inline adjust on-hand (or a refill entry) → logged; low-stock banner clears. → *1 action.*
13. **Supplier ordering:** (future module — see J) today, low-stock is surfaced as a banner + a manual refill; a purchase-order workflow is a planned Warehouse addition, not a current fake feature.
14. **Refund:** Invoice detail → Refund → dialog (reason + amount) → recorded (adjusts close/reports). → *1 action + confirm.*
15. **Cancellation:** Booking/Job → Cancel → dialog (reason) → status Cancelled; no job/inventory side effects if pre-check-in. → *1 action + confirm.*
16. **Reschedule:** Booking detail or Schedule drag → new slot → confirm if it moves a confirmed booking (customer is notified via the notify rail). → *1–2 actions.*

**Cross-cutting rules:** every state-changing action is attributed (actor) and, when money-moving or irreversible, confirmed once and audit-logged. Nothing on the floor blocks on an Office concern except the deliberate unpaid-delivery override.

---

# PART F — COMPONENT LIBRARY (staff)

Each: purpose + exact behavior. (Visual specs in Part B.)

- **AppShell** — sidebar (mode-grouped, role-filtered, collapsible) + top bar (title, search, mode indicator, contextual primary, actor chip) + content + drawer host. Remembers scroll per page within a workflow.
- **CommandPalette** — ⌘K fuzzy nav + actions + (future) entities; role-filtered; keyboard-complete; recents.
- **DataTable** — sticky header, sortable, density toggle, row-tap → detail, overflow actions, bulk-select bar, sticky identity column on mobile, empty/loading/error states, CSV export.
- **FilterBar** — segmented status chips + date range + search; active filters as removable pills; persists per table.
- **StatusToken** — dot / left-rule / pill; the canonical vocabularies (B17); always word-paired.
- **Drawer** — right (desktop) / bottom sheet (mobile); header + scroll body + sticky action bar; backdrop; ⌘/Esc/drag dismiss.
- **ConfirmDialog** — irreversible/money-moving only; title + one sentence + cancel/confirm (destructive tinted).
- **Field / Form** — labeled inputs on `dim`; inline-editable table cells; ₹-mono money inputs; blur+submit validation; autosave where safe.
- **KpiTile** — big mono number + label + delta (▲/▼ with success/danger), optional sparkline; crossfades on update.
- **Chart** — monochrome-first line/bar/stacked/sparkline; tooltip card; table fallback; reduced-motion static.
- **BayCard** — occupant, service, elapsed/remaining (late-colored), tech, inline status advance + assign.
- **QueueCard** — auto-prioritized waiting entry; tap → workspace.
- **TechChip / TechnicianDrawer** — status (working/break/idle), ETA, jobs-done; tap for detail/assign.
- **FeedRow** — realtime event (time · actor · event); live region.
- **OpsTimeline** — two resource lanes (wash/protection) with bookings + live work; drag on Schedule.
- **StatusStepper** — the job lifecycle; current step marked; next step = primary action.
- **PhotoGrid + Camera + Lightbox** — capture (act-tagged), grid, full-screen viewer; feeds Gallery + customer chapter.
- **AssignmentControl** — lead/assist add/remove from a searchable employee list; attributed.
- **PaymentControl** — amount (mono), method (cash/UPI+reference), collect → status.
- **Toast / InlineAlert / Banner** — action confirmation / persistent condition; status-ruled; queued.
- **KioskLock / ActorChip** — PIN unlock screen (/store), actor attribution, auto-relock timer.
- **AuditRow** — attributed action entry (actor · time · action · target · reason); filterable.

---

# PART G — MOTION SYSTEM (staff)

Operational motion is quick and certain — nothing lingers, nothing entertains.

| Interaction | Motion | Duration | Curve | Reduced-motion |
|---|---|---|---|---|
| Row / control hover | ground shift to `dark` | 120ms | studio ease | none |
| Press | opacity/scale settle | 120ms | studio ease | none |
| Toggle / status advance | crossfade to next state + success tick | 120ms | studio ease | instant swap, tick appears complete |
| Drawer open/close | slide from right / up + backdrop fade | 200ms | studio ease + spring on drag | fade only; spring kept (input) |
| Dialog | scale-in from 0.98 + backdrop | 200ms | studio ease | fade only |
| Command palette | scale-in from 0.98 | 120ms | studio ease | fade only |
| Table row expand / inline edit | height + fade | 200ms | studio ease | instant |
| Section / page change | crossfade + 4pt rise | 280ms | studio ease | crossfade only |
| Feed row arrival | rise + fade, once | 200ms | studio ease | fade only |
| KPI value change | crossfade (never count-up) | 200ms | studio ease | instant |
| Chart draw-in | path/bar reveal, once | 280ms | studio ease | static |
| Selection (bulk) | checkbox + bottom bar slide-up | 200ms | studio ease | instant |
| Realtime board update | in-place crossfade, never scroll jump | 120ms | studio ease | instant |

Banned: loops, shimmer, decorative parallax/gradients, count-up numbers, anything > 280ms. Reduced-motion (OS) disables all transform/reveal, keeps opacity and input physics.

---

# PART H — RESPONSIVE BEHAVIOUR

- **Ultra-wide (≥ 1600) — owner cockpit / big floor screen:** sidebar expanded; Studio Board gains a persistent right column (Feed + Tech rail); Office supports two-pane list+detail (no drawer needed); content max-width caps so lines don't run; tables show more columns.
- **Desktop (1200–1599):** expanded sidebar; details as right drawers over context; full tables; ⌘K primary nav.
- **Tablet (720–1199) — the floor device:** sidebar → icon rail / hamburger; the Studio Board is touch-tuned (≥ 44 targets), landscape = queue+bays side by side, portrait = stacked; drawers = right (landscape) / bottom sheet (portrait); **kiosk mode** lives here (PIN unlock, actor chip, auto-relock).
- **Mobile (< 720) — manager's pocket:** hamburger drawer + bottom tab bar (top Studio destinations for technicians); tables → stacked identity cards or horizontal scroll with a sticky identity column; details → full bottom sheets; the board stacks its columns with a sticky capacity strip.

Cross-cutting: touch targets grow on the floor tablet; scroll position is remembered per page within a workflow; the primary action is always reachable (sticky) regardless of viewport.

---

# PART I — ACCESSIBILITY

- **Keyboard:** everything operable without a mouse — ⌘K palette, table sort/select, drawer open/close (Esc), inline edit (Enter/Esc), status advance, form submit. Logical tab order; visible focus everywhere.
- **Focus:** 2pt ring at chrome @ 70%, 2pt offset, on the deepest control; focus is trapped in drawers/dialogs/palette and restored to the invoker on close.
- **Screen readers:** real semantic tables (headers, scope), landmarks per section, live regions for the studio feed and status changes (polite), labelled buttons for every icon-only control, an ordered-list status stepper, and table fallbacks + text summaries for every chart.
- **Touch targets:** ≥ 40 general, ≥ 44 on the floor tablet (check-in, status advance, clock, camera).
- **Contrast:** tuned for the dark ramp — chrome/silver on cavern/deep pass AA for text; status colors are used at sizes/weights that pass, and are **always paired with a word** (never color-alone); steel used only at ≥ 12pt.
- **Attribution & clarity:** the actor is always visible (kiosk chip); PINs never shown; destructive actions are labelled, confirmed, and reasoned.
- **No dark-pattern urgency:** operational alerts state facts and a next action; nothing manufactures pressure.

---

# PART J — FUTURE EXPANSION

The architecture grows by adding **parties, locations, and object types** — never by rebuilding the shell. Each below is a placement, not a promise:

- **Multi-branch / HQ:** a `branch` scope on the shell — a branch switcher in the top bar; the Studio Board, Schedule, Inventory, Reports all filter by branch; HQ is a role that sees an all-branch roll-up (a Reports/Office aggregation), with per-branch drill-down. The board/table components are reused with a branch dimension.
- **Franchise:** franchisee = a branch with a restricted Office (their own money, not HQ's); the permission grid gains a franchise role; audit + close are per-branch; HQ sees consolidated reports and standards compliance.
- **Warehouse / Purchase Orders:** Inventory grows a **Suppliers** entity and a **Purchase Order** workflow (draft → sent → received → stock-in), plus reorder automation off the existing reorder points. Slots into the WAREHOUSE group; recipes and auto-deduction already exist to feed it.
- **Fleet customers:** a customer that is an organization owning many vehicles — the Customer 360 becomes a fleet view (roll-up + per-vehicle), bulk booking, consolidated invoicing/terms; reuses the customer/vehicle/booking graph with a party-group.
- **Insurance partners:** insurance-claim jobs as a **Job kind** with claim metadata + partner billing; the Vehicle timeline and Records already hold the evidence chain claims need; a partner role with scoped access to relevant jobs/photos.
- **OEM integrations:** vehicle-data / warranty lookups feeding the Vehicle profile (VIN decode, service intervals) and the customer twin; enters as read integrations on the Vehicle profile and as Signals on the shared vehicle model — no new top-level surface.

**Growth law (staff side):** a new capability lands as a new object type, a new party/role, or a new branch dimension on existing components — and appears as at most one new nav item in its mode group. If it needs a third mode or a parallel app, the model is wrong. Anything shipped must be **true** (real data/workflow) and **operational** (reduces effort), never a placeholder destination.

---

*End of specification. Design only — no implementation, no code, no commits. Awaiting review.*
