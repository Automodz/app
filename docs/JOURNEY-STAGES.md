# Journey Stages

**Status: binding.** Companion to the Constitution, Art. 6 and Art. 18. Ratified 2026-07-25.

> History sounds archived. **Journey sounds alive.**
> Every visit is a transformation, told stage by stage, in AutoModz's own voice.

---

## 1 · The problem this solves

The Journey wants seven moments. **The floor records four.**

| Today — `JobStatus` | Wanted — customer stages |
|---|---|
| `checked_in` | Vehicle Received |
| — | Condition Recorded |
| `in_progress` | Deep Clean |
| — | Paint Corrected |
| — | Protection Applied |
| `quality_check` | Final Inspection |
| `ready_for_delivery` | Ready for Pickup |

Building the app without changing the floor produces a Journey with three of seven stages populated and four permanently grey. **This is a process change first and a code change second.**

There is precedent for getting this wrong in the current code: `ACT_ORDER` in `lib/os/visit.ts` declares five acts, but `looked_over` has no ops status mapping to it and is therefore *unreachable* — the progress rail has always shown one node that can never light up. That act is retired here.

---

## 2 · The stage templates

Stages are **per service category**, because a wash has no paint correction and PPF has no polish stage.

### Detail / Ceramic
```
Received → Condition Recorded → Deep Clean → Paint Corrected
        → Protection Applied → Final Inspection → Ready
```

### PPF
```
Received → Condition Recorded → Deep Clean → Surface Prep
        → Film Applied → Final Inspection → Ready
```

### Wash
```
Received → Deep Clean → Final Inspection → Ready
```

### Coating (glass / interior)
```
Received → Condition Recorded → Deep Clean → Coating Applied → Ready
```

```ts
type Stage =
  | 'received' | 'condition_recorded' | 'deep_clean'
  | 'surface_prep' | 'paint_corrected' | 'film_applied'
  | 'protection_applied' | 'coating_applied'
  | 'final_inspection' | 'ready';

const TEMPLATE: Record<ServiceCategory, Stage[]> = { … };
```

**A visit's template is chosen at agreement from its highest-value service** and stored on the visit. Adding a service mid-visit may extend the template; it never rewrites completed stages (append-only, `VISIT-OBJECT.md` §3).

---

## 3 · The stage entry

Each stage appends one entry to the visit:

```ts
interface StageEntry {
  stage: Stage;
  at: Timestamp;
  note?: string;        // the studio's own sentence — no byline
  media: MediaRef[];    // photos and clips, promoted to Moments at seal
  byEmployeeId: string; // recorded, never rendered (Art. 8)
}
```

**Photos are what make this worth revisiting.** A stage with no media still renders — it just renders as a line rather than a frame. A stage template is a promise about what will be *recorded*, not about what must exist before the app will show anything.

---

## 4 · The voice

The actor law (Art. 8) governs every stage line. **AutoModz performs the work.**

| Stage | Never | Always |
|---|---|---|
| `received` | Ravi checked in the car | The M340i has arrived |
| `condition_recorded` | Karan did the walkaround | Condition recorded — every panel photographed |
| `deep_clean` | Ravi started the foam wash | Decontamination wash under way |
| `paint_corrected` | Ravi is polishing | Paint correction has begun |
| `protection_applied` | Amit applied the coat | The ceramic coat is on |
| `final_inspection` | Karan completed inspection | Final inspection completed |
| `ready` | Ravi finished | The M340i is ready |

The studio's own written note — *"Two-stage paint correction before the coat"* — renders verbatim and unattributed. It is the truest sentence available and exactly the right voice. Only the byline goes.

---

## 5 · Live vs sealed

The same stage data serves both readings.

| | Live (Garage → takeover) | Sealed (Journey → Chapter) |
|---|---|---|
| Shows | current stage, what has happened, what is coming | the whole transformation |
| Motion | the current node breathes | stages reveal on scroll |
| Timing | *"Ready by 4:30 pm"* | *"8h 25m in the studio"* |
| Grey nodes | yes — the stages still to come | no — only what happened |

**The timing line must respect business hours.** The audit found `timingLine()` computing `arrivedAt + duration` with no clamp, producing *"Planned finish around 2:49 am"* for an 8-hour ceramic checked in at 18:49 by a studio that closes at 19:00. It must clamp to `DAY_OPEN_MIN`/`DAY_CLOSE_MIN` and roll to the next open day. This is the single most-read sentence in the product.

---

## 6 · What the floor must do

The ops statuses **do not change** — `checked_in`, `in_progress`, `quality_check`, `ready_for_delivery` still drive scheduling, bays and payroll. Stages are an additional, finer record layered on top.

| Change | Where |
|---|---|
| `stage` added to each status/progress entry | job workspace |
| Per-service stage checklist, prefilled from the template | job workspace |
| Camera prompt at each stage — one tap, straight to the stage | job workspace |
| A stage cannot be marked without at least one photo *(recommended, not enforced at first)* | job workspace |

**Do not enforce photos on day one.** A hard gate on a busy Saturday means staff mark stages late or in a batch at the end, which produces a Journey that is technically complete and emotionally worthless. Ship it as a prompt, measure capture rate, tighten once the habit exists. Article 13 already names the studio's camera habit as a product dependency shipping as first-class admin tooling — this is that.

---

## 7 · Migration

Historical visits have four coarse statuses, not seven stages. They map as:

```
checked_in         → received
in_progress        → deep_clean          (the honest floor of what we know)
quality_check      → final_inspection
ready_for_delivery → ready
completed          → ready
```

Unmapped stages are **absent, not grey** on a historical visit. Showing an old visit with four empty nodes would imply the studio skipped work it very likely did — that is a fabricated claim about the past, and Art. 1.6 forbids it. A historical Journey renders the stages it can prove and says nothing about the rest.

---

## 8 · Tests

1. Each service category renders its own template; a Wash never shows Paint Corrected.
2. `looked_over` no longer exists anywhere.
3. No stage line renders `employeeName`, `craftsman` or `installer`.
4. A stage with no media renders as a line, not as a broken frame.
5. A historical visit renders four stages, not seven with three empty.
6. A check-in at 18:49 for an 8h service yields a timing line on the next working day, never 2:49 am.
7. Stage entries are append-only while the visit is open.
