/* eslint-disable @next/next/no-html-link-for-pages -- rendered outside the app router: plain links, full page loads */
import type { Metadata } from 'next';
import { site } from '@/content/site';
import { cormorant, cormorantItalic, jost } from './fonts';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/site.css';

// The 404 for any URL that matches no route. It renders outside the site layout, so it carries its
// own header strip; plain links, a full page load back into the site.
export const metadata: Metadata = {
  title: `Page not found | ${site.name}`,
  description: 'This address has no page on the Kadjoe website.',
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable} ${cormorantItalic.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="header">
          <a href="/" className="header__logo" aria-label="Kadjoe, home"><span className="logo" aria-hidden="true" /></a>
          <nav className="nav" aria-label="Main">
            {site.nav.map((n) => <a key={n.href} href={n.href} className="nav__link">{n.label}</a>)}
          </nav>
          {/* No script on this page: the phone menu is a native disclosure. */}
          <details className="nf-menu">
            <summary>Menu</summary>
            <nav className="nf-menu__panel" aria-label="Menu">
              {site.nav.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
            </nav>
          </details>
        </header>
        <main id="main" tabIndex={-1}>
          <section className="lost wrap" aria-labelledby="lost-title">
            <h1 id="lost-title" className="display">Nothing was built here.</h1>
            <dl className="tb">
              <div className="tb__cell"><dt className="label">Sheet</dt><dd className="tb__value">404</dd></div>
              <div className="tb__cell"><dt className="label">Status</dt><dd className="tb__value">Not found</dd></div>
              <div className="tb__cell"><dt className="label">Build</dt><dd className="tb__value">Kadjoe</dd></div>
            </dl>
            <div className="lost__actions">
              <a href="/projects" className="fill-btn">See the projects <span aria-hidden="true">→</span></a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
