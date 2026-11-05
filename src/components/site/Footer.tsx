import Link from 'next/link';
import { site } from '@/content/site';
import { addressLine } from '@/lib/format';
import type { Contact } from '@/server/settings';

/** The back cover, in Kadjoe's black: logo, tagline and copyright; three columns; then a white-line architect's
 *  drawing across the bottom (a two-storey house with dimensions and finish notes), on the same pure black.
 *  Phones get a crop around the house itself. The words fade in once; the drawing rises with the scroll, from faint
 *  to full, and settles as the page's foot arrives (src/engine/reveal.ts; none under reduced motion). The copyright
 *  has no reveal: at the page's very foot its top never reaches a scroll trigger, so it would stay hidden. */
export function Footer({ contact }: { contact: Contact }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer__top" data-reveal="fade" data-duration="0.4">
        <div className="footer__brand">
          <Link prefetch={false} href="/" className="footer__logo" aria-label="Kadjoe, home" data-label="Kadjoe">
            <span className="logo" aria-hidden="true" />
          </Link>
        </div>
        <div className="footer__cols">
          <nav className="footer__col" aria-labelledby="footer-pages">
            <h2 id="footer-pages" className="footer__head">Pages</h2>
            {site.nav.map((n) => <Link prefetch={false} key={n.href} href={n.href}>{n.label}</Link>)}
          </nav>
          <div className="footer__col">
            <h2 className="footer__head">Office</h2>
            <address>{contact.addressLines.map((l) => <span key={l}>{addressLine(l)}</span>)}</address>
            <a href={contact.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a>
          </div>
          <div className="footer__col">
            <h2 className="footer__head">Contact</h2>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            {contact.phone ? <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a> : null}
            <a href={`https://www.instagram.com/${contact.instagram}/`} target="_blank" rel="noopener">Instagram @{contact.instagram}</a>
          </div>
        </div>
      </div>

      <div className="footer__art" data-rise aria-hidden="true">
        <picture>
          <source media="(max-width: 600px)" srcSet="/brand/footer-drawing-phone.webp" width={760} height={540} />
          <img src="/brand/footer-drawing.webp" alt="" width={2000} height={711} loading="lazy" decoding="async" />
        </picture>
      </div>
      <p className="footer__legal">© {year} {site.legalName} · Jakarta, est. {site.founded}</p>
    </footer>
  );
}
