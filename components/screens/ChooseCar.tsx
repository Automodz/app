/**
 * WHICH CAR — asked, rather than guessed.
 *
 * Source: docs/AUTOMODZ-OS.md §12.3, §19.1, §21.8
 *
 * The record fell back to `leadCar` whenever the address did not name a car, so
 * a customer with several could be shown one car's visits under another's name
 * with nothing on screen to say the subject had changed. §12.3 makes cars
 * equals — there is no car whose record is the "default" record — and §19.1
 * makes an absence a state rather than a licence to choose.
 *
 * A customer with ONE car never meets this: there is nothing to ask.
 *
 * It is the Garage's own rows, not a new list: the same photograph, the same
 * name and plate, the same order. Choosing here is the same act as choosing
 * there, so it looks like it.
 */
import Link from 'next/link';
import Image from 'next/image';
import { color, space, radius, ground } from '@/design';
import { Screen, RoomHeader, Label, Chevron } from '@/components/os';
import { hrefForDestination } from '@/navigation/resolve';
import type { GarageModel } from './GarageScreen';

export function ChooseCar(
  { model, because }: {
    model: GarageModel;
    /** What the answer is for — "whose record to open". */
    because: string;
  },
) {
  return (
    <Screen top={space.gap}>
      <RoomHeader
        eyebrow="Your cars"
        supporting={`Tell us ${because}.`}
      >
        Which car?
      </RoomHeader>

      <div
        style={{
          marginTop: space.rest, display: 'flex',
          flexDirection: 'column', gap: space.line,
        }}
      >
        {model.vehicles.map(v => (
          <Link
            key={v.id}
            /* The car's own record, named by id — the address carries the
               answer so nothing downstream has to guess again. Built by the
               route table, which is the only thing that knows addresses. */
            href={hrefForDestination({ to: 'history.car', vehicleId: v.id })}
            className="am-glass am-tap"
            style={{
              position: 'relative', overflow: 'hidden',
              borderRadius: radius.pane, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: space.gap,
              padding: space.gap, minHeight: 84,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'relative', flexShrink: 0,
                width: 64, height: 64, borderRadius: radius.chip,
                overflow: 'hidden', background: ground.awaiting,
              }}
            >
              {v.photo ? (
                <Image
                  src={v.photo}
                  alt=""
                  fill
                  sizes={'64px'}
                  className="am-photo"
                  style={{ objectFit: 'cover' }}
                />
              ) : null}
            </span>

            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 15.5, color: color.ink }}>{v.name}</span>
              <Label style={{ fontSize: 9.5, letterSpacing: '0.16em' }}>{v.plate}</Label>
            </span>

            <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <Chevron />
            </span>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
