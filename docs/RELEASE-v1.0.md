# AutoModz v1.0 — Release Runbook

**Candidate:** RC-2 · **Branch:** `release/v1.0.0-rc1` · **Supersedes:** the RC-1 audit

---

## 1 · Architecture

```
                      ┌──────────────── CLIENTS (express intent, never price) ───────────────┐
  Customer app        │  app/app/page.tsx  ArrangeSheet.confirm                              │
  Walk-in kiosk       │  components/intake/WalkInFlow.tsx                                     │
  Quote desk          │  app/admin/quotes/page.tsx                                            │
  Future mobile       │  (same contract)                                                      │
                      └───────────────────────────┬──────────────────────────────────────────┘
                                                  │  POST, Firebase ID token
                                                  ▼
                                   app/api/booking/create/route.ts
                                     · verify token   · narrow body → intent
                                     · no pricing, no writes, no eligibility
                                                  │
                                                  ▼
                              lib/server/bookingService.ts   THE ONLY WRITER
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
   lib/services/pricing.ts   lib/server/occupancy.ts   ONE Firestore transaction
   decidePrice()             loadOccupancy()           ├── bookings │ jobs
   THE ONLY ENGINE           THE ONLY OCCUPANCY        ├── promos.usedCount
   (pure · 144 unit tests)   (shared with              ├── promoRedemptions
                              /api/availability)       ├── subscriptions.washesUsed
                                                       ├── walkinCustomers
                                                       └── bookingIntents  (idempotency)

  MEDIA                                    OBSERVABILITY
  /api/media/sign   ── signature bound      lib/server/report.ts
  /api/media/delete    to one public_id     ├── /api/booking/create  (server faults)
       └── lib/server/cloudinary.ts         └── /api/report          (client boundaries)
           mayWrite() = one ownership            → Sentry Store API, no SDK, 0 kB client
           rule for both doors

  OUTSIDE the service, by design
  components/workspace/BookingWorkspace.tsx → createJobFromBooking()
      check-in: copies a server-decided total, performs no pricing
```

**Invariants**
1. No client may create a booking — `firestore.rules`: `allow create: if false`.
2. Every rupee comes from `decidePrice`. Incoming money fields are ignored, not validated.
3. Booking + promo count + wash deduction + CRM + idempotency marker are one commit.
4. The idempotency key is derived from the intent, so it survives a reload.
5. A cancelled booking releases its marker; the same intent may book again.

---

## 2 · Deployment checklist

**The order is not negotiable.** Production's *current* client writes bookings directly
(`master:lib/services/bookings.ts` → `addDoc`). Deploying rules first takes booking offline.

| # | Step | Proves |
|---|---|---|
| 1 | Set every env var in §4 for **Production** | build won't ship half-configured |
| 2 | Merge `release/v1.0.0-rc1` → `master`, let Vercel build | `next build` passes with lint gating |
| 3 | `curl -X POST https://automodz.vercel.app/api/booking/create` → expect **401** | new code is live (404 = old build) |
| 4 | Sign in, book one real visit, confirm the total in `/admin/bookings` | new client works **on old rules** |
| 5 | `firebase deploy --only firestore:rules,firestore:indexes` | closes the write hole |
| 6 | Re-book once | new client works **on new rules** |
| 7 | In devtools, `addDoc(collection(db,'bookings'),…)` → expect `permission-denied` | old path is shut |
| 8 | `/robots.txt`, `/sitemap.xml` → 200 | SEO surface live |
| 9 | Upload one photo, then delete it; confirm it 404s on Cloudinary | signed media works both ways |

Steps 4 and 6 together are the deploy-order proof: the new client is compatible with
**both** rulesets, so there is no moment where booking is broken.

---

## 3 · Rollback checklist

| Symptom | Action | Time |
|---|---|---|
| Booking returns 500 | Vercel → Deployments → previous → **Promote to Production** | ~30 s |
| Booking returns 503 | An admin env var is missing — set it and redeploy | ~2 min |
| Nobody can book at all after step 5 | Rules ran ahead of the app. Finish the app deploy; do **not** revert rules | ~2 min |
| Rules block something legitimate | `git revert` the rules hunk, `firebase deploy --only firestore:rules` | ~1 min |
| CSP breaks a screen | Remove the `Content-Security-Policy` entry in `next.config.js`, redeploy | ~3 min |

**Rolling the app back does not require rolling the rules back.** The new client never writes
bookings directly, so it works under either ruleset. The reverse is not true: reverting to the
*old* client while the *new* rules are live breaks booking — if you must go back that far,
revert the rules too.

Nothing in this release migrates or rewrites data. `bookingIntents` is new and additive;
deleting it only forfeits replay protection.

---

## 4 · Environment variables

| Variable | Scope | Required | Missing ⇒ |
|---|---|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | server | **yes** | every API 503 — **nobody can book** |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | server | **yes** | as above |
| `FIREBASE_ADMIN_PRIVATE_KEY` | server | **yes** | as above |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | **yes** | app cannot reach Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | **yes** | sign-in fails |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | **yes** | app cannot reach Firestore |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client | **yes** | push registration fails |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | **yes** | Firebase init fails |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | client | yes | images do not render |
| `CLOUDINARY_API_KEY` | server | **yes (new)** | uploads 503 |
| `CLOUDINARY_API_SECRET` | server | **yes (new)** | uploads and deletes 503 |
| `CLOUDINARY_CLOUD_NAME` | server | no | falls back to `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`; set only to keep the cloud name off the client |
| `NEXT_PUBLIC_SITE_URL` | client | no | falls back to `automodz.vercel.app` |
| `SENTRY_DSN` | server | no | reporting is a no-op; logs still written |
| `CRON_SECRET` | server | **yes** | the daily cron refuses every request — retention, low-stock, receivables and win-back all stop silently |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | client | no | web push off |
| `NEXT_PUBLIC_ADMIN_EMAIL` | client | no | owner bootstrap hint |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | server | no | WhatsApp send off |

**Removed:** `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — delete the unsigned preset in the
Cloudinary console too, or the old public write path stays open regardless of this code.

**`CRON_SECRET` changed from optional to required.** `/api/cron/daily` used to skip its own
check when the variable was absent, leaving a public endpoint that pushes notifications to
every customer. It now fails closed: no secret, no cron. Set it in Vercel **before** the
first nightly run, or the automations stop without saying so.

**Firebase Auth providers.** `/api/employee/link` grants the staff role from the email in the
token. It now requires `email_verified`, so it is safe whatever is enabled — but the console
should still have **Google as the only enabled provider**. Anything else is a signup path
nobody in this codebase uses.

---

## 5 · Production smoke test

Run after step 6, signed in as a real customer.

- [ ] Landing renders; hero image loads; no console errors
- [ ] Google sign-in completes and lands in the garage
- [ ] Garage shows the car, its state and its protection
- [ ] Arrange → pick service, day, time → total matches the quote
- [ ] Confirm → booking appears; `/admin/bookings` shows the same total
- [ ] Book again with the same selection → **the same booking**, not a second one
- [ ] Reload mid-flow, re-confirm → still one booking
- [ ] Member: covered wash shows ₹0 and decrements the wash count once
- [ ] Promo: discount applied; `usedCount` moves by exactly one
- [ ] Cancel, then book the same slot → a **new** booking
- [ ] Visit and Chapter open; Chapter share card shows the generic AutoModz preview
- [ ] Profile saves
- [ ] Staff: walk-in ticket, quote → job, check-in, completion, invoice
- [ ] Upload a vehicle photo, then delete it — confirm the Cloudinary URL 404s
- [ ] Install the PWA; open offline → the offline page, not a browser error

---

## 6 · Security audit

| Attack | Result | Where proven |
|---|---|---|
| Forged totals / discount / promo / membership | **BLOCKED** — body money fields ignored | matrix §4, §14 |
| Ownership bypass (another customer's car) | **BLOCKED** — 403, vehicle read under the owner | §2 |
| Replay | **BLOCKED** — same key → same booking | §6, §17 |
| Race (8-way) | **SAFE** — exactly one booking, limits hold | §7 |
| Stale catalogue / promo deactivated mid-session | **BLOCKED** — priced at commit time | §8 |
| Firestore direct write (bookings, promos, redemptions, intents, jobs, washes) | **BLOCKED** | rules §1–13 |
| Storage direct write | **BLOCKED** — signature bound to one `public_id`, ownership checked | §18 |
| Storage cross-tenant delete | **BLOCKED** — 403 | §18 |
| Path traversal in media | **BLOCKED** — 403 | §18 |
| API without auth | **BLOCKED** — 401 | §1, §18 |
| Privilege escalation (customer → walk-in / `forUserId`) | **BLOCKED** — 403 | §1 |

**120 assertions, 0 failures** — `./scripts/security/booking/run.sh`.

Accepted, documented, unchanged by this release:
`feedback` and `carLeads` allow unauthenticated create (public rating and inquiry forms;
shape-validated, no auth, no rate limit). Remedy is Firebase App Check, not a rule.

---

## 7 · Performance

| Metric | Before | After |
|---|---|---|
| Fonts | 4 families, render-blocking from Google | self-hosted, 13 woff2, `display: swap` |
| Landing hero | raw `<img>`, no priority | `next/image` `fill` + `priority` + `sizes` |
| Car cards | raw `<img>` | `next/image` `fill` + `sizes` |
| `/app` First Load JS | 357 kB | 357 kB |
| Shared chunk | 104 kB | 104 kB |
| Largest chunk | 247.8 kB | 247.8 kB |
| Static asset cache | `immutable`, 1 year | unchanged |

LCP / CLS / INP: **unable to verify due to environment limitations** — the browser pane runs
with `visibilityState: hidden`, which freezes rAF and the timers Lighthouse depends on. The
three changes above all move LCP and CLS in the right direction by construction (preloaded
LCP image, reserved aspect ratios, no font round trip), but the numbers must come from a
Vercel preview.

---

## 8 · Bundle

Unchanged, deliberately: this release added five server routes and two server modules, none of
which reach the client. `next/font` replaces a network request with a build artefact, and
`next/image` replaces raw tags — neither adds JavaScript. Sentry is an HTTPS POST from the
server rather than an SDK, which is the single biggest reason the client did not grow.

| Route | First Load |
|---|---|
| `/app` | 357 kB |
| `/admin` | 341 kB |
| `/app/chapter/[id]` | 326 kB |
| `/app/garage` | 324 kB |
| `/app/visit/[id]` | 324 kB |

`/app` remains above the 200 kB target from the original audit. The cause is `firebase` +
`framer-motion` in the shared chunk, and reducing it means code-splitting the customer tree —
an architecture change, explicitly out of scope for RC-2.
