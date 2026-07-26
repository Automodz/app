const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: true,
  fallbacks: { document: '/offline' },
  // Fresh-first: a new deploy takes over as soon as the page reloads,
  // instead of returning visitors being served the previously cached shell.
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
        'https://api.cloudinary.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
        'wss://*.firebaseio.com',
      ].join(' '),
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
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
      // IA §1.2 - deleted V2 customer routes 301 to their successors.
      { source: '/dashboard', destination: '/app', permanent: true },
      { source: '/dashboard/profile', destination: '/app/you', permanent: true },
      { source: '/dashboard/notifications', destination: '/app', permanent: true },
      { source: '/dashboard/offers', destination: '/app', permanent: true },
      { source: '/dashboard/refer', destination: '/app', permanent: true },
      { source: '/dashboard/cars', destination: '/cars', permanent: true },
      { source: '/dashboard/garage', destination: '/app/garage', permanent: true },
      { source: '/dashboard/booking', destination: '/app?sheet=arrange', permanent: true },
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
