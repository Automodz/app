# AUTOMODZ — PRODUCTION DESIGN AUDIT
### P2.D4 · Critical review of P2D1 (customer) + P2D2 (admin) + P2D3 (master) · design only

**Panel lens:** Apple HIG · Tesla UI · Linear · Stripe · Notion · Airbnb · Figma · Rivian · Nothing · Arc.
**Method:** the three specs are treated as the shipping product. Nothing is accepted because it exists. Every issue is categorized (Critical / High / Medium / Low / Cosmetic / Tech-debt / Future-debt) with why · user impact · business impact · recommended fix · why-best · effort (S ≤1d design, M ≤1wk, L >1wk / needs product decision). No redesign, no new features unless unavoidable. Brutally honest, and explicit where things are genuinely excellent.

---

## 1 · EXECUTIVE SUMMARY

This is a **rare, disciplined, opinionated product** with a coherent thesis (the car is the product; ownership over transactions) executed with Apple-grade restraint on the customer side and Linear/Stripe-grade operational clarity on the staff side. The token discipline, the single-truth-line model, booking-as-proposal, the five-act Stay, and the two-mode staff shell are genuinely top-tier design decisions.

It is **not, however, ready to ship as-is** — and the reasons are mostly *risk and contingency*, not craft. The customer experience makes three large bets that the current design under-insures: (1) it assumes **photography exists** when for most users, most of the time, it won't; (2) it assumes **the studio behaves** (posts floor photos, confirms visits promptly) for its most emotional moments; and (3) it assumes **trust already exists** for a first-time customer about to spend ₹1.45L. The staff app's biggest risk is the opposite of luxury: **destructive one-tap actions with no undo** on a shared, greasy-fingered floor tablet.

There is also a hard truth the specs don't foreground: **the design is ahead of the implementation.** The shipped customer login is still the legacy dark page, and the Stay / Chapter / Onboarding are specified but unbuilt. As *design documents* these specs are near-excellent; as a *product you can install tomorrow*, several flagship moments don't exist yet.

**Verdict: Needs polish (not redesign).** The vision and system are sound and should be protected. A focused set of pre-launch fixes — trust-at-first-use, dignified photo-less states, discoverability of the Desk/search, and an ops safety net (undo + advance confirmation) — moves this from "beautiful prototype" to "shippable premium product."

---

## 2 · OVERALL PRODUCT SCORE — **84 / 100**
A top-decile vision held back by contingency risk and a design-vs-implementation gap, not by craft.

## 3 · CUSTOMER APP SCORE — **82 / 100**
Visionary and restrained; loses points on photography dependency, first-use trust, and discoverability of anything not on the scroll.

## 4 · ADMIN APP SCORE — **85 / 100**
Excellent operational core (the Board is the best idea in either app); loses points on floor-safety (no undo / unconfirmed destructive advances), missing entity search at launch, and a two-bay layout that won't stretch to multi-branch.

## 5 · DESIGN SYSTEM SCORE — **90 / 100**
Exemplary token discipline and component budgets. Minor: two systems = double maintenance and a cross-system naming collision ("scene" = 480ms Studio vs 280ms Ops). The strongest part of the product.

## 6 · SCALABILITY SCORE — **80 / 100**
The object/twin model scales beautifully; the *interface* scales less well — the two-bay board, single-column story-at-50-visits, and multi-branch are acknowledged but undesigned. Future debt is honestly named, which is why this isn't lower.

## 7 · PRODUCTION READINESS SCORE — **84 / 100 (as design)** · **~62 / 100 (as shippable today)**
The gap is the point: the *specification* is launch-grade; the *built product* is missing flagship surfaces and still ships a contradictory login. Readiness must be scored twice or it misleads.

---

## 8 · TOP 25 ISSUES (ranked by impact)

### 1 · Photography dependency is existential — the photo-less state is the *default*, and it's cold — **Critical**
- **Why:** Portrait, Protection, Story, Chapter, and the Stay all lead with a car photo. For a new customer with no upload and no studio shot yet, the fallback is a near-black `stage` screen with a model name. That is the *first* impression for most users, not an edge case.
- **User impact:** the "premium ownership" promise opens on a black rectangle; feels empty, not luxurious.
- **Business impact:** weak first impression on the exact screen meant to convert emotion into loyalty; undercuts the whole thesis.
- **Fix:** design a **first-class typographic portrait** — not a fallback but a deliberate, beautiful "car identity plate" state (large model wordmark, plate in mono, a subtle graphite texture/vignette on stage, the studio's mark) that looks *intentional*; and make the "add a photo" invitation feel like a gift, not a chore. Additionally, auto-generate a dignified placeholder from make/model (silhouette-free, typographic) so no screen is ever a bare black box.
- **Why best:** you cannot guarantee photos, so the photo-*absent* state must be designed to the same bar as the photo-present one — that removes the dependency instead of hoping it away.
- **Effort:** M (design) — one new deliberate state across 3 components.

### 2 · Trust is assumed, not built — first-use has no credibility signals — **Critical (business)**
- **Why:** a first-time customer considering ₹1.45L PPF opens to their car photo + "Welcome to the studio" + a capsule. There is no studio identity, no proof of work, no reviews, no craftsmanship evidence *until they've already visited*.
- **User impact:** high-consideration purchase with no trust scaffolding; drop-off before booking.
- **Business impact:** directly suppresses conversion of new/high-value customers — the ones the ₹1.45L services depend on.
- **Fix:** a **restrained trust layer for the pre-first-visit state only** — the studio's finished-work photography (real, from Gallery), a one-line credential, the physical address/hours, and the honest Google-reviews link (which already exists on the marketing site). It disappears the moment the customer has their own story. No badges, no fake stats.
- **Why best:** trust is a first-visit problem; solving it *only* in the empty state keeps the owned-car experience pure while fixing the conversion gap.
- **Effort:** M — one conditional layer, reusing Gallery photography.

### 3 · Destructive ops actions are one tap with no undo, on a shared greasy tablet — **Critical (ops)**
- **Why:** the Studio Board advances job status inline with a confirm only at deliver-with-balance. On a wet, busy floor, accidental advances (QC before QC, "delivered" early) are near-certain; there is no Undo anywhere in the staff app.
- **User impact:** techs mis-advance jobs; the board lies about reality; managers lose trust in the data.
- **Business impact:** corrupted operational truth → wrong close, wrong reports, customer-facing errors (a car marked "ready" that isn't).
- **Fix:** add a **global Undo** (toast with "Undo", 5s) on every status/assignment change, and a **hold-to-confirm** (or a 1-tap-then-confirm micro-state) for backward-irreversible advances. Keep forward advances fast.
- **Why best:** Undo preserves floor speed (no upfront friction) while making mistakes recoverable — the Linear/Gmail pattern, proven for exactly this.
- **Effort:** M — one Undo toast pattern + a confirm micro-state on the stepper.

### 4 · Design is ahead of implementation — flagship moments don't exist yet, and the login contradicts the system — **Critical (readiness)**
- **Why:** the shipped customer login is the legacy dark page (contradicts Studio White); the Stay, Chapter, and Onboarding are specified but unbuilt.
- **User impact:** the app's most emotional surfaces (the Stay, the reveal, first-run) are absent; the first screen a user sees is off-brand.
- **Business impact:** "premium ownership" cannot be demonstrated because the moments that create it aren't there.
- **Fix:** treat P3 (Stay), P4 (Chapter), P7 (Onboarding + Studio White login) as **launch-blocking**, not "later roadmap." Sequence the login redesign first (cheapest, highest first-impression payoff).
- **Why best:** these aren't nice-to-haves; they are the product's differentiators. Launching without them ships the skeleton, not the animal.
- **Effort:** L — real implementation (out of design scope, but the design must acknowledge it as blocking).

### 5 · The Desk (Conversation) and search are undiscoverable to new users — **High**
- **Why:** the only path to booking-history recall, membership, and messaging is the Desk, reached by tapping the capsule (or an unlabelled long-press). Nothing tells a first-timer the capsule is the door to everything.
- **User impact:** users never find search, the Conversation, or how to reach the studio; they think the app "only shows my car."
- **Business impact:** lower engagement and self-serve; more inbound calls; the Conversation (a retention engine) goes unused.
- **Fix:** a **one-time, dismissible coach mark** on first Glance pointing at the capsule ("Tap here to reach the studio, book, or find anything"), plus make the resting capsule occasionally show an affordant hint ("Search · Book · Message"). Keep it a single first-run nudge — no persistent chrome.
- **Why best:** preserves the no-chrome aesthetic while solving the discoverability cliff; the cost is one coach mark, not a nav bar.
- **Effort:** S.

### 6 · No in-app notification history at launch (it "lives in WhatsApp") — **High**
- **Why:** the app deliberately has no inbox; history is "the thread," which at launch is WhatsApp. So a missed push is gone from the app entirely.
- **User impact:** "the studio said something and I can't find it"; a missed "ready for collection" has no in-app trace.
- **Business impact:** support load, missed collections, erosion of the calm-competence promise.
- **Fix:** keep the no-bell aesthetic but persist a **lightweight, read-only concierge log inside the Desk** (the real system messages you already emit: prep-note, arrived, ready, chapter-filed). It's a projection of real objects, not a new inbox.
- **Why best:** zero new architecture (it's already object-derived), preserves the philosophy, closes the "where did that go" gap.
- **Effort:** M.

### 7 · The Stay's emotional payoff is contingent on studio behavior the app can't guarantee — **High**
- **Why:** the five-act hospitality depends on staff posting floor photos and advancing acts in near-real-time. If they don't, "degraded mode" is a flat, photo-less status screen — the opposite of the promised delight.
- **User impact:** the moment sold as the app's peak becomes a boring tracker for the (likely common) case where the floor is busy.
- **Business impact:** the differentiator silently fails; word-of-mouth ("you have to see the app during a detail") never happens.
- **Fix:** (a) design the **photo-less Stay to still feel alive** — richer narration, the named craftsman, honest time, a subtle stage ambience — so it degrades to "calm and trustworthy," not "flat"; (b) make one act's photo (the **arrival custody shot**) a *hard requirement* in the ops capture flow (P2D2), since it's one tap and it anchors trust. 
- **Why best:** you can mandate one photo, not six; designing the floor-photo-optional Stay to a high bar removes the contingency.
- **Effort:** M (design) + an ops workflow requirement.

### 7-tie · Booking is ambiguous about *which* car for multi-vehicle owners — **High**
- **Why:** Arrange says "For the `<car>`" using the fronted vehicle, but when opened from the Desk (not a specific car's Glance), the car is "implicit." For a 2–3 car owner this is a silent guess.
- **User impact:** books a service against the wrong vehicle; a real, embarrassing error.
- **Business impact:** wrong records, wrong twin, support/cleanup, eroded trust in the "it knows my car" promise.
- **Fix:** add a **car chip at the top of the Arrange sheet** that is pre-selected to the context car but tappable to switch (a one-line addition, not a step). Single-car owners never see a choice.
- **Why best:** removes ambiguity with zero friction for the common (single-car) case — progressive disclosure done right.
- **Effort:** S.

### 8 · Command Palette entity search is "future" — managers can't jump to a customer/invoice by name at launch — **High**
- **Why:** ⌘K covers nav + quick actions but not entities until later; so finding "customer Sharma" or "invoice 1042" means navigate → list → filter.
- **User impact:** the manager/owner's most frequent task (look something up) is slow.
- **Business impact:** the app feels less capable than Stripe/Linear exactly where power users judge it.
- **Fix:** ship **entity search in ⌘K at launch** (customers by name/phone, vehicles by plate, invoices by number). This is the highest-leverage staff feature and the data already exists.
- **Why best:** it's the single biggest speed multiplier for the people who run the business; deferring it is a mis-prioritization.
- **Effort:** M.

### 9 · The Story doesn't scale — 50 visits expand into one infinite scroll — **Medium (Future-debt)**
- **Why:** "Show earlier visits" reveals *all* remaining entries inline; a loyal customer of 3 years has an unbounded scroll with no grouping, no year jumps, no pagination.
- **User impact:** the loyal, high-value customer has the worst browsing experience — inverse of intended.
- **Business impact:** the retention showcase degrades precisely for your best customers.
- **Fix:** group the Story by **year** with collapsible sections, and route deep recall to **Desk search** (already exists). Keep the recent-3 preview.
- **Why best:** reuses search, adds only lightweight grouping, and rewards longevity instead of punishing it.
- **Effort:** S–M.

### 10 · First-run greets a *light* app with a *dark* (stage) empty garage — **Medium**
- **Why:** the empty-garage / no-photo states use the near-black `stage` surface. For a Studio-White product, a new user's very first frame can be the one dark screen.
- **User impact:** tonal whiplash; the "gallery-white luxury" promise opens dark.
- **Business impact:** muddies the brand's first impression.
- **Fix:** render the pre-photo empty/onboarding states on **paper** with the typographic identity plate (issue #1), reserving `stage` for actual photographic contexts.
- **Why best:** keeps `stage` meaningful (photography only) and makes the brand consistent from frame one.
- **Effort:** S.

### 11 · The single truth-line under-serves screen-reader / low-vision users — **Medium (a11y)**
- **Why:** the glance's value is "one sentence you can see in 5s." A blind user can't glance; they get one sentence and must scroll layers for protection/next — the efficient path is visual-only.
- **User impact:** VoiceOver users lose the at-a-glance advantage sighted users get.
- **Fix:** give the portrait's VO element a **richer combined summary** (car + state + protection + next action in one aria-label) while keeping the visible single line. Same data, denser for AT.
- **Why best:** parity without visual change; the object model already has all four facts.
- **Effort:** S.

### 12 · Two design systems = double maintenance + a real naming collision — **Medium (Design-debt)**
- **Why:** Studio and Ops are correctly separate, but "scene" means 480ms (Studio) and 280ms (Ops); "H1/Title", spacing scales, and radii differ. Over time, drift and designer confusion are likely.
- **User impact:** indirect (inconsistency creep).
- **Business impact:** slower design velocity; onboarding-designer confusion.
- **Fix:** keep two *value* sets but **unify the naming grammar** (e.g. `dur/1,2,3` per system, never reuse "scene" for different values) and publish a one-page cross-map. Do not merge the systems.
- **Why best:** the separation is correct (luxury vs density); only the vocabulary needs hardening.
- **Effort:** S.

### 13 · No Undo/soft-state for customer destructive actions either (cancel visit, remove car, delete account) — **Medium**
- **Why:** cancel/remove/delete are confirm-then-gone. Delete-account anonymizes twins (correct) but there's no grace/restore for a mis-tap cancel or car removal.
- **User impact:** accidental cancellation of a visit or loss of a car's story.
- **Fix:** a **brief Undo** on cancel/remove (the visit/car soft-hides for a few seconds), and a short grace window on cancel; keep account-delete a hard confirm.
- **Why best:** matches the calm-competence promise; mistakes shouldn't be catastrophic.
- **Effort:** S–M.

### 14 · Rating = five quiet ticks — a review-site pattern in a luxury app — **Medium (challenges a prior decision)**
- **Why:** P2.2's own review (◆R12) flagged this and kept it. Five stars is the most generic feedback UI there is; it invites 1–5 grading of a relationship the app otherwise treats as hospitality.
- **User impact:** cheapens the handover; the studio becomes an Uber trip to rate.
- **Fix:** replace with **one warm binary + optional line** — "Loved it" / "Something off?" → the latter opens the thread to a human. Nuance goes to the concierge, not a star average.
- **Why best:** premium brands ask "was everything perfect?", not "rate us"; it also routes real problems to recovery instead of a silent 3-star.
- **Effort:** S.

### 15 · Studio Board information density risks overwhelm on the floor tablet — **Medium**
- **Why:** capacity + queue + 2 bays + QC/ready + tech rail + feed + timeline is a cockpit. On 768–1024 touch, much sits below the fold; a busy tech scans past the fold to advance a job.
- **User impact:** cognitive load, missed items, slower floor.
- **Fix:** a **role-aware default density** — technicians land on a simplified board (queue + bays + their assignments; feed/timeline collapsed); managers get the full cockpit. Same screen, role-filtered emphasis.
- **Why best:** the tech needs *their next action*; the manager needs *everything*. One board, two densities, no new screen.
- **Effort:** M.

### 16 · Offline write-desync risk for optimistic booking/payment — **Medium (Tech-debt)**
- **Why:** Arrange/Pay add optimistically then depend on the server; the "requested" visit shown could diverge if the write later fails (esp. after reconnect).
- **User impact:** a "requested" visit the studio never received.
- **Fix:** design an explicit **pending-sync state** (a subtle "sending…" whisper on the just-created visit until confirmed) and a failure path that surfaces in the Now layer, not just a lost optimistic row.
- **Why best:** honesty about sync state is on-brand and prevents silent data loss.
- **Effort:** M.

### 17 · Papers vs Story present the same visits twice — **Low (Cognitive load)**
- **Why:** the Story lists visits with photos; Papers lists the same dates as "care records." Overlap already flagged (P2.5) and deferred.
- **Fix:** reframe Papers as **documents only** (records that aren't already a photo-chapter: invoices/RC/insurance later), and when the only documents are chapters, show a single "Care records" entry that opens the Story filtered — not a parallel list.
- **Why best:** removes duplication without losing the documents concept.
- **Effort:** S.

### 18 · Two-bay resource model is hardcoded into the board/schedule layout — **Medium (Future-debt)**
- **Why:** the Board's two bay cards and the Schedule's two lanes assume exactly wash + protection. More bays or multi-branch (named as future) will break the fixed two-column/two-lane layout.
- **Fix:** design the bay/lane region as an **N-resource responsive grid now** (it renders 2 today), so multi-bay/branch is a data change, not a redesign.
- **Why best:** cheap now, expensive later; matches the "grow by data, not redesign" law the specs already espouse.
- **Effort:** M.

### 19 · Membership pending/verify flow puts trust on a manual studio step with no customer-side reassurance timer — **Low**
- **Why:** join → pending → "the studio confirms within hours." If the studio is slow, the customer waits with a static pending card and no recourse.
- **Fix:** after a threshold (e.g. same-day), surface a **gentle "still confirming — message the studio?"** line; and give Office a pending-membership SLA nudge.
- **Why best:** honesty + a recovery path; protects the join moment.
- **Effort:** S.

### 20 · The avatar (You) is top-right — a one-handed reach problem on large phones — **Low**
- **Why:** the only top control on the Glance is the avatar; on a 430-wide phone, top-right is the hardest one-handed target.
- **Fix:** keep it top-right (convention) but ensure **You is also reachable from the Desk shelf** (it is) and consider a downward-swipe-from-top or leaving it as-is given the Desk fallback.
- **Why best:** low severity; the Desk fallback already mitigates; don't add chrome.
- **Effort:** S (or accept).

### 21 · Charts are monochrome — multi-series comparison suffers — **Low**
- **Why:** "one status color only" is elegant but 4-series comparisons in graphite-only bars are hard to distinguish.
- **Fix:** allow a **restrained categorical ramp** (graphite → 3 desaturated tints) for genuinely multi-series charts only, never for status. Keep single-series monochrome.
- **Why best:** clarity where needed without a rainbow dashboard.
- **Effort:** S.

### 22 · Permissions "editable where allowed" is under-specified — **Low (Design-debt)**
- **Why:** the roles grid says some cells are editable (kiosk PINs) but doesn't fully enumerate fixed vs editable, risking designer/engineer guesswork.
- **Fix:** enumerate the editable set explicitly in the spec (grounded in `lib/permissions.ts`): role→capability is fixed; only PIN grants and per-employee kiosk access are editable.
- **Effort:** S.

### 23 · Mobile tables: "stacked cards OR sticky-scroll" is left undecided — **Low (Design-debt)**
- **Why:** the responsive spec offers both without deciding per table; the designer must guess.
- **Fix:** decide per table type: **transactional tables (Invoices, Bookings) → stacked identity cards**; **dense reference tables (Inventory) → sticky-identity horizontal scroll**. Document it.
- **Effort:** S.

### 24 · Success is silent for profile save; inconsistent with the "assent tick" success language — **Cosmetic**
- **Why:** most customer successes draw an assent tick + sentence; profile save is silent-on-dismiss. Minor inconsistency.
- **Fix:** either a tiny "Saved." whisper on dismiss or explicitly document silence as correct for auto-save. Decide and unify.
- **Effort:** S.

### 25 · Customer notification budget and Ops notification config are two unrelated systems — **Low (Future-debt)**
- **Why:** the customer's ≤2/week concierge budget and the staff notify config (who gets low-stock) are governed separately; over time, rules could conflict (e.g., a promo push violating the budget).
- **Fix:** document a **single notification governor** that both consult, with the customer budget as a hard ceiling no ops config can exceed.
- **Effort:** M (mostly policy).

---

## 9 · TOP 25 STRENGTHS (explicitly excellent — protect these)

1. **The single truth-line + capsule model** — Apple-grade restraint; one sentence carries the glance. Rare and right.
2. **Booking as a proposal, not a request** — care is suggested with a reason; "Book" all but disappears. A genuine differentiator.
3. **The five-act Stay** — turning a wait into hospitality is the app's soul; the reveal-portrait-alone-for-1.2s beat is exquisite.
4. **The object/twin model** — the whole product derives from nine objects; features become data, not redesigns. Architecturally excellent.
5. **The Studio Board as a one-screen operating system** — the best single idea in either app; the day genuinely runs on one surface.
6. **Two-mode staff shell (Studio/Office) filtered by one permission source** — clean, correct, and it prevents an entire class of role bugs.
7. **Token discipline** — 7 spacings, 3–4 radii, 2 shadows, one curve. Exemplary; most teams never achieve this.
8. **Silence as a legitimate empty state** — "render nothing" is braver and more premium than any illustration.
9. **Studio White vs Ops-dark boundary** — the absolute separation of customer luxury and staff density is a strong, defensible system decision.
10. **Attribution everywhere (kiosk actor + audit log)** — trust is built by knowing who did what; this is genuinely operations-grade.
11. **The confidence copy on Protection** ("Protected until…") — turning a countdown into reassurance is a small, perfect luxury move.
12. **Photography-first hierarchy** — when photos exist, the app is beautiful and unmistakably about *the car*.
13. **Reduced-motion rigor** — one MotionConfig + CSS block; above industry norm.
14. **The Chapter as a shareable care record that absorbs the invoice** — one document, two audiences, money hidden publicly. Elegant and shrewd.
15. **Voice/microcopy discipline** — "the studio is confirming your visit," "Protected until," "A suggestion from the studio." Consistently human, never salesy.
16. **The Arrange sheet's sub-20-second, pre-answered flow** — booking gets out of the way; exactly right.
17. **Inline-editable ops tables** (Notion/Stripe pattern) — the right density tool for catalog/stock without modal overhead.
18. **The ⌘K command palette architecture** — role-filtered from the same nav source; the correct power-nav spine.
19. **Honest degradation everywhere** (no fake data, typographic fallbacks, "—" not crash) — a trust posture most apps lack.
20. **The Now layer's proposed-vs-confirmed accuracy** (P2.5 fix) — refusing to say "confirmed" before the studio confirms is real integrity.
21. **The evidence chain** (arrival→inspection→craft→reveal, each with a job) — photography with purpose, not decoration.
22. **Kiosk mode with auto-relock and actor attribution** — a correct, secure answer to the shared-floor-tablet reality.
23. **The mental model reduces to three ideas** (my car / my studio / right now) — a product a user can hold in their head.
24. **Accessibility treated as constitutional, not bolted on** — focus rings, live regions, target sizes, contrast pairs specified up front.
25. **The specs themselves** — three coherent, non-contradictory documents with a single source of truth. The design *process* is a strength.

---

## 10 · WHAT SHOULD NEVER BE CHANGED
- The single **truth-line + capsule** glance model.
- **Booking-as-proposal** and the sub-20-second Arrange flow.
- The **five-act Stay** and the reveal beat.
- The **object/twin** architecture and the "grow by data, not redesign" law.
- The **Studio Board** as the one operational surface, and the **Studio/Office** two-mode shell.
- **Token discipline** and the two-system boundary (customer light / staff dark).
- **Silence as an empty state**; **no bell/badge/inbox** as the notification philosophy (extend it with a *read-only* log, don't replace it).
- **Attribution + audit** on the staff side.
- The **voice/microcopy** rules.

## 11 · WHAT ABSOLUTELY MUST CHANGE BEFORE LAUNCH
1. **Design the photo-absent states to the same bar as photo-present** (Issue #1) — no bare black boxes, ever.
2. **Add a first-use trust layer** for the pre-first-visit customer (Issue #2).
3. **Ops safety net: global Undo + confirm on backward/irreversible advances** (Issue #3).
4. **Close the implementation gap**: ship the Studio-White login, the Stay, the Chapter, and Onboarding — the flagship moments — before calling it launched (Issue #4).
5. **Make the Desk/search discoverable** (one-time coach mark) (Issue #5).
6. **Persist a read-only concierge log in the Desk** so notifications aren't lost to WhatsApp (Issue #6).
7. **Add the car chip to the Arrange sheet** for multi-car owners (Issue #7-tie).
8. **Ship entity search in ⌘K** for staff (Issue #8).
9. **Fix the rating** to a warm binary + human route (Issue #14) — small, but it's on the emotional-peak screen.
10. **Render pre-photo/onboarding states on paper, not stage** (Issue #10).

## 12 · NICE-TO-HAVE AFTER LAUNCH
- Year-grouped Story + search-first deep recall (#9).
- Customer-side Undo/grace on cancel/remove (#13).
- Role-aware Board density for technicians (#15).
- Explicit pending-sync states for optimistic writes (#16).
- Papers reframed to documents-only (#17).
- N-resource board/schedule for multi-bay/branch (#18).
- Membership pending SLA nudge (#19).
- Restrained categorical chart ramp for multi-series (#21).
- Unify motion-token naming + notification governor + mobile-table decision (#12, #23, #25).

## 13 · FINAL VERDICT

**Needs polish.** (Not redesign — emphatically not.)

The vision is top-decile and the system is among the most disciplined I've reviewed; nothing here warrants starting over, and most of the product should be actively protected. But it is not shippable *today*: it over-relies on photography and studio behavior it can't guarantee, assumes a trust it hasn't yet earned from first-time high-value customers, lacks a floor-safety net on the ops side, and — most bluntly — hasn't yet built its own best moments. Close the ten pre-launch items in §11 (a focused, mostly-design effort, plus the P3/P4/P7 implementation already on the roadmap) and this moves from a beautiful, opinionated prototype to a genuinely premium, launch-ready ownership platform.

**Scores at a glance:** Overall 84 · Customer 82 · Admin 85 · Design System 90 · Scalability 80 · Production readiness 84 (design) / ~62 (shippable today).

*End of audit. Design only — no redesign, no new files modified, no code, no commit.*
