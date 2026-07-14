# AutoModz - Growth & Feature Roadmap

Market scan: premium detailing studios globally (Detailing World, AutoNation aesthetics tiers,
US ceramic-coating franchises) monetize **repeat protection cycles + memberships**, while Indian
metro studios win on **trust signals + convenience** (pickup/drop, WhatsApp-first comms).
The features below are ranked by impact for a single-location Maninagar studio, all achievable
on the current free stack (Next.js + Firebase free tier + Cloudinary + FCM).

## Tier 1 - revenue drivers (build next)

| Feature | Why it wins locally |
|---|---|
| **Protection expiry tracker** | Ceramic (12–18 mo) and PPF warranty dates per vehicle → automated "reapplication due" push/WhatsApp. Turns one-time coating jobs into cycles. |
| ~~**Pickup & drop scheduling**~~ ✅ SHIPPED (July 2026) | Separate ₹50 pickup / ₹50 drop legs, either or both, at booking review. |
| **Festive packages** | Navratri/Diwali pre-booking rush: limited "Festival Glow" packages with countdown UI. Pre-paid slots smooth the seasonal spike. |
| **Loyalty tiers (Silver/Gold/Obsidian)** | Points ledger on every invoice; tiers unlock member pricing. Cheap to build - computed from existing invoices. |
| **Gift vouchers** | Detailing gift cards (birthday/anniversary) with shareable code - new-customer acquisition at zero CAC. |

## Tier 2 - trust & experience

- **Before/after reveal slider** on completed jobs (photos already captured) - the single best social-share artifact a studio has.
- **Pre-existing damage sign-off**: photo-document scratches/dents at intake, customer confirms on the kiosk → liability protection + professionalism signal.
- **Car health timeline**: paint depth notes, coating layers, service cadence per vehicle - "your car's medical record."
- **Video testimonials + 360° turntable** of delivered cars on the landing page.
- **Monsoon mode**: rain-aware rebooking nudges + underbody/anti-rust seasonal upsell (June–Sept Ahmedabad).

## Tier 3 - ops depth

- **Bay/queue board with live ETA** per job on the iPad (drag between bays; customers see "your car is in Bay 2 - 40 min left").
- **True margin per job**: consumable recipes already decrement inventory - surface cost-per-job vs. price in reports.
- **Employee scorecards**: jobs/day, average duration vs. standard, rework flags → feeds incentive pay (payroll math already modular).
- **Expense ledger** (rent, utilities, equipment) to complete the monthly P&L beyond payroll + inventory.
- **Low-stock auto-reorder list** with supplier contacts and last-price memory.
- **Customer LTV / churn view**: last-visit age buckets with one-tap win-back promo send.

## Shipped July 2026 (formerly "next wave")
- ✅ Booking reschedule - customer (history sheet, 4-hour rule, live slot availability) + admin (drawer date/time with customer notification)
- ✅ Membership cancel (customer self-service, confirm step; rules allow owner status→cancelled only)
- ✅ Forgot-password reset link on login
- ✅ Split pickup/drop fees; pickup address now shown on the admin drawer

## Platform hygiene

- Deploy hardened `firestore.rules` (July 2026 revision - blocks self-role-escalation).
- Add Firebase App Check (free) to blunt scripted abuse of public endpoints.
- Lighthouse pass on `/` after theme v5 (target ≥90 mobile).
