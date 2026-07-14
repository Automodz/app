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
        display: ["'Outfit'", 'sans-serif'],
        body:    ["'DM Sans'", 'sans-serif'],
        mono:    ["'DM Mono'", 'monospace'],
      },
      fontWeight: { 500: '500', 600: '600', 700: '700', 800: '800', 900: '800' },
      colors: {
        foreground: 'var(--fg)',
        muted:      'var(--muted)',
        ember:      { DEFAULT: 'var(--accent)', hot: '#FFFFFF', cool: 'var(--accent-2)' },
        orange:     { 400: 'var(--accent-2)', 500: 'var(--accent)' },
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
