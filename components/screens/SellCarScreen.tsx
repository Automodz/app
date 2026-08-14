/**
 * A SERVER COMPONENT. It holds no state, no handlers and no motion - it is
 * handed a model and draws it - so marking it `'use client'` shipped its
 * markup to the browser twice and hydrated it for nothing. The interactive
 * pieces it renders carry their own directive.
 */
/**
 * OFFERING YOUR CAR TO THE STUDIO.
 *
 * Source: docs/AUTOMODZ-OS.md §15.7, §18.1, §19, §21.6
 *
 * WHAT THE OLD FORM DID NOT DO: it showed a thank-you and forgot. The customer
 * had no way to see that they had offered a car at all, let alone what had
 * become of it, and the studio's reply arrived out of nowhere days later. The
 * offers already made are the first thing on this screen for that reason.
 *
 * The garage is offered as a shortcut because the customer's own cars are
 * already known - asking someone to type the make and model of a car the
 * product can already name is asking them to prove they own it twice.
 */
import { space, INSET, MEASURE, color, HAIRLINE } from '@/design';
/* Deep imports, NOT the `components/system` barrel. The barrel re-exports
   every primitive, a dozen of them `'use client'` with Radix and
   framer-motion behind them, and reaching through it from a server
   component pulls all of that into the page's client bundle. Measured on
   the legal pages: 167 kB → 108 kB from this change alone. */
import { Heading } from '@/components/system/Heading';
import { Text } from '@/components/system/Text';
import { OfflineNote } from '@/components/system/OfflineNote';
import { Back } from '@/components/os/RoomHeader';
import type { SellModel } from '@/lib/customer/market';
import { SellForm } from '@/components/market/SellForm';

export function SellCarScreen({ model }: { model: SellModel }) {
  return (
    <main style={{
      paddingInline: INSET,
      paddingTop: `calc(${space.rest}px + env(safe-area-inset-top, 0px))`,
      paddingBottom: space.rest,
      maxWidth: MEASURE + INSET * 2,
      marginInline: 'auto',
    }}>
      <OfflineNote caption="You’re offline. Your car won’t send until you’re back." />

      {/* Public, so no dock - this was the second room with no exit of any
          kind. The `quiet` Button it used to be is the caption-shaped
          affordance the marketplace had; one idiom now. */}
      <Back parent={{ href: model.carsHref, name: 'Cars for sale' }} />

      <Heading level="display" style={{ marginTop: space.gap }}>
        Sell us your car
      </Heading>
      <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
        Tell us what you have and roughly what you want for it. We will look at
        it and come back to you - no obligation either way.
      </Text>

      {/* §19 - what has already been offered, and where it stands. Absent
          entirely for a first-time seller rather than shown as an empty list. */}
      {model.offers.length > 0 ? (
        <section style={{ marginTop: space.rest }}>
          <Heading level="title">What you have offered us</Heading>
          <div style={{ marginTop: space.gap }}>
            {model.offers.map(o => (
              <div
                key={o.id}
                style={{
                  paddingBlock: space.line,
                  borderTop: `${HAIRLINE}px solid ${color.edge}`,
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  gap: space.gap, alignItems: 'baseline',
                }}>
                  <Text role="body" tone="ink" as="span">{o.car}</Text>
                  <Text role="data" tone="ink3" as="span">{o.state}</Text>
                </div>
                <Text role="data" tone="ink3" style={{ marginTop: space.hair }}>
                  {o.when}
                  {o.photos > 0 ? ` · ${o.photos} photograph${o.photos > 1 ? 's' : ''}` : ''}
                </Text>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: space.rest }}>
        <Heading level="title">
          {model.offers.length > 0 ? 'Offer us another' : 'Your car'}
        </Heading>
        <SellForm garage={model.garage} />
      </section>
    </main>
  );
}
