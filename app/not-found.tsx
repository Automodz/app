/**
 * A DEAD LINK IS NOT A DEAD END.
 *
 * Source: docs/AUTOMODZ-OS.md §19.1, §20.4, §21.8
 *
 * ── WHY IT WAS REWRITTEN ─────────────────────────────────────────────────
 * The same era as the old `/offline`, and the same disagreements: `min-h-screen`
 * (`100vh`, which the rest of the product abandoned because it puts content
 * under a phone's browser bars), four hard-coded colours — `#08090b`, `#fff`,
 * `#0b0c0e` and a white `rgba` — where one of them is a near-miss of the
 * palette's own `#08090A`, a `font-hero` display at weight 800 where the
 * product's display face is Outfit 200, a `clamp(28px, 7vw, 44px)` type scale
 * that exists nowhere else, and a white filled button where the one filled
 * control in the product is amber.
 *
 * It also read as a different voice: "Wrong turn." blames the customer for a
 * link the studio published. It is a room like any other now, and it says what
 * happened without deciding whose fault it was.
 */
import { Screen, RoomHeader, Action } from '@/components/os';
import { space } from '@/design';

export default function NotFound() {
  return (
    <Screen top={space.rest} style={{ justifyContent: 'center' }}>
      <RoomHeader
        eyebrow="Nothing here"
        supporting="This address doesn’t lead anywhere — it may have moved, or the link may be older than the page it points at. Everything else is where you left it."
      >
        We can’t find that
      </RoomHeader>

      <div style={{ marginTop: space.rest }}>
        <Action href="/">Back to your car</Action>
      </div>
    </Screen>
  );
}
