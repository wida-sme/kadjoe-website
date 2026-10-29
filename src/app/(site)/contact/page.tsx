import type { Metadata } from 'next';
import { site } from '@/content/site';
import { getContact } from '@/server/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact',
  description: site.meta.contact,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const c = getContact();
  return (
    <>
      <header className="page-head wrap">
        <h1 className="display" data-split="lines" data-intro>Contact</h1>
      </header>
      <section className="contact wrap" aria-label="Contact details">
        <a className="contact__mail" href={`mailto:${c.email}`}>{c.email}</a>
        <div className="contact__grid grid12">
          <div className="contact__cell contact__cell--address">
            <span className="label">Office</span>
            <address>{c.addressLines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}</address>
            <a className="arrow-link" href={c.mapsUrl} target="_blank" rel="noopener">Open in Google Maps <span className="arrow" aria-hidden="true">↗</span></a>
          </div>
          <div className="contact__cell contact__cell--ig">
            <span className="label">Instagram</span>
            <a className="arrow-link" href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noopener">@{c.instagram} <span className="arrow" aria-hidden="true">↗</span></a>
          </div>
          {c.phone ? (
            <div className="contact__cell contact__cell--phone">
              <span className="label">Phone</span>
              <a className="arrow-link" href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}>{c.phone}</a>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
