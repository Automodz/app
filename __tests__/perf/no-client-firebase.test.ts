/**
 * ARCHITECTURAL GUARDS.
 *
 * These fail the build if the customer application regresses to client-side
 * reads or picks the Firebase SDK back up. They are cheap and they protect the
 * two properties the migration exists to create.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(p, 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const CUSTOMER_ROUTES = [
  'app/page.tsx', 'app/garage/page.tsx', 'app/vehicle/page.tsx',
  'app/history/page.tsx', 'app/history/[id]/page.tsx',
  'app/studio/page.tsx', 'app/you/page.tsx', 'app/membership/page.tsx',
];

describe('customer routes render on the server', () => {
  it.each(CUSTOMER_ROUTES)('%s is not a client component', r => {
    expect(read(r)).not.toMatch(/^'use client'/m);
  });

  it.each(CUSTOMER_ROUTES)('%s declares itself dynamic', r => {
    /* A customer's own room must never be prerendered or shared. A build without
       admin credentials once baked the signed-out screen into static HTML. */
    expect(read(r)).toMatch(/export const dynamic = 'force-dynamic'/);
  });

  it.each(CUSTOMER_ROUTES)('%s reads through the server room', r => {
    expect(read(r)).toMatch(/ServerRoom/);
  });
});

describe('no customer screen touches Firebase or the store', () => {
  const screens = walk('components/screens')
    .concat(walk('components/system'))
    .concat(walk('components/vehicle'))
    .filter(f => !f.includes('YouRoom')); // signs out; imports lazily, asserted below

  it.each(screens)('%s imports no firebase and no store', f => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/from 'firebase\//);
    expect(src).not.toMatch(/from '@\/lib\/firebase'/);
    expect(src).not.toMatch(/from '@\/lib\/store'/);
  });

  it('YouRoom imports firebase LAZILY, so it is never in a first load', () => {
    const src = read('components/screens/YouRoom.tsx');
    /* No STATIC import — that is what would put it in the first load. */
    expect(src).not.toMatch(/^import .*from 'firebase\//m);
    expect(src).not.toMatch(/^import .*from '@\/lib\/firebase'/m);
    /* And a dynamic one, so it arrives only when the customer signs out. */
    expect(src).toMatch(/import\('firebase\/auth'\)/);
    expect(src).toMatch(/import\('@\/lib\/firebase'\)/);
  });
});

describe('the root layout carries no browser session', () => {
  const layout = read('app/layout.tsx');
  it('does not mount AuthProvider, ThemeProvider or Toaster', () => {
    for (const w of ['AuthProvider', 'ThemeProvider', 'Toaster']) {
      expect(layout).not.toContain(`<${w}`);
    }
  });
  it('admin still gets all three, one level lower', () => {
    expect(read('app/admin/layout.tsx')).toMatch(/<ClientSession>/);
    const cs = read('components/ClientSession.tsx');
    for (const w of ['AuthProvider', 'ThemeProvider', 'Toaster']) {
      expect(cs).toContain(`<${w}`);
    }
  });
});

describe('Button', () => {
  /* Assertions are made against the IMPORTS and CALLS, never the prose — the
     file explains why these were removed, so a text search for the name matches
     the explanation and passes vacuously. */
  const src = read('components/system/Button.tsx');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('does not subscribe to the route, so a navigation re-renders no button', () => {
    /* `usePathname` in the most-used control in the product meant every button
       in the tree re-rendered on every navigation, to run a guard that is
       compiled out of production. */
    expect(code).not.toMatch(/usePathname/);
  });
  it('ships no motion library for a spinner no customer surface shows', () => {
    expect(code).not.toMatch(/framer-motion/);
    expect(code).toMatch(/am-press-spinner/);
  });
  it('still uses Link for an internal move, and a plain anchor to leave', () => {
    expect(code).toMatch(/<Link/);
    expect(code).toMatch(/rel="noopener noreferrer"/);
  });
});
