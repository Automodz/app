import type { Metadata, Viewport } from 'next';
import { Unbounded, Outfit, DM_Sans, DM_Mono } from 'next/font/google';
import { CustomerChrome } from '@/navigation';
import { SITE_URL } from '@/lib/company';
import './globals.css';

/**
 * WHAT THIS LAYOUT DELIBERATELY NO LONGER MOUNTS.
 *
 * `AuthProvider`, `ThemeProvider` and `Toaster` were here, so every route —
 * including every customer room — carried the Firebase client SDK, the Zustand
 * store and react-hot-toast in its first load. The customer rooms are now read
 * on the server and import none of them.
 *
 * They live in `components/ClientSession.tsx` and are mounted by the trees that
 * actually run a browser session: `app/admin`, `app/store`, `app/auth`. Those
 * surfaces are unchanged; the providers simply sit one level lower.
 *
 * What is left here is what every address genuinely shares: the fonts, the
 * pre-paint theme script, and the customer chrome (which mounts nothing at an
 * address that is not a room).
 */

/**
 * Self-hosted type.
 *
 * These four families arrived over a render-blocking `<link>` to Google Fonts:
 * an extra DNS lookup, TLS handshake and stylesheet round trip before a single
 * word could paint, then a flash of fallback type when they landed. `next/font`
 * downloads them at build time, serves them from our own origin, and emits the
 * `@font-face` with `size-adjust` so the swap does not move the page.
 *
 * The CSS variables are the same ones `globals.css` already reads, so nothing
 * downstream changes - `--font-hero`, `--font-display`, `--font-body`,
 * `--font-mono` keep their meanings.
 */
const unbounded = Unbounded({
  subsets: ['latin'], weight: ['500', '700', '800'],
  variable: '--font-hero-src', display: 'swap',
});
const outfit = Outfit({
  subsets: ['latin'], weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display-src', display: 'swap',
});
const dmSans = DM_Sans({
  subsets: ['latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-body-src', display: 'swap',
});
const dmMono = DM_Mono({
  subsets: ['latin'], weight: ['400', '500'],
  variable: '--font-mono-src', display: 'swap',
});

const fontVars = `${unbounded.variable} ${outfit.variable} ${dmSans.variable} ${dmMono.variable}`;

export const metadata: Metadata = {
  /* `metadataBase` is what makes every relative canonical and OG image in the
     app resolve to an absolute URL - without it Next warns and share cards
     resolve against localhost. One origin, from lib/company. */
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AutoModz - Premium Car Detailing Studio',
    template: '%s · AutoModz',
  },
  description: 'Book professional car detailing services in Maninagar, Ahmedabad. PPF, Ceramic Coating, Washing & more.',
  applicationName: 'AutoModz',
  manifest: '/manifest.json',
  alternates: { canonical: '/' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AutoModz',
  },
  openGraph: {
    title: 'AutoModz', description: 'Premium Car Detailing Studio',
    type: 'website', siteName: 'AutoModz', locale: 'en_IN',
    url: '/', images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'AutoModz' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoModz', description: 'Premium Car Detailing Studio',
    images: ['/icons/icon-512.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  /* Zoom is NOT ours to take away (WCAG 2.1 SC 1.4.4). `maximum-scale=1` +
     `user-scalable=no` were here to stop iOS auto-zooming a focused input,
     but that is solved by sizing inputs at >=16px - which `Field` already
     does at 19px - not by disabling zoom for everyone. It also made the
     immersive photo viewer unzoomable, which is absurd for a photo viewer. */
  viewportFit: 'cover',
  // keyboard resizes the layout viewport → inputs never hide behind it
  interactiveWidget: 'resizes-content',
  /* the customer product is always-dark; a paper theme-colour made Android
     paint light chrome around a black app and flashed white on launch */
  themeColor: '#0A0B0D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${fontVars}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          /* theme before first paint - reads the SessionManager payload, and
             still understands the pre-SessionManager store so an existing
             customer never gets a light flash on the upgrade */
          __html: `(function(){try{var r=document.documentElement;var dark=true;var s=localStorage.getItem('automodz-session');if(s){var j=JSON.parse(s);if(j&&j.ui&&j.ui.theme==='light')dark=false;}else{var t=localStorage.getItem('automodz-v5');if(t){var d=JSON.parse(t);if(d.state&&d.state.theme==='light')dark=false;}}if(dark){r.classList.replace('light','dark');r.setAttribute('data-theme','dark');}}catch(e){}})()`,
        }} />
      </head>
      <body>
        {/* This layout is shared with the operations application, so the
            customer shell is gated rather than mounted. `CustomerChrome`
            mounts nothing at all at an address that is not a room — see
            that file for why "nothing" is stronger than "hidden". */}
        <CustomerChrome>{children}</CustomerChrome>
      </body>
    </html>
  );
}
