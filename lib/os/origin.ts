/**
 * IS THIS REQUEST OUR OWN PAGE ASKING?
 *
 * A bearer token cannot travel cross-site; a cookie can. So any route that
 * accepts the session cookie has to know whether the request came from the
 * product's own pages, or a third-party form post could book, cancel or pay as
 * the customer while their cookie rides along.
 *
 * Pure, and here rather than beside the session reader for one reason: the
 * session reader imports the Admin SDK, and a rule this load-bearing should be
 * testable without a Firebase runtime.
 */

/** True only when the browser itself says the request is same-origin. */
export function isSameOrigin(req: {
  headers: { get(name: string): string | null };
}): boolean {
  /* Sent by every modern browser, set by the browser and not by the page, so
     it cannot be forged from script. */
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';

  /* Older browsers: compare the stated origin with the host we were actually
     reached on. An ABSENT origin is not treated as same-origin — that is
     precisely what a cross-site form post sends. */
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
