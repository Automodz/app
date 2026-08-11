const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: true,
  fallbacks: { document: '/offline' },
  // Fresh-first: a new deploy takes over as soon as the page reloads,
  // instead of returning visitors being served the previously cached shell.
  /**
   * THE SERVICE WORKER MUST NEVER ANSWER FOR SIGNING IN.
   *
   * The default `pages` strategy is NetworkFirst with a timeout: on a slow
   * connection it falls back to the CACHED document, and that document names
   * the chunk hashes of whatever build it was captured from. Those chunks are
   * still in the CacheFirst static bucket, so a returning customer runs an
   * OLD COPY OF THE APPLICATION — indefinitely, and only in a profile that has
   * a worker installed. That is exactly the shape of "it fails in Safari and
   * works in a private window", and it is why a bug fixed and deployed can
   * keep being reported.
   *
   * Nowhere does that matter more than the door: a stale `/auth/login`
   * reintroduces whatever sign-in bug was current when it was cached, and a
   * cached or replayed `/api/session` is a session exchange nobody can reason
   * about. Both are pinned to the network, so they are always the deployed
   * code talking to the deployed server.
   */
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    /* AVIF first, WebP as the fallback. Next's default is WebP alone; AVIF
       compresses roughly 20% smaller and this is a product whose payload is
       almost entirely photographs of cars. The cost is ~50% longer to encode
       on the FIRST request for a given size and a second cached copy per
       format — both one-time, both at the edge. */
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  /* Lint failures fail the build. This was `ignoreDuringBuilds: true`, which is
     how ~180 lines of dead code accumulated unnoticed. */
  eslint: {
    ignoreDuringBuilds: false,
  },

  /* ── Security headers ──────────────────────────────────────────────────
     Vercel supplied HSTS and nothing else, so the app could be framed, sniffed
     and could leak full referrer URLs cross-origin.

     The CSP is the delicate one. What it must keep working:
       'unsafe-inline' style   Tailwind + several hundred inline `style` props
       'unsafe-inline' script  the pre-paint theme script in app/layout.tsx
       'unsafe-eval'           dev only; Next's dev overlay needs it
       fonts.googleapis/gstatic  the four families in the root layout
       *.googleapis / firebase / firestore  the client SDK's XHR + streams
       accounts.google.com     the Google sign-in popup
       api.cloudinary.com      signed uploads POST straight from the browser
     `frame-ancestors 'none'` is the modern X-Frame-Options; both are sent
     because older browsers only understand the latter. */
  async headers() {
    const dev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://apis.google.com https://www.gstatic.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://res.cloudinary.com https://i.ibb.co https://images.unsplash.com https://lh3.googleusercontent.com https://firebasestorage.googleapis.com",
      "media-src 'self' https://res.cloudinary.com",
      [
        "connect-src 'self'",
        'https://*.googleapis.com', 'https://*.firebaseio.com',
        'https://firestore.googleapis.com', 'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com', 'https://fcmregistrations.googleapis.com',
        /* `apis.google.com` IS NOT `*.googleapis.com` — different host, and the
           wildcard above does not cover it. `script-src` has trusted it since
           this policy was written, because the auth relay's gapi loader is
           served from there; `connect-src` never did, so anything that loader
           fetches was refused by our own policy. Measured against production:
           a request to https://apis.google.com/js/api.js is reported as a
           `connect-src` violation while the identical URL loads fine as a
           script. Trusting a host to run code but not to be spoken to is not a
           security boundary, it is a gap. */
        'https://apis.google.com',
        /* Same shape: the sign-in pop-up is a window on accounts.google.com,
           which `frame-src` already trusts. */
        'https://accounts.google.com',
        'https://api.cloudinary.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
        'wss://*.firebaseio.com',
        /* The local Firebase suite, in development only. Without these the
           emulator is unreachable from the app, which is why the customer read
           path had never once been exercised against real rules - the CSP was
           silently blocking the only way to test it. Never emitted in a
           production build. */
        ...(dev ? ['http://127.0.0.1:8080', 'http://127.0.0.1:9099', 'ws://127.0.0.1:8080'] : []),
      ].join(' '),
      /* The popup is a window, but the credential comes BACK through a hidden
         iframe on the auth domain (Firebase's `sendAuthEventViaIframeRelay`).
         Leave that origin out and the popup completes, the relay is blocked,
         and the SDK reports "No matching frame" — the sign-in simply never
         resolves. The local suite needs the same allowance in development,
         which is why a popup sign-in had never once completed against the
         emulator; only ever emitted in a development build. */
      [
        "frame-src 'self'", 'https://accounts.google.com', 'https://*.firebaseapp.com',
        /* The landing page's map. `www.google.com` is NOT covered by the
           sign-in entry above, so the embed was blocked by our own policy and
           the Contact section rendered an empty box — on the one page every
           visitor arrives at. */
        'https://www.google.com',
        ...(dev ? ['http://127.0.0.1:9099'] : []),
      ].join(' '),
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      ...(dev ? [] : ['upgrade-insecure-requests']),
    ].join('; ');

    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), interest-cohort=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    }];
  },

  // Front Desk mode was folded into the Studio shell - keep old links working.
  async redirects() {
    return [
      /* IA §1.2 - deleted V2 customer routes 301 to their successors.

         THESE ALL POINTED AT `/app*`, WHICH NO LONGER EXISTS. The customer
         rooms moved to the root and `/app` went with them, so every one of
         these sent a bookmark or an old link to a 404 - permanently, because a
         301 is cached by the browser and not asked again. Repointed at the
         addresses that actually answer.

         `/dashboard/sell-car` is a REAL route and is deliberately absent from
         this list; `source: '/dashboard'` matches that path exactly and does
         not shadow anything beneath it. */
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/profile', destination: '/you?panel=profile', permanent: true },
      { source: '/dashboard/notifications', destination: '/you?panel=notifications', permanent: true },
      { source: '/dashboard/offers', destination: '/membership', permanent: true },
      { source: '/dashboard/refer', destination: '/you?panel=referral', permanent: true },
      { source: '/dashboard/cars', destination: '/cars', permanent: true },
      { source: '/dashboard/garage', destination: '/garage', permanent: true },
      { source: '/dashboard/booking', destination: '/studio', permanent: true },
      { source: '/store/board', destination: '/admin', permanent: false },
      { source: '/store/new', destination: '/admin/walkin', permanent: false },
      { source: '/store/attendance', destination: '/admin/attendance', permanent: false },
      { source: '/store/job/:id', destination: '/admin/jobs/:id', permanent: false },
      // pre-Studio-OS destinations, folded into the board
      { source: '/admin/workspace', destination: '/admin', permanent: false },
      { source: '/admin/jobs', destination: '/admin', permanent: false },
    ];
  },
  /* Reduce bundle size - but KEEP console.error.
     `removeConsole: true` compiles away every console call in server code too,
     so the Booking Service's failure log vanished in production. Now that one
     route is the only way a visit can be created, a 500 there with no log is a
     studio that has stopped taking money and cannot see why. */
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
};

module.exports = withPWA(nextConfig);
