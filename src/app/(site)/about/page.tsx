import type { Metadata } from 'next';
import Link from 'next/link';
import { Pic } from '@/components/site/Pic';
import { site } from '@/content/site';
import { getClients } from '@/server/settings';
import { getFeaturedProjects, sheetNo } from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About Us',
  description: site.meta.about,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  const clients = getClients();
  const lead = getFeaturedProjects(8).filter((p) => p.cover && p.cover.width / p.cover.height > 1.3)[1] ?? null;
  return (
    <>
      <header className="page-head wrap">
        <h1 className="display" data-split="lines" data-intro>About Us</h1>
      </header>

      <section className="about-lead wrap grid12" aria-label="Kadjoe">
        <div className="about-lead__text">
          {site.about.map((t) => <p key={t} data-split="lines">{t}</p>)}
        </div>
      </section>

      {lead?.cover ? (
        <section className="about-photo wrap grid12" aria-label="Built by Kadjoe">
          <Link prefetch={false} href={`/projects/${lead.slug}`} className="about-photo__cap label" data-label={lead.name} data-sheet={sheetNo(lead.no)}>
            {lead.name}{lead.location ? `, ${lead.location}` : ''}
          </Link>
          {/* The page's lead photograph is there from the first paint, like the hero's: a reveal
              would hold back the largest paint on phones until the scripts run. */}
          <div className="about-photo__frame">
            <Pic photo={lead.cover} alt={`${lead.name}${lead.location ? `, ${lead.location}` : ''}`} sizes="75vw" phone={640} priority />
          </div>
        </section>
      ) : null}

      <section className="services wrap" aria-labelledby="services-title">
        <div className="section-head">
          <h2 id="services-title" className="h2">Services</h2>
        </div>
        <ul className="services__list">
          {site.services.map((s) => (
            <li key={s.name} className="service">
              <h3 className="service__name">{s.name}</h3>
              <p className="service__text">{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {clients.length ? (
        <section className="clients wrap" aria-labelledby="clients-title">
          <div className="section-head">
            <h2 id="clients-title" className="h2">Clients</h2>
            <span className="section-head__count">{clients.length}</span>
          </div>
          <ul className="clients__list">
            {clients.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}
