import Link from 'next/link';
import { site } from '@/content/site';
import type { Contact } from '@/server/settings';

export function Footer({ contact }: { contact: Contact }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      {/* The wordmark, spaced across the sheet like Kadjoe's logo. */}
      <p className="footer__word">
        <span className="sr-only">{site.legalName}</span>
        {'KADJOE'.split('').map((c, i) => <span key={i} aria-hidden="true">{c}</span>)}
      </p>
      <div className="footer__grid">
        <div className="footer__col footer__col--address">
          <span className="label">Office</span>
          <address style={{ fontStyle: 'normal' }}>
            {contact.addressLines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}
          </address>
          <a className="ul" href={contact.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a>
        </div>
        <div className="footer__col footer__col--contact">
          <span className="label">Contact</span>
          <a className="ul" href={`mailto:${contact.email}`}>{contact.email}</a>
          {contact.phone ? <a className="ul" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a> : null}
          <a className="ul" href={`https://www.instagram.com/${contact.instagram}/`} target="_blank" rel="noopener">Instagram @{contact.instagram}</a>
        </div>
        <nav className="footer__col footer__col--pages" aria-label="Footer">
          <span className="label">Pages</span>
          {site.nav.map((n) => <Link prefetch={false} key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
      </div>
      <div className="footer__legal">
        <span>© {year} {site.legalName}</span>
        <span>Jakarta, est. {site.founded}</span>
      </div>
    </footer>
  );
}
