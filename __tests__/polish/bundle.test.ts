/**
 * WHAT EACH PAGE MAKES THE BROWSER DOWNLOAD.
 *
 * THE BARREL WAS THE COST. `components/system/index.ts` re-exports every
 * primitive, and a dozen of them are `'use client'` with Radix and
 * framer-motion behind them. A SERVER component that reached through it for
 * `Heading` and `Text` pulled the whole client half of the design system into
 * that page's bundle.
 *
 * Measured, not guessed: `/privacy` and `/terms` - two pages of static legal
 * text with no interactivity whatever - shipped 167 kB of JavaScript. Deep
 * imports took them to 108 kB, a 35% cut, and `/cars` from 174 kB to 116 kB.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const SOURCES = [...walk('app'), ...walk('components'), ...walk('navigation')]
  .filter(f => !f.includes('node_modules'));

const isClient = (f: string) => readFileSync(f, 'utf8').startsWith("'use client'");

describe('no server component reaches through the barrel', () => {
  it('every barrel importer is a client component', () => {
    /* A client component may use the barrel freely - it is already on the
       client side of the boundary and pays nothing extra. A server component
       may not, because the barrel drags Radix and framer-motion across with
       it. */
    const offenders = SOURCES
      .filter(f => /from '@\/components\/system'/.test(readFileSync(f, 'utf8')))
      .filter(f => !isClient(f));
    expect(offenders).toEqual([]);
  });

  it('the server components that were converted import their modules directly', () => {
    for (const f of ['components/screens/ServerRoom.tsx',
      'components/screens/HistoryScreen.tsx', 'components/screens/VisitScreen.tsx',
      'components/screens/MarketScreen.tsx', 'components/screens/SellCarScreen.tsx',
      'components/legal/LegalPage.tsx', 'app/loading.tsx', 'app/cars/loading.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect({ f, deep: /from '@\/components\/system\/[A-Z]/.test(src) })
        .toEqual({ f, deep: true });
      expect({ f, barrel: /from '@\/components\/system'/.test(src) })
        .toEqual({ f, barrel: false });
    }
  });

  it('the barrel still exists for the client components that want it', () => {
    /* This is not a campaign against the barrel - it is the right import for
       anything already on the client. */
    const users = SOURCES.filter(f => /from '@\/components\/system'/.test(readFileSync(f, 'utf8')));
    expect(users.length).toBeGreaterThan(5);
    expect(users.every(isClient)).toBe(true);
  });
});

describe('images are served in the smallest format a browser accepts', () => {
  const config = readFileSync('next.config.js', 'utf8');

  it('AVIF is offered ahead of WebP', () => {
    /* Next's default is WebP alone. AVIF is ~20% smaller, and this product's
       payload is almost entirely photographs of cars. */
    expect(config).toMatch(/formats: \['image\/avif', 'image\/webp'\]/);
  });

  it('every remote host that serves an image is allowed', () => {
    for (const host of ['res.cloudinary.com', 'lh3.googleusercontent.com']) {
      expect(config).toContain(host);
    }
  });

  it('no <Image fill> ships without sizes', () => {
    /* Without `sizes`, Next serves the largest candidate to every device. */
    const bad: string[] = [];
    for (const f of SOURCES) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.replace(/\n/g, ' ').matchAll(/<Image\b[^>]*?\/>/g)) {
        if (/\bfill\b/.test(m[0]) && !/\bsizes=/.test(m[0])) bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });
});
