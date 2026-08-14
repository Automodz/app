# AutoModz OS

**The constitution for the customer application.**
Version 1 · Written from first principles · Supersedes everything before it.

This is the single source for what the customer application is, what it shows, and how it behaves. No screen, component, token or copy line may exist without an answer here. Where this document and an implementation disagree, the implementation is wrong.

It is deliberately opinionated. A design system that permits everything decides nothing.

---

## 1 · Vision

**AutoModz OS is the digital home for a car.**

AutoModz is one studio, on one road, in Maninagar. It sees a car perhaps four to eight times a year. Everything between those visits is silence - and that silence is where almost every business like this loses the relationship.

Most software built for this trade is a booking form with a logo on it. It is opened when the customer wants something and closed the moment they get it. It has no reason to exist on a Tuesday in November.

This product takes the opposite position: **the subject is the car, not the transaction.** A car is a thing that ages, accumulates protection, collects paperwork, and carries a history. It has state whether or not anyone books anything. An application that holds that state honestly is worth opening between visits, and an application worth opening between visits does not have to buy attention back with discounts.

The test of every decision in this document:

> Would the owner of this car open this on a day they need nothing?

If the answer is no, the feature is decoration.

**What this is not.** Not a marketplace. Not a social network for cars. Not a loyalty scheme wearing a design system. Not a CRM turned outward - the studio's operational reality is the studio's business, and exposing it to a customer is a failure of nerve, not transparency.

---

## 2 · Product Philosophy

### 2.1 The car is the subject

Every screen is a view of a vehicle or of the relationship that surrounds one. Nothing is organised by transaction, order, invoice or booking. Those are the studio's filing system, not the customer's mental model. Nobody thinks *"my booking"* - they think *"my car."*

### 2.2 AutoModz is the craftsman

Work is spoken in the studio's voice. **No individual is ever named on any customer surface** - not a technician, not a manager, not the owner. The customer's confidence must attach to the place, because people change shifts and leave, and a promise attached to a person leaves with them.

| Never | Always |
|---|---|
| *Ravi started polishing* | *Paint correction has begun* |
| *Applied by Karan* | *Applied at AutoModz* |
| *Amit activated your warranty* | *Your protection is now active* |

The studio's own notes survive without a byline. *"Two-stage correction before the coat"* is exactly right. *"Two-stage correction before the coat - Ravi"* is not.

### 2.3 States, never documents

A warranty is not a PDF. It is a promise with a health, a term and an owner. A policy, a certificate, a membership and an invoice are all the same shape: something that is currently fine, or currently not.

The file always exists and is always one tap away. **It is never the interface.**

### 2.4 Continuity, not sessions

The application remembers. Which car was last open, where the customer was, what they were told. A returning customer never re-establishes context they already had.

### 2.5 Nothing is faked

No placeholder cars. No sample photographs. No invented progress. No "0" where the truth is "we don't know yet." An honest absence is better than a confident fiction, and the customer can always tell the difference.

---

## 3 · Design Principles

### 3.1 The photograph is the interface

The largest element on any vehicle surface is a photograph of that vehicle, taken by the studio. Not an illustration, not a stock render, not a manufacturer press shot. The emotional argument for premium detailing is visual and it cannot be made in type.

Where no photograph exists yet, the absence is *designed* - a composition that reads as *awaiting*, never as broken.

### 3.2 One subject per screen

Each surface has exactly one thing it is about, and that thing is unmistakably dominant. If two elements compete, the screen has no subject.

### 3.3 Monochrome by conviction

Ink and paper. Greys, whites, blacks. Colour appears only where it carries meaning that grey cannot: a state that is failing, a state that needs attention. **Colour is information, never decoration.** The cars supply the colour.

### 3.4 Light is the only ornament

Depth comes from light and shadow, not from borders, decorative gradients, or texture. A surface is raised because it is lit, not because it has a stroke around it.

### 3.5 Restraint compounds

Every element removed makes the rest louder. When a screen feels weak, the instinct to add is almost always wrong.

### 3.6 Materials, not boxes

Surfaces have weight and translucency. A sheet feels like glass laid over the room beneath it. But **glass never sits on glass** - a translucent surface inside another translucent surface reads as a rendering mistake, because it is one.

---

## 4 · Experience Principles

### 4.1 The six questions

A customer opens this application to answer one of six questions. Every surface is judged against them.

1. **Is my car safe?**
2. **Is the work finished?**
3. **How does it look?**
4. **When can I collect it?**
5. **What protects my car, and for how long?**
6. **What did you actually do?**

**Every one must be answerable within one tap of the vehicle.** Nobody asks which technician polished the bonnet, how many jobs are in the queue, or what an invoice number is.

### 4.2 Answer before asked

If the studio knows something the customer will want, say it before they look for it. A car finishing early should say so when the screen opens, not wait to be discovered.

### 4.3 Depth of one

Anything a customer needs regularly is one tap from where they land. Anything two taps deep is a thing they will do occasionally. Anything three deep, they will never find.

### 4.4 Never ask what we know

Do not ask for a registration number the studio recorded. Do not ask which car when there is one. Do not ask for a phone number already on file.

### 4.5 Silence over noise

The absence of news is good news and should look like it. A car with nothing happening is a calm screen, not a screen full of zeroes and prompts.

### 4.6 Every act has a visible consequence

Nothing the customer does may complete invisibly. A save says *saved*. A booking appears. A cancellation disappears. If a mutation produces no visible change, the customer will do it again.

---

## 5 · Information Architecture

### 5.1 Three concepts, seven rooms

Everything belongs to one of three concepts. The rooms are the ergonomics of reaching them and may evolve; the concepts may not.

```
        THE CAR                THE STUDIO              THE PERSON
   what I own and its      the relationship        who I am and how
   ongoing condition       with AutoModz           I am reached
        │                        │                       │
   ┌────┴─────┐            ┌─────┴──────┐                │
 Garage   Vehicle        Studio    Membership         Profile
   │
 History ──── belongs to the car
```

### 5.2 The rooms

| Room | Is about | Holds | Never holds |
|---|---|---|---|
| **Home** | right now | the car that needs attention, its current state, the single most useful next action | lists, settings, marketing |
| **Garage** | the collection | every vehicle owned, each as a photograph with its state | anything about one car in depth |
| **Vehicle** | one car | hero, current state, protection, latest work, media, entry to its history | anything about another car |
| **Studio** | AutoModz the place | what the studio is and can do, credentials, services, hours, location, arranging a visit | a staff roster, any named individual |
| **Membership** | the club | what it includes, what remains, what it is worth, how to join or leave | other people's cars |
| **History** | what happened | every completed visit as a transformation, chronological, each opening to its full account | live visits - those are the car's current state |
| **Profile** | the person | name, contact, how they are reached, devices, sign-out | anything about the car |

### 5.3 The hierarchy of a vehicle

Fixed. No surface may invert it.

```
┌──────────────────────────────────────┐
│                                      │
│         1 · THE PHOTOGRAPH           │  full-bleed, the largest
│                                      │  element on the screen
│                                      │
├──────────────────────────────────────┤
│  2 · CURRENT STATE                   │  one phrase, unmissable
├──────────────────────────────────────┤
│  3 · WHAT PROTECTS IT                │  living states
├──────────────────────────────────────┤
│  4 · THE LATEST WORK                 │  most recent finished visit
├──────────────────────────────────────┤
│  5 · WAYS DEEPER                     │  history · media
└──────────────────────────────────────┘
```

### 5.4 A live visit is not a room

While a car is with the studio, that fact is the vehicle's **current state**, and it opens as a full-screen takeover. It never becomes a separate destination. When the work completes, the takeover becomes an entry in History.

### 5.5 What is removed from customer view

| Removed | Because |
|---|---|
| Invoice numbers, job IDs, booking references, database identifiers | plumbing |
| Internal operational statuses | the studio's vocabulary, not the customer's |
| Technician names, assignments, "applied by" | the studio is the craftsman |
| Any raw file as a primary surface | states, never documents |
| Queue positions, bay numbers, capacity | the studio's problem to solve, not to share |

**Kept:** the registration number. It is the customer's own plate - identity, not jargon.

---

## 6 · Navigation Philosophy

### 6.1 Rooms, not tabs

Navigation moves between rooms in one lit space. It is not a stack of unrelated screens. Moving from Garage to Vehicle should feel like walking toward something, not like loading a page.

### 6.2 Persistent and predictable

The primary navigation is always present, always in the same place, and always shows where the customer is. It disappears for exactly one reason: a full-screen takeover that demands the whole surface.

### 6.3 One primary action

Arranging a visit is the single most frequent deliberate act. It earns a permanent, distinct control - not a slot among equals. Everything else is reached by going somewhere.

### 6.4 Every surface is addressable

Every screen and every sheet has a URL. A link sent to a customer opens exactly where it should. This is not a technical nicety; it is what makes notifications, receipts and shared work possible.

### 6.5 Back is truthful

Back returns to where the customer actually came from, not to a designer's idea of a hierarchy.

### 6.6 The studio remembers the room

A cold launch returns the customer to the car they were last looking at. An explicit link always wins over that memory - a link is an instruction, not a preference.

---

## 7 · Motion Philosophy

### 7.1 The law

> **Motion decorates content. It never gates it.**

If every animation were disabled, every screen must render completely and correctly. Animate a wrapper, never the payload. Content that fades in from zero opacity is content that can fail to arrive.

### 7.2 Two curves, and only two

| Curve | For | Feels like |
|---|---|---|
| **Spring** | anything a finger drives - drags, sheets, dismissals | the object has weight and follows the hand |
| **Ease** | anything the system initiates - entrances, transitions, reveals | considered, deliberate, unhurried |

Finger-driven motion on an ease curve feels dead. System motion on a spring feels cheap.

### 7.3 Durations are named

| Name | Duration | Used for |
|---|---|---|
| Tick | ~120ms | acknowledgement - a press, a toggle |
| Move | ~280ms | an element changing place or state |
| Scene | ~480ms | a room becoming another room |
| Morph | ~620ms | a photograph carrying between two surfaces |

Nothing may invent a duration. If a motion does not fit one of these, question the motion.

### 7.4 The photograph may live

A vehicle photograph is the one element permitted ambient motion, and only these:

- a gentle scale settle on entrance
- parallax against scroll
- a slight response to device tilt
- an occasional slow light sweep across the surface

Nothing else animates on its own. **No looping, pulsing or breathing anywhere else** - with two exceptions: an indicator that a visit is *currently live*, and a loading state. Both are genuine state, not decoration.

### 7.5 Transitions carry the subject

When a photograph appears on two consecutive surfaces, it moves between them. It does not fade out and fade in - the car did not disappear.

### 7.6 Reduced motion

When the customer's system asks for reduced motion, transforms and parallax stop. Opacity transitions may remain. The interface must lose nothing but movement.

---

## 8 · Layout System

### 8.1 One column

The customer application is a single column at every width. Additional width increases margin and image size, never column count. A second column is a dashboard, and this is not a dashboard.

### 8.2 The measure

Reading content is capped at a comfortable line length regardless of screen width. Photographs and immersive surfaces are exempt - they go full-bleed.

### 8.3 Rhythm

Vertical space comes from a fixed scale, never from judgement:

| Name | Purpose |
|---|---|
| Hair | the smallest separation that reads as separate |
| Breath | within a tight group |
| Line | between lines of related text |
| Gap | between elements in a group |
| Rest | between groups |
| Movement | between sections - where the eye is meant to pause |

### 8.4 Full-bleed versus inset

| Full-bleed | Inset to the gutter |
|---|---|
| photographs | all text |
| immersive media | cards and surfaces |
| the hero | controls |

### 8.5 The stacking contract

Fixed elements - navigation, banners, sheets - declare their height as a token. Scrolling content pads its bottom by the sum of those tokens, so **nothing is ever hidden behind anything.** No screen may position a fixed element by measuring another.

### 8.6 Full-screen versus card

A thing deserves a **full screen** when it is the customer's whole attention: a live visit, a photograph opened, a completed visit's account.

It deserves a **card** when it is one of several comparable things: a protection state, a past visit, a vehicle in the collection.

It deserves **neither** when it is a single fact. A fact is a line of text.

---

## 9 · Design Tokens

Tokens are the vocabulary. **A value that is not a token is a defect.** If a design needs a value that does not exist, the correct action is to add it deliberately - not to inline it.

### 9.1 Ink and paper

The customer application is dark. A car photographed against black reads as a car in a studio; the same photograph on white reads as a catalogue.

| Token family | Meaning |
|---|---|
| Paper | the ground everything sits on |
| Surface | a raised material - panels, cards, sheets |
| Edge | the hairline that separates a material from its ground |
| Ink | primary text - the thing being said |
| Ink-2 | secondary text - supporting, still fully legible |
| Ink-3 | tertiary - labels and whispers only, **never body text** |
| Over | text on top of a photograph |

**Rule:** Ink-3 exists for small structural labels. The moment it carries a sentence a customer must read, it is the wrong token.

### 9.2 Meaningful colour

Four states, and no others:

| State | Says |
|---|---|
| Assent | fine, active, protected |
| Caution | attention soon |
| Urgent | attention now |
| Lapsed | no longer in force |

These are the only saturated colours in the product.

### 9.3 Depth bands

Elevation is chosen from a band, never invented:

```
base      the page
raised    a card lifted off it
float     a persistent control
nav       primary navigation
sheet     a drawer over the room
takeover  a full-screen moment
alert     something that must be seen
```

An element's shadow and its stacking order come from the same band. They can never disagree.

### 9.4 Radii

| Name | Used for |
|---|---|
| Chip | small pills and tags |
| Card | cards and panels |
| Sheet | drawers and modals |
| Stage | immersive full-bleed surfaces |
| Pill | fully round |

### 9.5 Typography

Five roles. Everything is one of them.

| Role | Purpose |
|---|---|
| **Display** | the one statement per screen - the state of the car, the name of a thing |
| **Title** | a section |
| **Body** | what is being said |
| **Data** | numbers, plates, dates, times - monospaced, so they align and read as facts |
| **Whisper** | labels, captions, the quietest legible line |

**One Display per screen.** If a screen has two, it has two subjects, which means it has none.

---

## 10 · Component Principles

### 10.1 A small vocabulary, used exactly

Fewer components, each doing more, beats many components each doing one thing. Every component added is a decision every future screen has to make.

### 10.2 One surface material

There is one raised surface in the product. Not a card *and* a panel *and* a tile *and* a well - one. Variation comes from what is inside it, not from a new container.

### 10.3 Composition over configuration

A component with eleven boolean props is four components pretending to be one. When flags start describing appearance rather than state, split it.

### 10.4 Actions have tiers

| Tier | Meaning | Per screen |
|---|---|---|
| **Primary** | the thing this screen exists to let you do | at most one |
| **Forward** | go deeper, read more | several |
| **Quiet** | dismiss, cancel, secondary paths | as needed |

### 10.5 Nothing is inert

Anything that looks tappable must do something. A control that closes a sheet and returns you where you were is a lie with a label on it. If there is no destination yet, there is no control yet.

### 10.6 State belongs to objects

A component renders what it is given. It does not decide what protects a car, what a visit costs, or whether a membership is active. Those answers come from one place, and a screen that computes its own version of the truth will eventually disagree with the rest of the product.

---

## 11 · Vehicle-Centric Experience

### 11.1 Everything hangs off a vehicle

Protection, visits, media, history and warranty all belong to a car. Nothing belongs to a "booking." The vehicle is the spine, and every record attaches to it.

### 11.2 The photograph

Every vehicle surface opens with a full-bleed photograph of that car. It is:

- taken by the studio, at the first visit
- the largest element on the screen
- alive - it settles, parallaxes, responds to tilt, catches light
- tappable, opening full-screen for close inspection

### 11.3 The renderer is replaceable

The photograph is *how a vehicle is presented today*, not *what a vehicle presentation is*. The surface asks for "the hero for this vehicle" and receives one. A future in which that becomes photogrammetry, a model, or something worn on the face must not require redesigning the product around it.

**This is the single most important architectural line in the customer application.** A 3D car built because it is possible, rather than because it is better, is worse than a great photograph - and a great photograph is achievable today, on a phone, by the studio.

### 11.4 The car answers questions about itself

Regions of the photograph correspond to what protects them - the paint, the glass, the wheels, the interior. Touching a region reveals the state of that region. This is discovered, never explained: no coach marks, no tutorial, no pulsing dots demanding a tap.

### 11.5 The car with no photograph

A new customer has no professional photograph. This state must be composed, not defaulted. It reads as *awaiting the first visit* - deliberate, quiet, complete in itself. It is never a grey box, never a placeholder silhouette, never a large empty field with a small plate floating in it.

---

## 12 · Garage

### 12.1 What it is

The collection. Every car the customer owns, each present as a photograph with its current state.

### 12.2 One car is not a collection

With a single vehicle, the Garage does not exist as a meaningful place - the customer goes straight to their car. A "collection" of one is a screen that wastes a tap to tell you what you already knew.

### 12.3 With several

Cars are equals. No car is "primary" - that is the studio's convenience, not the owner's feeling about their vehicles. Each shows its photograph, its name, its plate, and one line of state. Moving between them is direct and physical.

### 12.4 The first car

An empty garage is the most important screen a new customer will ever see, and it is an invitation, not an error. One sentence, one action. It never apologises, never explains what a garage is, and never shows an empty container.

---

## 13 · Studio Visit

### 13.1 What it is

The live account of a car currently with AutoModz. It is the most emotionally loaded surface in the product: the customer's car is not in their possession, and they want to know it is safe.

### 13.2 It takes the whole screen

A live visit is a full-screen takeover. Navigation steps aside. This is not a card in a feed - it is the only thing happening.

### 13.3 What it must answer

In order of urgency:

1. **The car is safe and it is with us.** Said plainly, first.
2. **What is happening now.** In the studio's own words, in plain language.
3. **How far along.** The stages of the work, with the current one evident.
4. **When it will be ready.** A real time, honestly derived.
5. **What it looks like.** Photographs as the work proceeds.

### 13.4 The timing promise

An estimated finish is a promise. It must respect the studio's working hours - a visit that cannot finish today finishes tomorrow morning, and says so. **A time outside opening hours is not an estimate; it is a bug that damages trust.**

Where an estimate is not yet knowable, say that. *"We'll know once we've looked at it"* is trustworthy. A confident wrong number is not.

### 13.5 Stages

Work is described in the customer's language, never the studio's operational statuses. The stages differ by service - a wash has no paint correction - and each carries what was seen and done.

A stage that can never be reached must not be shown. A permanently unlit step teaches the customer the interface is decorative.

### 13.6 Completion

When the work finishes, the visit becomes collectable: what it costs, whether it is paid, until when it can be collected. Then it settles into History as a permanent account, and it is never editable again.

---

## 14 · Protection

### 14.1 The idea

**What protects a car is physical, financial and legal at once.** Paint protection film, a ceramic coating, an insurance policy, a pollution certificate, a registration document, a toll balance, a manufacturer warranty - all of them are things that are currently fine or currently not.

Showing them as a single family of living states is what makes this application worth opening in a month when nothing is booked. It also turns compliance - the most tedious part of owning a car - into something that reads as care.

### 14.2 The card

Every protection is the same card, whatever its kind:

- **What it is** - in the customer's words
- **Its health** - fine, needs attention soon, needs attention now, or lapsed
- **Its term** - expressed in the unit that makes sense for it
- **Who provides it** - the studio, an insurer, an authority
- **Its file** - one tap away, never on the surface

### 14.3 Terms come in three shapes

| Shape | Reads as | Example |
|---|---|---|
| **Dated** | an expiry | insurance, a certificate, a coating |
| **Perpetual** | for as long as you own it | lifetime film |
| **Balance** | an amount remaining | a toll tag |

**A balance must never be described in time.** A toll tag is not "expiring soon" - it is running low. Speaking a balance in days is the kind of small wrongness that tells a customer nobody thought about their situation.

### 14.4 Precision is a promise

Say *"expires 20 April 2029."* Do not say *"expires in 1,043 days."* A countdown is honest only when the number is small enough to act on. Beyond a season, the date alone speaks.

### 14.5 Two sources, one appearance

Some protections the studio sold and therefore knows exactly. Others the owner declares - their insurance, their certificate, their toll tag. **They look identical on the surface**, because to the owner they are the same kind of thing: something protecting their car.

Internally they are not the same, and the difference matters: what the studio sold is a promise it must honour, and the terms of that promise are fixed at the moment of sale. **Changing a price list must never change what a past customer was promised.**

### 14.6 The document is the escape hatch

Every protection may carry its file. It sits behind one tap, labelled plainly. It is never the primary surface, never opens automatically, and never appears as a row in a list of files.

---

## 15 · Membership

### 15.1 What it is

An ongoing relationship with the studio: a recurring fee for included washes and a standing discount on everything else.

### 15.2 How it is shown

A membership is a protection. It has a health, a term, and a balance of what remains. It appears alongside everything else protecting the car, because that is what it is.

### 15.3 What the customer must always know

1. **That they have one**, and which tier
2. **What remains** - washes left this cycle
3. **When it renews or lapses**
4. **What it has been worth** - the honest, cumulative saving

The fourth is the one most products omit and the one that decides renewal. A member who cannot see what membership saved them is deciding on vibes.

### 15.4 Benefits are never stacked

A member's included wash and a promotional discount are two ways of paying less for the same thing. The customer gets **the better of the two, never both.** This is stated plainly where the price is shown - silently choosing one and hiding the other is how a customer discovers, later, that they were quietly overcharged.

### 15.5 Never punish the app

A member must always receive at the counter exactly what they receive in the application, and the reverse. If the studio's own software gives a worse price than walking in, the software is an obstacle wearing a brand.

### 15.6 Leaving is easy

Cancelling is available, plainly worded, and not defended by a maze. A membership that is hard to leave is a membership that is not worth having.

---

## 16 · Ownership Timeline

### 16.1 What it is

Every completed visit, newest first, as a series of transformations. Not a log. Not a table. Not a list of invoices.

### 16.2 A visit is permanent

Once a visit is complete, it is sealed. Its work, its photographs, its cost and the terms of what it promised are fixed forever. A completed visit is the customer's evidence, and evidence that can change is not evidence.

### 16.3 The account of a visit

Opening an entry gives the full reading:

- the car as it was finished
- what was done, in plain language
- the photographs - before, during, after
- what it promised, and for how long
- what it cost and how it was settled

### 16.4 It is shareable

A completed visit is the most persuasive artefact this business produces. It must be shareable as a link that shows the work and the evidence - and **never the money, the phone number, or anything internal.** A shared account is a beautiful thing sent to a friend, not a receipt forwarded by accident.

### 16.5 Media accumulates

Every photograph and clip ever taken of a car belongs to that car for as long as it is owned - not to the job that produced it. Studio captures and owner uploads sit together, chronologically. Any photograph can answer *"what visit was this?"*

---

## 17 · Notifications

### 17.1 There is no inbox

A list of notifications is the same mistake as a list of documents. It is a pile of things the customer must process, most of which they no longer care about.

**State changes surface as state.** A protection nearing expiry appears as a protection that needs attention. A finished car appears as a car ready to collect. The car is the inbox.

### 17.2 Delivery is push, and push is earned

Reaching a customer who is not currently looking requires push, and push permission is a real thing they gave. It is spent only on moments that matter to them:

| Send | Do not send |
|---|---|
| your car is ready | we posted on Instagram |
| work has begun | a service you've never bought is discounted |
| your insurance expires in a week | it's been a while |
| your protection is due for inspection | good morning |

### 17.3 Every notification lands somewhere

A notification is a doorway. It opens the exact surface it is about - never the home screen, never a generic list.

### 17.4 Frequency is a budget

Every message spends trust. The right number of messages per month is closer to one than ten, and the ones worth sending are the ones the customer would have wanted to know without being asked.

---

## 18 · Empty States

### 18.1 Absence renders as silence or invitation

There are exactly two correct treatments for nothing:

**Silence** - the section does not appear. A car with no completed visits has no History section. Not an empty one. None.

**Invitation** - when the emptiness is something the customer can resolve, one quiet line and one action.

### 18.2 Never an empty-state card

A bordered box containing the word "Empty," a shrugging illustration, or a dashed rectangle where content will one day live is a placeholder shipped to a customer. It fills space with an apology.

### 18.3 Emptiness is not failure

*"No visits yet"* is a fact about a new relationship, not a problem. The tone is calm. Nothing about a first-time customer's screen should suggest something has gone wrong.

### 18.4 The important empty states

| Situation | Treatment |
|---|---|
| No cars | Invitation - the whole screen, warm, one action |
| No photograph yet | Composed *awaiting* state - never a grey box |
| No protection declared | Invitation - one line, one action |
| No completed visits | Silence |
| No media | One quiet line explaining when photographs will appear |
| No results in a search | The studio's voice, plus a way to ask a human |

---

## 19 · Loading States

### 19.1 Loading is a state, not an absence

The customer must always be able to tell **loading** from **empty** from **failed**. These three are routinely collapsed into one blank screen, and that blank screen is why software feels broken.

### 19.2 The breath

While the application establishes itself, it shows a calm, branded moment - quiet, unhurried, confident. Not a spinner. A spinner says *waiting*; a considered moment says *preparing*.

### 19.3 One spinner, one place

A spinner is permitted only inside a control the customer just pressed, to confirm the press was received. Nowhere else.

### 19.4 An object loading in a live surface

When the room is already on screen and one thing inside it is still arriving, that thing shows its own placeholder at its final size, so nothing moves when it lands. Layout that shifts under a reading customer is a failure of preparation.

### 19.5 Never tear down what is already true

A refresh that fails must keep showing what was already on screen, with an honest note that it is not current. Replacing real content with a loading state, and then an error, loses information the customer already had.

---

## 20 · Error States

### 20.1 Speak like the studio

Errors are written in the same voice as everything else. Never a code, never a stack trace, never *"something went wrong"* - which tells the customer nothing and sounds like a shrug.

| Instead of | Say |
|---|---|
| Error 409: slot conflict | That time just went - pick another and we'll hold it |
| Network request failed | That didn't reach us - try again |
| Invalid vehicle | We couldn't find that car in your garage |
| Unauthorized | Sign in again and we'll pick this up where you left it |

### 20.2 Always recoverable

Every error offers a way forward: retry, choose differently, or reach a human. **A dead end is not an error state; it is an abandonment.**

### 20.3 Distinguish ours from theirs

*"You're offline"* and *"we're having trouble"* are different situations and must read differently. Blaming the customer's connection for a studio outage is a small dishonesty that a customer will eventually detect.

### 20.4 The car is safe

When something fails while a car is in the studio's care, say explicitly that the car and its history are safe. The customer's real fear is not the interface.

### 20.5 A crash is contained

A fault in one part of the product never drops the customer onto a browser error page. It is caught, spoken in the studio's voice, and offers a way back to the car - while telling the studio, silently, that it happened.

---

## 21 · Accessibility

Accessibility is not a compliance exercise appended at the end. It is a description of whether the product works.

### 21.1 Contrast

All text meets WCAG AA against its actual background - including text over photographs, which must carry a scrim sufficient for the worst image, not the best one. Tertiary ink is never used for anything a customer must read.

### 21.2 Zoom is not ours to take

Pinch-zoom is never disabled. If a focused input causes an unwanted zoom, the input is too small - that is the bug, and the fix is a larger input, not a disabled gesture.

### 21.3 Targets

Every interactive element is at least 44×44 points, including icon-only controls. Visual size may be smaller; the touch area may not.

### 21.4 Motion

The system's reduced-motion preference is honoured everywhere. With motion off, nothing is lost but movement.

### 21.5 Focus

Every interactive element has a visible focus state. The whole product is operable by keyboard, in a logical order. Sheets and takeovers trap focus while open and return it where it came from.

### 21.6 Semantics

One top-level heading per screen - the Display. Headings descend without skipping. Landmarks are real. Images that carry meaning have descriptions; decorative images are marked decorative and left silent.

### 21.7 Announce what changes

When something updates without the customer acting - a visit stage advancing, a car becoming ready - it is announced politely to assistive technology. Silent changes are invisible changes.

### 21.8 Never say the internal word

A description read aloud must speak the customer's language. If a label would sound like a database column, it is wrong for everyone - it is simply only *audible* to some.

---

## 22 · Engineering Rules

These bind implementation. They are not style preferences.

### 22.1 The server decides money

Prices, discounts, benefits and totals are computed by the server, from the server's own data. The client expresses **intent** - which car, which service, when. Values sent by a client are not validated; they are **ignored**. There is no field a caller can set that changes what they pay.

### 22.2 One implementation of anything

One pricing engine. One source for what protects a car. One way a visit comes into existence. Two implementations of the same idea will diverge, and the divergence will surface as a customer being told two different things.

### 22.3 Delete the predecessor

When something is replaced, the thing it replaced is deleted in the same change. Two generations of a component may not coexist "for now." A development-only gallery is not a reason to keep dead code alive.

### 22.4 Tokens only

No raw colour, no raw spacing value, no raw font size, no invented duration, no hand-picked stacking order. If the needed value does not exist, add it to the system deliberately.

### 22.5 Truth is not recomputed

What a customer was promised is captured when it is promised. Editing a price list, a service description or a warranty term must never alter what a past visit committed to.

### 22.6 Nothing is half-written

An action that touches several records either completes entirely or does not happen. A visit that exists with its benefit uncounted, or a benefit spent on a visit that does not exist, must not be representable.

### 22.7 Intent is idempotent

Submitting the same intent twice yields one result. A double-tap, a retry, a reload mid-request - all resolve to the same single outcome.

### 22.8 Never expose the studio's plumbing

Internal identifiers, operational statuses, employee records and queue mechanics do not cross the boundary into customer view. This is enforced, not remembered.

### 22.9 The failure must be visible to us

Every server fault and every client crash reports itself, with enough identity to find it and no secrets in it. A studio that cannot see its own failures is a studio that learns about them from customers.

---

## The review checklist

A surface may ship only when every answer is yes.

**Product**
1. Does it answer one of the six questions?
2. Is it a view of a car, or a page pretending to be one?
3. Does it belong clearly to one room?
4. Is any individual named? *(Must be no.)*
5. Is any file, identifier or internal status shown raw? *(Must be no.)*
6. Is anything faked or padded? *(Must be no.)*

**Design**
7. One photograph, one Display, at most one primary action?
8. Is every value a token?
9. Is any translucent surface inside another? *(Must be no.)*
10. Does elevation come from a band?
11. Does the content render completely with all motion disabled?
12. Is every target at least 44 points?

**Behaviour**
13. Is loading distinguishable from empty, and both from failed?
14. Does every action produce a visible consequence?
15. Does absence render as silence or invitation - never as an empty card?
16. Is every control's destination real?

**Truth**
17. Does every number come from the server?
18. Is there exactly one implementation of what this screen shows?
19. Was the predecessor deleted?

---

*If a future decision contradicts this document, change this document first - deliberately, with the reason recorded. A constitution that is quietly ignored is worse than none, because it makes everyone believe the product has rules.*
