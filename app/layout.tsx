import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoModz - Premium Car Detailing Studio',
  description: 'Book professional car detailing services in Maninagar, Ahmedabad. PPF, Ceramic Coating, Washing & more.',
  manifest: '/manifest.json',
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
    type: 'website', siteName: 'AutoModz',
  },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  maximumScale: 1, userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F7F7F6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Outfit:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var r=document.documentElement;var dark=false;if(location.pathname==='/'){dark=true;}else{var t=localStorage.getItem('automodz-v5');if(t){var d=JSON.parse(t);if(d.state&&d.state.theme==='dark')dark=true;}}if(dark){r.classList.replace('light','dark');r.setAttribute('data-theme','dark');}}catch(e){}})()`,
        }} />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--glass-2)',
                  color: 'var(--fg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  padding: '12px 16px',
                },
                success: { iconTheme: { primary: '#5FBF8F', secondary: '#111214' } },
                error:   { iconTheme: { primary: '#E06C75', secondary: '#111214' } },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
