# AutoModz — Customer Experience as One Continuous Object

The customer app is not a set of pages. It is one physical object the owner
turns in their hands. There is exactly **one persistent protagonist — the
vehicle** — and every surface is a different light thrown on that same object.
Navigation is never a page swap; it is the camera moving around the car.

## The continuity law
- **One object.** The vehicle carries a single `view-transition-name`
  (`hero-vehicle`). Wherever the car is on screen — Home stage, Visit stage,
  Chapter masthead — it is the *same* element to the browser, so it **morphs**
  between surfaces instead of cutting.
- **One material system.** Seamless-paper stages, brushed-chrome monuments,
  graphite passes, ambient bloom, live heartbeats. A surface earns a new
  material only if its *meaning* is new.
- **One motion grammar.** Studio ease `cubic-bezier(.22,1,.36,1)`, three
  durations (tick/move/scene). Nothing simply fades: forward navigation pushes
  in with depth; back recedes; the shared object morphs across the cut.
- **Silence.** No section headings, no repeated titles, no settings rows. A
  surface shows only what is true right now.

## The map

| Surface | Purpose | Emotional goal | Dominant visual | Motion in → | Motion out → |
|---|---|---|---|---|---|
| **Door** (`/auth/login`) | enter | "this is mine" | chrome "Your studio" monument on a lit stage | develop-in from bloom | dissolve up into the garage |
| **Boot** | hold the breath | calm trust | wordmark develops over a progress hairline | — | crossfade to Home |
| **Welcome** | first car | anticipation | chrome "Welcome." monument | develop-in | hands the car to Home |
| **Home** (`/app`) | the whole world at a glance | pride of ownership | **floating vehicle stage** + a deck that lifts over it | car settles into focus | car **morphs** into the next surface |
| **Booking** (`?sheet=arrange`) | agree care | effortless intent | pass being written | deck lifts a sheet | pass drops onto the deck as the graphite **Next-visit pass** |
| **Visit** (`/app/visit/[id]`) | where is my car | living reassurance | **living service timeline** on the car's stage | car morphs up from Home; timeline reveals in sequence | put-down recedes to Home; on ready → Chapter |
| **Chapter** (`/app/chapter/[id]`) | keep the memory | reverence | **cinematic editorial masthead** of the finished car | car morphs into a full-frame masthead | back recedes to Home |
| **Protection** (`?focus=protection`) | proof it's safe | assurance | warranty **certificate object** | sheet raises over the car | settles back |
| **Membership** (`?sheet=join-club`) | belong | status | **brushed-metal membership card** that lifts on select | sheet raises | card goes live in the deck |
| **Documents** (chapter receipt) | own the papers | permanence | receipt/document object | inside Chapter | opens the paper |
| **Profile** (`?sheet=you`) | who I am | quiet luxury | **chrome monogram identity** | sheet raises | settles back |
| **Garage empty / add** | invite a car | possibility | premium **empty bay** monument | develop-in | becomes the car's Home |

## Where two surfaces risked feeling alike — and the resolution
- *Visit* vs *Chapter* both open on the car. Resolved: Visit is **alive** (dark
  stage, moving timeline, present tense); Chapter is **archival** (masthead
  editorial, full-bleed stills, past tense). The shared car morphs between them,
  which makes the *difference* legible rather than repetitive.
- *Next-visit pass* vs *membership card* are both "held objects." Resolved: the
  pass is **graphite** (a single event), the membership is **brushed silver** (a
  standing relationship).
- Sheets (Booking/Membership/Profile/Protection) are overlays on the same route,
  not routes — they **raise over** the deck (vaul) and never trigger a page
  morph, so opening one never feels like leaving the car.

## Technical spine
- `lib/os/navigate.ts` — `useStudioRouter()` wraps route changes in
  `document.startViewTransition`, with reduced-motion + unsupported fallbacks
  (never blocks navigation). Sheets keep the plain router (overlays).
- `hero-vehicle` view-transition-name is owned by the **active** vehicle only
  (Home's pager assigns it to the current page), so the morph target is
  unambiguous.
- Global `::view-transition` rules in `globals.css` give every route change a
  depth-aware push/recede; the shared object overrides with a morph.
