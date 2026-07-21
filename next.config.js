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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Front Desk mode was folded into the Studio shell — keep old links working.
  async redirects() {
    return [
      // IA §1.2 — deleted V2 customer routes 301 to their successors.
      { source: '/dashboard', destination: '/app', permanent: true },
      { source: '/dashboard/profile', destination: '/app?sheet=you', permanent: true },
      { source: '/dashboard/notifications', destination: '/app', permanent: true },
      { source: '/dashboard/offers', destination: '/app', permanent: true },
      { source: '/dashboard/refer', destination: '/app', permanent: true },
      { source: '/dashboard/cars', destination: '/cars', permanent: true },
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
  // Reduce bundle size
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
};

module.exports = withPWA(nextConfig);
