import type { Metadata } from 'next';
import Link from 'next/link';
import { PreviewBox } from '@/components/site/Pic';
import { site } from '@/content/site';
import { getDesignPartners, sheetNo } from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Design partners',
  description: site.meta.partners,
  alternates: { canonical: '/partners' },
};

export default function PartnersPage() {
  // Drawn in a new random order for every visit: the list is not a ranking.
  const partners = getDesignPartners();
  return (
    <>
      <header className="page-head wrap">
        <div className="page-head__row">
          <h1 className="display" data-split="lines" data-intro>Design partners</h1>
          <span className="page-head__count">{partners.length}</span>
        </div>
      </header>
      <section className="wrap" aria-label="Studios">
        <ul className="plist" data-preview-list>
          {partners.map((p) => (
            <li key={p.slug} id={p.slug} className="prow">
              <h2 className="prow__name">{p.name}</h2>
              {p.instagram ? (
                <a className="prow__ig" href={`https://www.instagram.com/${p.instagram}/`} target="_blank" rel="noopener">@{p.instagram}</a>
              ) : <span />}
              <ul className="prow__projects" aria-label={`Projects with ${p.name}`}>
                {p.projects.map((proj) => (
                  <li key={proj.slug}>
                    <Link href={`/projects/${proj.slug}`} prefetch={false} data-label={proj.name} data-sheet={sheetNo(proj.no)} data-preview={proj.cover ? `/media/${proj.cover.id}/640.webp` : undefined}>
                      {proj.name}{proj.location && p.projects.filter((x) => x.name === proj.name).length > 1 ? `, ${proj.location}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <PreviewBox />
      </section>
    </>
  );
}
