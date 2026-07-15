'use client';
import { MapPin, Phone, Clock } from 'lucide-react';
import Wordmark from '@/components/ui/Wordmark';
import Magnetic from './Magnetic';

/**
 * Location-forward footer. A detailing atelier converts on proximity, so the
 * address, hours and a magnetic Directions action lead — the legal line trails.
 */
export default function SiteFooter() {
  return (
    <footer className="relative px-5 sm:px-8 pb-12" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-[1240px] mx-auto pt-16 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark height={24} variant="ink" />
          <p className="font-body mt-6" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', maxWidth: 300 }}>
            A detailing atelier for people who notice the surface. Paint protection,
            ceramic and correction — done to a standard, in Maninagar.
          </p>
        </div>

        <div>
          <p className="font-mono mb-5" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--faint)' }}>STUDIO</p>
          <p className="font-body flex items-start gap-2.5" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--fg-dim)' }}>
            <MapPin size={15} className="mt-1 shrink-0" style={{ color: 'var(--muted)' }} />
            Bhairavnath Rd, Maninagar,<br />Ahmedabad, Gujarat 380028
          </p>
          <p className="font-mono flex items-center gap-2 mt-4" style={{ fontSize: 11, color: 'var(--muted)' }}>
            <Clock size={13} /> OPEN DAILY · 9:00 – 21:00
          </p>
        </div>

        <div>
          <p className="font-mono mb-5" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--faint)' }}>CONTACT</p>
          <div className="flex flex-col items-start gap-3">
            <a href="tel:+919512605088" className="font-body inline-flex items-center gap-2.5 transition-colors hover:text-[var(--fg)]" style={{ fontSize: 14, color: 'var(--fg-dim)' }}>
              <Phone size={15} style={{ color: 'var(--muted)' }} /> +91 95126 05088
            </a>
            <Magnetic strength={0.3}>
              <a
                href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono mt-1"
                style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--on-accent)', background: 'var(--accent)', borderRadius: 12, padding: '11px 18px' }}
              >
                <MapPin size={13} /> GET DIRECTIONS
              </a>
            </Magnetic>
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto mt-16 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>
          © {new Date().getFullYear()} AUTOMODZ · CRAFTED IN AHMEDABAD
        </p>
        <p className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)' }}>
          THE SURFACE IS EVERYTHING
        </p>
      </div>
    </footer>
  );
}
