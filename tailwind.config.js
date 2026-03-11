/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", 'sans-serif'],
        body:    ["'Space Grotesk'", 'sans-serif'],
        mono:    ["'Space Mono'", 'monospace'],
      },
      fontWeight: { 500: '500', 600: '600', 700: '700', 800: '800', 900: '800' },
      colors: {
        foreground: 'var(--fg)',
        muted:      'var(--muted)',
        ember:      { DEFAULT: '#FF4500', hot: '#FF6622', cool: '#CC3300' },
        orange:     { 400: '#FF6622', 500: '#FF4500' },
      },
      borderRadius: {
        xl2: '20px',
        '2xl': '20px',
        '3xl': '28px',
      },
      animation: {
        'ember-pulse': 'ember-pulse 2.5s ease-in-out infinite',
        'float':       'float-y 3s ease-in-out infinite',
        'shimmer-bg':  'shimmer-bg 2s linear infinite',
      },
    },
  },
  plugins: [],
};
