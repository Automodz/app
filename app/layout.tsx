import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoModz — Premium Car Detailing Studio',
  description: 'Book professional car detailing services in Maninagar, Ahmedabad. PPF, Ceramic Coating, Washing & more.',
  manifest: '/manifest.json',
  icons: { apple: '/icon-192.png' },
  openGraph: {
    title: 'AutoModz', description: 'Premium Car Detailing Studio',
    type: 'website', siteName: 'AutoModz',
  },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  maximumScale: 1, userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FF5500',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('automodz-v2');if(t){var d=JSON.parse(t);if(d.state&&d.state.theme==='light'){document.documentElement.classList.replace('dark','light')}}}catch(e){}})()`,
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
                  background: 'rgba(26,26,30,0.95)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontFamily: 'DM Sans, sans-serif',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  padding: '12px 16px',
                },
                success: { iconTheme: { primary: '#FF5500', secondary: 'white' } },
                error:   { iconTheme: { primary: '#F87171', secondary: 'white' } },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
