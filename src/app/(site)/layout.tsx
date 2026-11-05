import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { Motion } from '@/components/site/Motion';
import { site } from '@/content/site';
import { getContact } from '@/server/settings';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/site.css';

// Content comes from the database and changes from the dashboard: render on every request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: './' },
  openGraph: { type: 'website', siteName: site.legalName, locale: 'en_ID', images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image' },
};

export default function SiteLayout({ children }: LayoutProps<'/'>) {
  const contact = getContact();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.legalName,
    alternateName: site.name,
    url: site.url,
    logo: `${site.url}/icon.png`,
    email: contact.email,
    foundingDate: site.founded,
    sameAs: [`https://www.instagram.com/${contact.instagram}/`],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Jl. Perumahan Kalideres Permai Blok C8 No.2',
      addressLocality: 'Kalideres, Jakarta Barat',
      addressRegion: 'DKI Jakarta',
      postalCode: '11840',
      addressCountry: 'ID',
    },
  };
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div id="curtain" aria-hidden="true">
        <div className="curtain__panel">
          <div className="curtain__inner" data-curtain-tb>
            <span className="curtain__mark" />
            <span className="curtain__title"><span className="curtain__label" data-curtain-label /></span>
            <span className="curtain__rule" />
            <span className="curtain__no">N° <span data-curtain-sheet /></span>
          </div>
        </div>
      </div>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer contact={contact} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Suspense fallback={null}><Motion /></Suspense>
    </>
  );
}
