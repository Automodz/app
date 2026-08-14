/**
 * A MISSING PHOTOGRAPH IS NOT A FAILED ONE.
 *
 * Reported as "images are not showing on the live". The pipeline was traced
 * before anything was changed, and it is sound:
 *
 *   upload → `lib/services/storage.ts` → Cloudinary → `secure_url` stored whole
 *   → the projection passes it through → the image component
 *
 * The stored value is a complete, permanent, UNSIGNED https URL on
 * `res.cloudinary.com`. No signing, no expiry, no Firebase Storage path
 * anywhere in the customer pipeline. The host is allowed in `remotePatterns`
 * and in the CSP's `img-src`, and it answers. A URL that exists loads.
 *
 * So the empty plates are visits the studio has not photographed yet - and the
 * interface was drawing that exactly like a photograph that failed. The fix is
 * to tell the two apart, not to make the empty one prettier.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { Photograph } from '@/components/os';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const html = (props: Partial<React.ComponentProps<typeof Photograph>> = {}) =>
  renderToStaticMarkup(<Photograph alt="The car, finished" {...props} />);

describe('the three states are three states', () => {
  it('never photographed draws the composed absence, and no image', () => {
    const h = html({ src: undefined });
    expect(h).toContain('data-photograph="absent"');
    expect(h).not.toContain('<img');
  });

  it('an empty or blank URL is absence, not a broken image', () => {
    /* A record with `url: ''` is a record with no photograph. Passing it to an
       `<img>` makes the browser request the current page and fail. */
    expect(html({ src: '' })).toContain('data-photograph="absent"');
    expect(html({ src: '   ' })).toContain('data-photograph="absent"');
    expect(html({ src: null })).toContain('data-photograph="absent"');
  });

  it('a real URL renders the photograph', () => {
    const h = html({ src: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' });
    expect(h).toContain('data-photograph="ready"');
    expect(h).toContain('<img');
  });

  it('and a failure is SAID, never dressed as an absence', () => {
    /* The previous fallback hid a broken asset behind the same empty plate a
       never-photographed visit uses, which is how a real data fault stays
       invisible to the studio. */
    const src = codeOf('components/os/Photograph.tsx');
    expect(src).toMatch(/state === 'failed'/);
    expect(src).toMatch(/Photograph unavailable/);
    expect(src).toMatch(/onError=\{\(\) => \{ setFailed\(true\); onFailed\?\.\(\); \}\}/);
  });
});

describe('the composition never moves', () => {
  it('the frame owns the size in every state', () => {
    /* No layout shift when a photograph arrives, fails, or was never there. */
    for (const src of [undefined, '', 'https://res.cloudinary.com/x/a.jpg']) {
      const h = html({ src, fill: false, width: 104, height: 104 });
      expect(h).toMatch(/width:104px/);
      expect(h).toMatch(/height:104px/);
    }
  });

  it('and the alt text can never lay the page out', () => {
    /* A broken `<img>` collapses to its alt at body size and pushes the layout
       apart - the leak seen on the live visit's frame strip. */
    const h = html({ src: 'https://res.cloudinary.com/x/a.jpg' });
    expect(h).toMatch(/font-size:0/);
    expect(h).toMatch(/color:transparent/);
  });

  it('but the alt text is still there for a screen reader', () => {
    expect(html({ src: 'https://res.cloudinary.com/x/a.jpg' }))
      .toContain('alt="The car, finished"');
  });
});

describe('the pipeline this was written against', () => {
  it('photographs are stored as whole URLs, not paths to resolve', () => {
    const storage = codeOf('lib/services/storage.ts');
    expect(storage).toMatch(/url: data\.secure_url/);
    /* The public id is kept only so a delete can find the asset. */
    expect(storage).toMatch(/path: `cloudinary:\$\{data\.public_id\}`/);
  });

  it('nothing in the customer pipeline signs or expires a URL', () => {
    for (const f of ['lib/services/storage.ts', 'lib/customer/project.ts']) {
      expect({ f, signed: /getDownloadURL|signedUrl|X-Goog-Signature/.test(codeOf(f)) })
        .toEqual({ f, signed: false });
    }
  });

  it('and the host is allowed to load, in both places it must be', () => {
    const config = readFileSync('next.config.js', 'utf8');
    expect(config).toMatch(/hostname: 'res\.cloudinary\.com'/);
    expect(config).toMatch(/img-src[^;]*https:\/\/res\.cloudinary\.com/);
  });
});

/**
 * AND THE FRAME AROUND IT HAS TO BE A FRAME.
 *
 * Reported from a phone on production: the NOW room drew one enormous blurred
 * photograph over the whole screen, with the dock floating on top of it and
 * every pane beneath it gone.
 *
 * `Photograph` fills its frame with `position: absolute; inset: 0`, which
 * anchors to the nearest POSITIONED ancestor. The film-strip frame in
 * `HomeScreen` set a width, a height and `overflow: hidden` but no `position`,
 * so the photograph climbed past it - past every other static ancestor - to the
 * initial containing block, and covered the viewport. `sizes="104px"` had
 * already told `next/image` to fetch a 104px-wide source, so the escape
 * upscaled it about fourfold: hence a wallpaper, and hence a blurred one.
 *
 * `overflow: hidden` does NOT clip it, which is why the frame looked complete.
 * Only a positioning context does.
 *
 * This is the whole class, not the one instance: every frame that holds a
 * filling photograph must establish the context that photograph is measured
 * against. A wrapper may do it with an inline `position`, or by being a
 * primitive that positions itself (`Hero`, which is `position: relative`).
 */
describe('every filling photograph is anchored to its own frame', () => {
  const { readdirSync, statSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap(e => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? sources(p)
        : /\.tsx$/.test(p) ? [p] : [];
    });

  /** Primitives that establish a positioning context for whatever they hold. */
  const POSITIONS_ITSELF = /<(Hero)\b/;

  it('no call site lets one escape to the viewport', () => {
    const escapees: string[] = [];

    for (const file of [...sources('components'), ...sources('app')]) {
      if (file.endsWith('Photograph.tsx')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, i) => {
        if (!line.includes('<Photograph')) return;

        /* A fixed-size photograph is in flow and needs no context. */
        const call = lines.slice(i, i + 10).join(' ');
        if (/fill=\{false\}/.test(call)) return;

        /* Walk back to the frame that holds it. */
        const above = lines.slice(Math.max(0, i - 30), i).join('\n');
        const anchored = /position: *'(relative|absolute|fixed)'/.test(above)
          || POSITIONS_ITSELF.test(above);

        if (!anchored) escapees.push(`${file}:${i + 1}`);
      });
    }

    expect(escapees).toEqual([]);
  });
});
