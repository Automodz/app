/**
 * THE PALETTE - everything a customer can reach, as one list.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §5 · docs/AUTOMODZ-OS.md §21.4
 *
 * WHY THIS IS ITS OWN PROJECTION. The Desk's items used to be built inside
 * `toHome`, which made the palette a feature OF Home rather than of the
 * product: it existed at `/` and nowhere else, and it could only ever offer
 * what Home already had - the lead car. A customer standing in History could
 * not summon it at all, and one with three cars could not find the other two.
 *
 * So the palette reads the whole `CustomerPicture`, not one car, and it is
 * projected once per room by `ServerRoom` - the single place every room
 * already loads that picture.
 *
 * NO ADDRESS IS WRITTEN HERE. Every item names a `Destination` and hands it to
 * `navigation/resolve`, which is the one authority on where anything lives
 * (§1). A projection that types `'/vehicle'` is a second copy of the route
 * table, and it goes stale in silence.
 */
import { PROTECTION_TITLE } from '@/lib/types';
import { hrefForDestination, resolveAction, type Destination } from '@/navigation/resolve';
import type { CustomerPicture } from './picture';
import { readOwnership, completedOf, liveOf } from './ownership';
import { longDate, protectionsOf } from './project';

/**
 * One findable thing.
 *
 * `keywords` exist because the product's own vocabulary is deliberately not
 * the vocabulary a customer arrives with (§21.8). The rooms say "The Club" and
 * "Arrange a visit"; someone searching types "membership" and "book". Matching
 * on the label alone answers neither.
 */
export interface PaletteItem {
  id: string;
  label: string;
  group: string;
  href: string;
  keywords?: string;
}

/** The studio's record, as the Desk shows it beneath an empty field. */
export interface PaletteLogEntry {
  id: string;
  line: string;
  when: string;
  href?: string;
}

export interface PaletteModel {
  items: PaletteItem[];
  log: PaletteLogEntry[];
  truth?: string;
}

const at = (
  to: Destination, id: string, label: string, group: string, keywords?: string,
): PaletteItem => ({ id, label, group, href: hrefForDestination(to), keywords });

/**
 * Everything reachable, for one owner.
 *
 * Ordered by how often it is wanted, because the Desk shows this list before a
 * single character is typed and the top of it is the answer most of the time.
 */
export function toPalette(picture: CustomerPicture, now = new Date()): PaletteModel {
  const items: PaletteItem[] = [];
  const cars = picture.cars;
  const many = cars.length > 1;
  const lead = cars[0];

  /* The one next thing, whatever it happens to be - the same intent the Home
     CTA carries, resolved by the same resolver. Never a second judgement. */
  const read = lead
    ? readOwnership(picture, lead, protectionsOf(lead, picture.catalogue, now), now)
    : null;

  if (read) {
    const next = resolveAction(read.nextAction);
    items.push({
      id: 'next', label: next.label, group: 'Care', href: next.href,
      keywords: 'next do now',
    });
  }

  items.push(
    at({ to: 'studio' }, 'book', 'Book a visit', 'Care',
      'book booking service appointment arrange wash detail'),
    at({ to: 'garage' }, 'garage', 'Your garage', 'Care', 'cars vehicles my garage'),
  );

  /* A visit happening right now outranks the history of them. */
  for (const car of cars) {
    const live = liveOf(car);
    if (!live) continue;
    items.push({
      id: `live-${live.id}`,
      label: many ? `${car.vehicle.name} - in the studio` : 'The visit happening now',
      group: 'Care',
      href: hrefForDestination({ to: 'visit', visitId: live.id }),
      keywords: 'current live visit progress today status in studio ready collect',
    });
  }

  /* ── each car, and what protects it ──────────────────────────────────── */

  for (const car of cars) {
    /* One car has one Vehicle room; several make the room car-specific. */
    const room: Destination = { to: 'vehicle', vehicleId: many ? car.vehicle.id : undefined };
    items.push({
      id: `car-${car.vehicle.id}`,
      label: many ? car.vehicle.name : `The ${car.vehicle.name}`,
      group: 'Cars',
      href: hrefForDestination(room),
      keywords: `${car.vehicle.registrationNumber} car vehicle papers records documents `
        + 'warranty protection cover insurance',
    });

    for (const p of protectionsOf(car, picture.catalogue, now)) {
      items.push({
        id: `p-${car.vehicle.id}-${p.id}`,
        label: many ? `${PROTECTION_TITLE[p.kind]} · ${car.vehicle.name}` : PROTECTION_TITLE[p.kind],
        group: 'Protection',
        href: hrefForDestination(room),
        keywords: `protection warranty cover guarantee ${p.kind}`,
      });
    }
  }

  items.push(at({ to: 'garage.add' }, 'add-car', 'Add a car', 'Cars',
    'new add another vehicle register'));

  /* ── what has already happened ───────────────────────────────────────── */

  /* `completedOf` already excludes cancellations and sorts newest-first - the
     same reading History uses, so the palette can never disagree with it. */
  const completed = cars
    .flatMap(completedOf)
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))
    .slice(0, 12);

  for (const b of completed) {
    items.push({
      id: `v-${b.id}`,
      label: `${b.serviceName} · ${longDate(b.scheduledDate)}`,
      group: 'Visits',
      href: hrefForDestination({ to: 'visit', visitId: b.id }),
      keywords: 'visit past record chapter invoice receipt',
    });
  }
  items.push(at({ to: 'history' }, 'history', 'Everything that has happened', 'Visits',
    'history past visits records all of it timeline invoice receipt bill papers'));

  /* ── the Club ────────────────────────────────────────────────────────── */

  items.push(picture.subscription
    ? at({ to: 'membership' }, 'club', 'The Club', 'Club',
        'membership subscription plan washes renew cancel upgrade benefits')
    : at({ to: 'membership.join' }, 'club', 'The Club - have a look', 'Club',
        'membership subscription join plan'));

  /* ── the showroom ────────────────────────────────────────────────────── */

  items.push(
    at({ to: 'cars' }, 'cars', 'Cars for sale', 'Buying & selling',
      'buy car cars marketplace showroom stock used second hand listing'),
    at({ to: 'sell' }, 'sell', 'Sell us your car', 'Buying & selling',
      'sell selling offer value valuation trade my car'),
  );

  /* ── the owner ───────────────────────────────────────────────────────── */

  items.push(
    at({ to: 'profile' }, 'you', 'You', 'You', 'account profile owner me settings'),
    at({ to: 'profile.panel', panel: 'profile' }, 'you-profile', 'Your name and number', 'You',
      'edit name phone email contact details settings'),
    at({ to: 'profile.panel', panel: 'notifications' }, 'you-notify', 'Notifications', 'You',
      'notifications alerts push whatsapp reminders preferences settings'),
    at({ to: 'privacy' }, 'privacy', 'Privacy', 'You', 'privacy policy data legal'),
    at({ to: 'terms' }, 'terms', 'Terms', 'You', 'terms conditions legal'),
    at({ to: 'profile.panel', panel: 'delete' }, 'you-delete', 'Delete your account', 'You',
      'delete close remove account erase'),
  );

  return {
    items,
    truth: read?.truth,
    /* Addresses resolved here too - the log used to write `/history/{id}` by
       hand, which is the same defect one line lower down. */
    log: (read?.log ?? []).slice(0, 12).map(e => ({
      id: e.id,
      line: e.line,
      when: longDate(e.at.toISOString().slice(0, 10)),
      href: e.target
        ? hrefForDestination({ to: 'visit', visitId: e.target.bookingId })
        : undefined,
    })),
  };
}
