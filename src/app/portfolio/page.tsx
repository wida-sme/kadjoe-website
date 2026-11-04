/* eslint-disable @next/next/no-html-link-for-pages -- this page has its own look; plain links give the
   rest of the site a full page load, so neither side's CSS stays behind on the other */
import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { PortfolioMotion } from '@/components/portfolio/PortfolioMotion';
import { PortfolioNav } from '@/components/portfolio/PortfolioNav';
import { Pic, photoAlt } from '@/components/site/Pic';
import { site } from '@/content/site';
import { CATEGORIES, type Category } from '@/server/db/schema';
import { getClients, getContact } from '@/server/settings';
import {
  CATEGORY_LABEL, designLine, getCategoryCounts, getDesignPartners, getFeaturedProjects, getHeroSlides, getProjects,
  type Photo, type ProjectCard,
} from '@/server/site/queries';
import '@/styles/portfolio.css';

// The portfolio as a landing page: the built work first, one action (write to Kadjoe). Every number is
// counted from the database; every sentence is a fact or Kadjoe's own words from src/content/site.ts.

export const dynamic = 'force-dynamic';

const geist = Geist({ subsets: ['latin'] });

const TITLE = 'Luxury interior and architecture contractor in Jakarta';

export function generateMetadata(): Metadata {
  const description = `Kadjoe designs and builds luxury homes, restaurants, stores and offices in Jakarta and across Indonesia: ${getProjects().length} projects with ${getDesignPartners().length} design studios since ${site.founded}.`;
  return {
    title: TITLE,
    description,
    alternates: { canonical: '/portfolio' },
    openGraph: {
      type: 'website', url: '/portfolio', siteName: site.legalName, locale: 'en_ID', title: `${TITLE} | ${site.name}`, description,
      images: [{ url: '/og.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = { themeColor: '#131209', colorScheme: 'dark' };

const NAV = [
  { href: '#work', label: 'Work' },
  { href: '#services', label: 'Services' },
  { href: '#studios', label: 'Studios' },
  { href: '#faq', label: 'FAQ' },
];

// Frame shape and srcset size for each slot of the selected work grid.
const SHAPES = ['wide', 'land', 'port', 'port', 'land'] as const;
const SIZES = { wide: '(min-width: 768px) 92vw, 100vw', land: '(min-width: 768px) 56vw, 100vw', port: '(min-width: 768px) 40vw, 100vw' };

const SECTOR_TEXT: Record<Category, string> = {
  residential: 'Houses and apartments',
  fnb: 'Restaurants and cafés',
  commercial: 'Retail, offices and clinics',
};

const meta = (p: ProjectCard) => [p.typeLabel ?? CATEGORY_LABEL[p.category], p.location, p.year].filter(Boolean).join(' · ');

function credit(p: ProjectCard) {
  const d = designLine(p);
  return d === 'Kadjoe' ? 'Designed and built by Kadjoe' : d ? `Design by ${d}` : null;
}

// Phosphor icons, regular weight (MIT).
function ArrowUpRight() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z" />
    </svg>
  );
}
function Plus() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
    </svg>
  );
}

export default function PortfolioPage() {
  const projects = getProjects();
  const counts = getCategoryCounts();
  const studios = getDesignPartners();
  const contact = getContact();
  const clients = getClients();
  const featured = getFeaturedProjects(8);

  // The hero photograph is the first one chosen in the finance app, else the newest project's cover.
  const newest = projects.find((p) => p.cover);
  const hero = getHeroSlides()[0] ?? (newest?.cover ? { photo: newest.cover, project: newest } : null);

  // Each photograph appears once: the hero, then the selected work, then one per sector.
  const shown = new Set(hero ? [hero.photo.id] : []);
  const take = (list: ProjectCard[], n: number) => {
    const out: (ProjectCard & { cover: Photo })[] = [];
    for (const p of list) {
      if (out.length === n) break;
      const { cover } = p;
      if (!cover || shown.has(cover.id) || p.id === hero?.project?.id) continue;
      shown.add(cover.id);
      out.push({ ...p, cover });
    }
    return out;
  };
  const work = take([...featured, ...projects], SHAPES.length);
  const sectors = CATEGORIES.map((c) => ({ c, project: take(projects.filter((p) => p.category === c), 1)[0] }));

  const total = projects.length;
  const withStudio = projects.filter((p) => p.designers.length).length;
  const ownDesign = projects.filter((p) => p.service?.startsWith('Design')).length;
  const mail = `mailto:${contact.email}?subject=${encodeURIComponent('Project enquiry')}`;
  const cta = { href: mail, label: 'Discuss your project' };
  const service = (name: string) => site.services.find((s) => s.name === name)?.text ?? '';
  // The tagline breaks before "and": "The balance of subtle luxe / and unmatched quality."
  const tagline = site.tagline.split(' and ').map((part, i) => (i ? `and ${part}` : part).split(' '));

  const why = [
    {
      n: withStudio, title: "Built to your designer's drawings",
      text: `Projects built to the drawings of ${studios.length} independent design studios. Every project page names the studio that designed it.`,
    },
    { n: ownDesign, title: 'Designed and built by Kadjoe', text: 'Projects Kadjoe designed itself, for owners who want design and construction from one team.' },
    {
      n: total, title: `Homes, venues and stores since ${site.founded}`,
      text: `${counts.residential} residential, ${counts.fnb} F&B and ${counts.commercial} commercial projects, in Jakarta and across Indonesia.`,
    },
  ];

  const faq = [
    {
      q: 'What does Kadjoe build?',
      a: `${site.statement} The ${total} projects on this site are ${counts.residential} residential, ${counts.fnb} F&B and ${counts.commercial} commercial, built since ${site.founded}.`,
    },
    {
      q: "Can you build my own architect's or interior designer's drawings?",
      a: `Yes. ${withStudio} of the ${total} projects here were built to drawings by ${studios.length} independent design studios, and every project page names the studio that designed it.`,
    },
    { q: 'Can Kadjoe design the project as well?', a: `Yes. ${service('Design')} Kadjoe designed and built ${ownDesign} of the projects here.` },
    { q: 'Do you handle civil, mechanical and electrical works?', a: `Yes. ${service('Civil engineering')}` },
    {
      q: 'Do you build outside Jakarta?',
      a: 'Yes. Besides Jakarta, Tangerang, Bekasi and Bogor, Kadjoe has built in Bandung, Semarang, Surabaya, Medan, Bali, Lombok, Batam and Bintan.',
    },
    {
      q: 'How do I start a project?',
      a: `Email ${contact.email} or send a message to @${contact.instagram} on Instagram. The office is at ${contact.addressLines.join(', ')}.`,
    },
  ];

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <div className={`pf ${geist.className}`}>
      <a className="pf-skip button-sm" href="#main">Skip to content</a>
      <PortfolioNav links={NAV} cta={cta} />

      <main id="main" tabIndex={-1}>
        <section className="pf-hero" aria-labelledby="pf-title">
          <div className="pf-wrap pf-hero__in">
            <h1 id="pf-title" className="pf-hero__title heading-4 md:heading-2 lg:heading-1">
              <span>Luxury interiors</span> <span>and architecture,</span> <span>built to the drawing.</span>
            </h1>
            <p className="pf-hero__sub body-7">
              Kadjoe designs and builds homes, restaurants, stores and offices in Jakarta and across Indonesia, from civil works to the
              finished interior.
            </p>
            <div className="pf-hero__act">
              <a className="pf-btn button-md" href={mail}>Discuss your project<ArrowUpRight /></a>
              <p className="caption-1 pf-muted">{total} projects · {studios.length} design studios · Since {site.founded}</p>
            </div>
          </div>
          {hero && (
            <figure className="pf-hero__fig">
              <Pic
                photo={hero.photo} alt={hero.project ? photoAlt(hero.project.name, hero.project.location) : site.legalName}
                sizes="100vw" className="pf-frame pf-frame--hero" priority
              />
              {hero.project && (
                <figcaption className="pf-wrap pf-caption caption-2">
                  <a href={`/projects/${hero.project.slug}`} className="pf-caption__name">{hero.project.name}</a>
                  <span className="pf-muted">{meta(hero.project)}</span>
                  {credit(hero.project) && <span className="pf-muted">{credit(hero.project)}</span>}
                </figcaption>
              )}
            </figure>
          )}
        </section>

        {work.length > 0 && (
          <section id="work" className="pf-section" aria-labelledby="pf-work-title">
            <div className="pf-wrap">
              <div className="pf-head" data-pf-reveal>
                <h2 id="pf-work-title" className="heading-4 md:heading-2">Selected work</h2>
                <a href="/projects" className="pf-link title-4">All {total} projects<ArrowUpRight /></a>
              </div>
              <div className="pf-work">
                {work.map((p, i) => (
                  <article key={p.id} className="pf-card" data-pf-reveal>
                    <a href={`/projects/${p.slug}`} className="pf-card__link">
                      <Pic photo={p.cover} alt={photoAlt(p.name, p.location)} sizes={SIZES[SHAPES[i]]} className={`pf-frame pf-frame--${SHAPES[i]}`} />
                      <div className="pf-card__meta">
                        <div className="pf-card__row">
                          <h3 className="title-1">{p.name}</h3>
                          <ArrowUpRight />
                        </div>
                        <p className="caption-2 pf-muted">{meta(p)}</p>
                        {credit(p) && <p className="caption-2 pf-muted">{credit(p)}</p>}
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="pf-section pf-tagline-wrap" aria-label="Kadjoe's tagline">
          <div className="pf-wrap">
            <p className="pf-tagline heading-3 md:heading-2" data-pf-tagline>
              {tagline.map((line, i) => (
                <span key={i} className="pf-tagline__line">
                  {line.map((w, j) => <span key={j} className="pf-word">{w} </span>)}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section className="pf-section" aria-labelledby="pf-why-title">
          <div className="pf-wrap">
            <h2 id="pf-why-title" className="pf-measure heading-4 md:heading-2" data-pf-reveal>
              From the minds that conceive a space to the hands that build it
            </h2>
            <ul className="pf-why">
              {why.map((w) => (
                <li key={w.title} className="pf-why__item" data-pf-reveal>
                  <p className="pf-num heading-2">{w.n}</p>
                  <h3 className="title-1">{w.title}</h3>
                  <p className="body-6 pf-muted">{w.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pf-section" aria-labelledby="pf-sectors-title">
          <div className="pf-wrap">
            <div className="pf-head" data-pf-reveal>
              <h2 id="pf-sectors-title" className="heading-4 md:heading-2">Browse by sector</h2>
            </div>
            <ul className="pf-sectors">
              {sectors.map(({ c, project }) => (
                <li key={c} data-pf-reveal>
                  <a href={`/projects?category=${c}`} className="pf-sector">
                    {project && (
                      <Pic
                        photo={project.cover} alt={photoAlt(project.name, project.location)}
                        sizes="(min-width: 768px) 31vw, 100vw" className="pf-frame pf-frame--sector"
                      />
                    )}
                    <div className="pf-card__row">
                      <h3 className="heading-5">{CATEGORY_LABEL[c]}</h3>
                      <ArrowUpRight />
                    </div>
                    <p className="caption-2 pf-muted">{counts[c]} projects · {SECTOR_TEXT[c]}</p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="services" className="pf-section" aria-labelledby="pf-services-title">
          <div className="pf-wrap pf-split">
            <div className="pf-split__head" data-pf-reveal>
              <h2 id="pf-services-title" className="heading-4 md:heading-2">Three services, one contractor</h2>
              <p className="body-7 pf-muted">{site.about[0]}</p>
            </div>
            <ol className="pf-steps">
              {site.services.map((s, i) => (
                <li key={s.name} className="pf-step" data-pf-reveal>
                  <p className="caption-3 pf-muted">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="heading-5">{s.name}</h3>
                  <p className="body-3 pf-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {studios.length > 0 && (
          <section id="studios" className="pf-section" aria-labelledby="pf-studios-title">
            <div className="pf-wrap">
              <div className="pf-head" data-pf-reveal>
                <div className="pf-measure pf-stack">
                  <h2 id="pf-studios-title" className="heading-4 md:heading-2">Built with {studios.length} design studios</h2>
                  <p className="body-7 pf-muted">{site.meta.partners}</p>
                </div>
                <a href="/partners" className="pf-link title-4">All design partners<ArrowUpRight /></a>
              </div>
              <ul className="pf-studios" data-pf-reveal>
                {studios.map((s) => (
                  <li key={s.slug} className="pf-studio">
                    <span className="body-5">{s.name}</span>
                    <span className="caption-5 pf-muted">{s.projects.length} {s.projects.length === 1 ? 'project' : 'projects'}</span>
                  </li>
                ))}
              </ul>
              {clients.length > 0 && (
                <div className="pf-clients" data-pf-reveal>
                  <h3 className="title-2">Clients</h3>
                  <ul className="pf-clients__list">
                    {clients.map((c) => <li key={c} className="title-3 pf-muted">{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <section id="faq" className="pf-section" aria-labelledby="pf-faq-title">
          <div className="pf-wrap pf-split">
            <h2 id="pf-faq-title" className="heading-4 md:heading-2" data-pf-reveal>Questions before you build</h2>
            <div className="pf-faq" data-pf-reveal>
              {faq.map((f) => (
                <details key={f.q} className="pf-faq__item">
                  <summary className="title-2">{f.q}<Plus /></summary>
                  <p className="pf-faq__a body-3 pf-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="pf-section" aria-labelledby="pf-cta-title">
          <div className="pf-wrap pf-cta">
            <h2 id="pf-cta-title" className="pf-measure heading-4 md:heading-2" data-pf-reveal>Tell us about your project</h2>
            <p className="pf-measure body-7 pf-muted" data-pf-reveal>
              Send your drawings or a short brief to {contact.email}. Kadjoe builds in Jakarta and across Indonesia.
            </p>
            <div data-pf-reveal>
              <a className="pf-btn button-md" href={mail}>Discuss your project<ArrowUpRight /></a>
            </div>
            <dl className="pf-contact" data-pf-reveal>
              <div>
                <dt className="caption-3 pf-label pf-muted">Email</dt>
                <dd className="body-2"><a className="pf-link" href={`mailto:${contact.email}`}>{contact.email}</a></dd>
              </div>
              {contact.phone && (
                <div>
                  <dt className="caption-3 pf-label pf-muted">Phone</dt>
                  <dd className="body-2"><a className="pf-link" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a></dd>
                </div>
              )}
              <div>
                <dt className="caption-3 pf-label pf-muted">Instagram</dt>
                <dd className="body-2">
                  <a className="pf-link" href={`https://www.instagram.com/${contact.instagram}/`} target="_blank" rel="noopener noreferrer">
                    @{contact.instagram}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="caption-3 pf-label pf-muted">Office</dt>
                <dd className="body-2">
                  {contact.addressLines.map((l) => <span key={l} className="pf-line">{l}</span>)}
                  <a className="pf-link caption-1" href={contact.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="pf-footer">
        <div className="pf-wrap">
          <hr className="pf-rule" />
          <div className="pf-footer__in">
            <a href="/" className="pf-logo" aria-label="Kadjoe, home"><span className="pf-logo__mark" aria-hidden="true" /></a>
            <nav aria-label="Kadjoe website" className="pf-footer__nav">
              {[{ href: '/', label: 'Home' }, ...site.nav].map((n) => (
                <a key={n.href} href={n.href} className="title-4">{n.label}</a>
              ))}
            </nav>
            <p className="caption-5 pf-muted">© {new Date().getFullYear()} {site.legalName}</p>
          </div>
        </div>
      </footer>

      <PortfolioMotion />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />
    </div>
  );
}
