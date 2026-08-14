/**
 * THE DOOR SAYS SOMETHING WHILE IT OPENS.
 *
 * The passage states are transient by nature - one lasts as long as a popup on
 * another origin, the other for a beat before the document is replaced - so
 * they are the states least likely to be looked at and most likely to rot.
 * Rendered here directly, they can be asserted without driving a popup.
 *
 * The distinction that matters: `welcoming` is only ever reached AFTER the
 * session cookie exists (see __tests__/auth/entry.test.ts), so it is allowed
 * to state that the customer is in. If that ever became optimistic, this file
 * is where the lie would be written down.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Passage } from '@/components/auth/Passage';
import { GoogleMark } from '@/components/auth/GoogleMark';
import { color } from '@/design';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('the passage while signing in', () => {
  it('says what is happening, not just that something is', () => {
    const out = html(<Passage phase="opening" />);
    expect(out).toContain('Opening your studio');
    /* The account of the work, in the customer's terms. */
    expect(out).toContain('Confirming it');
    expect(out).toContain('setting up your session');
  });

  it('shows no success mark until there is a success', () => {
    const out = html(<Passage phase="opening" />);
    /* The tick is the assent colour; while it is still opening nothing in the
       passage may be wearing it. */
    expect(out).not.toContain(color.assent);
  });

  it('names the customer when it knows them', () => {
    expect(html(<Passage phase="welcoming" greeting="Meera" />))
      .toContain('Welcome, Meera.');
  });

  it('welcomes them anyway when it does not', () => {
    /* A profile with no name must not produce "Welcome, ." */
    const out = html(<Passage phase="welcoming" />);
    expect(out).toContain('Welcome back.');
    expect(out).not.toContain('Welcome, .');
  });

  it('marks the arrival, and says where they are going', () => {
    const out = html(<Passage phase="welcoming" greeting="Meera" />);
    expect(out).toContain(color.assent);
    /* The tick itself, not just the colour. */
    expect(out).toContain('M5 12.5l4.5 4.5L19 7.5');
    expect(out).toContain('Taking you to your car.');
  });

  it('is announced, because it changes without being touched', () => {
    expect(html(<Passage phase="opening" />)).toContain('aria-live="polite"');
  });

  it('does not resize the panel between its two states', () => {
    /* Both states share one surface: the ring well is a fixed height and the
       copy sits under it either way. A panel that jumps mid-sign-in reads as
       a fault. */
    const opening = html(<Passage phase="opening" />);
    const welcoming = html(<Passage phase="welcoming" greeting="Meera" />);
    for (const out of [opening, welcoming]) expect(out).toContain('min-height:84px');
  });
});

describe('the Google control is recognisably Google', () => {
  it('carries the four-colour mark, not a monochrome stand-in', () => {
    const out = html(<GoogleMark />);
    for (const brand of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) {
      expect(out).toContain(brand);
    }
  });

  it('is decorative to a screen reader - the control carries the label', () => {
    expect(html(<GoogleMark />)).toContain('aria-hidden');
  });
});
