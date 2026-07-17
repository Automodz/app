# AutoModz - Information Architecture & UX Cleanup

_Last updated: 2026-07-17 · commit `df1dd0e`_

## 1. The model: three operating modes, one platform

AutoModz is one codebase presenting **three operating systems**, each with its own chrome, entry point, and mental model. Nothing is "a page inside" another mode.

| Mode | Who | Entry | Chrome | Theme |
|---|---|---|---|---|
| **Admin OS** (`/admin`) | Owner / manager | Google sign-in → role `admin` | Sidebar + top bar + ⌘K palette | Always dark |
| **Front Desk OS** (`/store`) | Reception / floor staff | Manager: instant (no PIN). Staff: PIN pad on the shared kiosk, or personal sign-in on their own phone | Single top strip: Floor · Check-In · Attendance | Always dark |
| **Customer App** (`/dashboard`, plus `/`, `/cars`, `/invoice/[id]`) | Car owners | Google sign-in → role `user` | Consumer app shell | Light-first |

**Mode switching** (managers only) is a first-class control, Shopify-Admin style:

- Admin sidebar, top: segmented **ADMIN | FRONT DESK** switch.
- Front Desk header, right: **Admin** button (mirror of the above).
- ⌘K: "Switch to Front Desk".
- Staff never see the switch - the role-visibility law (no staff/admin controls on customer surfaces, no admin controls on staff surfaces) holds everywhere.

### Front Desk session model

- **Kiosk (shared tablet):** rides on the owner's admin session; individual identity comes from the PIN pad; auto-relocks after inactivity; lock and exit controls in the header.
- **Personal (employee phone):** employee's own sign-in; no PIN, no kiosk lock; lands straight on the Floor.
- **Manager:** any admin session enters instantly and can flip back to Admin without confirmation.

## 2. What each mode owns (task → exactly one place)

### Admin OS - decisions and records
| Task | Place |
|---|---|
| Run the day (intelligence, approvals, follow-ups, arrivals, live floor) | `/admin` Workspace - the landing page |
| Plan capacity | `/admin/schedule` |
| Manage a booking / approve / check-in | `/admin/bookings/[id]` |
| Quotes | `/admin/quotes` |
| Leads / customers / memberships | `/admin/cars/leads`, `/admin/customers`, `/admin/subscriptions` |
| Money: invoices, expenses, daily close, reports | `/admin/invoices`, `/admin/expenses`, `/admin/close`, `/admin/reports` |
| Inventory | `/admin/inventory` |
| Team records + PINs | `/admin/employees` |
| Marketing: promos, gallery, marketplace | `/admin/promos`, `/admin/gallery`, `/admin/cars` |
| Service catalogue | `/admin/settings` |
| Vehicle history (Vehicle 360) | `/admin/vehicles/[reg]` - reached by tapping a reg no, never from nav |

### Front Desk OS - the day's physical flow
| Task | Place |
|---|---|
| See the live floor (kanban: checked-in → in progress → QC → ready) | `/store/board` |
| Today's arrivals (booked cars not yet in) | `/store/board` rail → tap-through to booking check-in (admin sessions) |
| Walk-in / vehicle check-in | `/store/new` (shared `WalkInFlow`) |
| Advance a job, collect payment, deliver | `/store/job/[id]` |
| My shift + team attendance | `/store/board` rail (self) · `/store/attendance` (team) |
| Payments pending | `/store/board` rail counter → ready-column cards |
| Daily close | Rail shortcut → `/admin/close` (admin-session only - money stays an owner action) |

### Customer App - the owner's car, not the business
Booking, live job tracking, garage, membership, invoices, marketplace browsing. No staff affordances anywhere.

## 3. Shared logic (write once, render per mode)

| Capability | Single source | Consumed by |
|---|---|---|
| Walk-in intake | `components/intake/WalkInFlow.tsx` | `/store/new`, `/admin/walkin` |
| Live today's-jobs stream | `subscribeTodaysJobs` (`lib/firebaseService`) | Admin Workspace (list), Front Desk board (kanban) |
| Today's arrivals | `getBookingsForDates` | Admin Workspace, Front Desk rail |
| Job operational workspace parts | `components/workspace/parts.tsx` | `/admin/bookings/[id]`, `/admin/jobs/[id]` |
| Job card | `components/store/JobCard.tsx` | Front Desk board |
| PIN pad | `components/store/PinPad.tsx` | Front Desk lock screen |

The same data appears in two modes only when the **presentation intent differs** (owner scans a list; desk works a kanban). The logic never forks.

## 4. IA audit - deduplication log

Consolidations that were already in place (kept, verified):
- `/admin/workspace` → redirect to `/admin` (Workspace **is** the admin landing page; stub kept for old links).
- `/admin/jobs` (Active Jobs listing) → redirect to `/admin` (the floor lives in the Workspace).
- Booking-linked jobs opened via `/admin/jobs/[id]` redirect into `/admin/bookings/[id]` - one workspace per car, ever.
- Walk-in intake is one component with two mode-appropriate entrances (no flow duplication).
- Attendance is **one page** (`/store/attendance`), owned by the Front Desk; the Admin nav's Team → Attendance entry is a cross-mode link, not a copy.

Changed in this pass:
- **"Store Mode" → "Front Desk"** across every user-visible string (header pill, lock screen, exit dialog, employees page); nav renamed to task language: *Job Board → Floor*, *New Job → Check-In*.
- Front Desk board picked up the three missing daily-ops duties (arrivals, payments-pending visibility, daily-close shortcut) by **reusing existing sources**, not new screens.
- Admin ⇄ Front Desk mode switch added (sidebar segment, header button, ⌘K).

Explicitly **not** removed, and why:
- `/store/job/[id]` vs job handling in `/admin/bookings/[id]`: different actors mid-task (technician advancing stages on a tablet vs owner managing the commercial record). Same services layer underneath.
- Redirect stubs (`/admin/workspace`, `/admin/jobs`): three lines each, keep old bookmarks alive.
- `/admin/vehicles/[reg]`: not nav-reachable by design; it is the drill-down target for any reg-no tap.

## 5. UX cleanup principles now encoded

1. **Modes, not pages.** Operational context switches are explicit and top-level; nobody "wanders" from Reports into the kiosk.
2. **One place per task.** Every row in §2 has exactly one home; everything else links there.
3. **Landing = work.** Each mode opens directly onto its primary job: Admin → Workspace, Front Desk → Floor, Customer → their garage/bookings.
4. **Role-visibility law.** Customer surfaces never render staff controls; staff surfaces never render admin-only money actions (daily close stays behind an admin session).
5. **Live by default on the floor.** Both floor views subscribe to the same real-time stream with auto-reconnect; no refresh buttons.
6. **Nav speaks task language.** "Floor", "Check-In", "Daily Close" - not collection names.
7. **Money is never hidden.** Outstanding balances surface in both operational modes; collection happens on the job, closing happens once, in Admin.

## 6. Route map (post-cleanup)

```
/                          Customer marketing homepage
/auth/login                Single sign-in, routes by role
/dashboard/**              Customer App
/cars/**                   Marketplace (customer-facing)
/invoice/[id]              Public invoice view

/admin                     Admin OS · Workspace (landing)
/admin/{schedule,bookings,quotes,customers,subscriptions,
        invoices,expenses,close,reports,inventory,employees,
        promos,gallery,cars,settings,walkin}
/admin/vehicles/[reg]      Vehicle 360 (drill-down only)
/admin/{workspace,jobs}    Redirect stubs → /admin

/store                     Front Desk OS · lock screen (kiosk PIN)
/store/board               Floor (landing for managers/personal)
/store/new                 Check-In (WalkInFlow)
/store/job/[id]            Job workspace (stage/payment/delivery)
/store/attendance          Team attendance
```
