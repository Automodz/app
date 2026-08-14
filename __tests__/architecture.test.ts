/**
 * THE ARCHITECTURE, ENFORCED.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §9
 *
 * "Engines decide. Projections shape. Renderers draw." That law is only worth
 * writing down if something fails when it is broken. These are those failures.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Comments explain the rules; only code may break them. */
const codeOf = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

describe('engines are pure (ARCHITECTURE §1)', () => {
  const engines = walk('lib/os');

  it.each(engines)('%s imports no React', f => {
    expect(codeOf(f)).not.toMatch(/from ['"]react['"]/);
  });

  it.each(engines)('%s imports no component', f => {
    expect(codeOf(f)).not.toMatch(/from ['"]@\/components/);
  });

  it.each(engines)('%s does not read the database', f => {
    const src = codeOf(f);
    expect(src).not.toMatch(/from ['"]firebase\//);
    expect(src).not.toMatch(/from ['"]@\/lib\/firebase/);
  });

  /**
   * The one that matters most: an engine that knows an address cannot be
   * reused by the operations application, where the same intent lives
   * somewhere else entirely (§4).
   */
  it.each(engines)('%s knows no route', f => {
    const src = codeOf(f);
    /* A route literal is a quoted string starting with a slash. Regex literals
       and paths inside imports are excluded - neither is a destination. */
    const withoutImports = src.replace(/^import[\s\S]*?from\s+['"][^'"]*['"];?$/gm, '');
    expect(withoutImports).not.toMatch(/['"]\/(studio|garage|history|membership|vehicle|you|admin)\b/);
  });
});

/**
 * KNOWN DEBT, recorded rather than hidden.
 *
 * These three build addresses and predate the architecture. `Room` and
 * `ServerRoom` are shells whose sign-in and failure states link out;
 * `HistoryScreen` is migrated in its own step (7). Listing them here means the
 * test still guards every screen that HAS been migrated, and shrinking this
 * array is the definition of progress.
 */
const RENDERER_DEBT = [
  'components/screens/Room.tsx',
  'components/screens/ServerRoom.tsx',
  'components/screens/HistoryScreen.tsx',
];

describe('renderers draw only (ARCHITECTURE §1)', () => {
  const screens = walk('components/screens').filter(f => !RENDERER_DEBT.includes(f));

  it('the debt list only shrinks', () => {
    expect(RENDERER_DEBT.length).toBeLessThanOrEqual(3);
  });

  /**
   * A screen that builds a URL has taken a decision that belongs to
   * `navigation/resolve.ts`. The projection hands it an href already.
   */
  it.each(screens)('%s builds no address', f => {
    const src = codeOf(f).replace(/^import[\s\S]*?from\s+['"][^'"]*['"];?$/gm, '');
    expect(src).not.toMatch(/['"`]\/(studio|garage|history|membership|vehicle|you)\b/);
    expect(src).not.toMatch(/\$\{[^}]*\}\/(history|studio|vehicle)/);
  });

  it.each(screens)('%s reads no database', f => {
    const src = codeOf(f);
    expect(src).not.toMatch(/from ['"]firebase\//);
    expect(src).not.toMatch(/from ['"]@\/lib\/os\//);
  });
});

describe('the objects are seven (ARCHITECTURE §2)', () => {
  it('Timeline is an OS object, not a surface object', () => {
    expect(() => readFileSync('lib/os/timeline.ts', 'utf8')).not.toThrow();
    expect(() => readFileSync('lib/customer/timeline.ts', 'utf8')).toThrow();
  });

  it('NextAction is emitted as an intent, not a link', () => {
    const action = codeOf('lib/os/action.ts');
    expect(action).toMatch(/intent: ActionIntent/);
    expect(action).not.toMatch(/href/);
  });

  it('every intent resolves to an address, so no control is inert (§10.5)', () => {
    /* `RESOLVERS` is typed `Record<ActionIntent, …>`, so an unresolved intent
       is a compile error. This asserts the record is actually exhaustive at
       runtime too, in case the type is ever widened. */
    const resolve = readFileSync('navigation/resolve.ts', 'utf8');
    const action = readFileSync('lib/os/action.ts', 'utf8');
    const intents = [...action.matchAll(/^\s*\|\s*'([a-z_]+)'/gm)].map(m => m[1]);
    expect(intents.length).toBeGreaterThan(5);
    for (const i of intents) {
      expect(resolve).toContain(`${i}:`);
    }
  });
});
