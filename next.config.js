/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Reduce bundle size
  compiler: { removeConsole: process.env.NODE_ENV === 'production' },
};

module.exports = nextConfig;
