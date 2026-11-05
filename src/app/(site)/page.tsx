import Link from 'next/link';
import { HeroSheet, type HeroItem } from '@/components/site/HeroSheet';
import { Pic, PreviewBox, photoAlt } from '@/components/site/Pic';
import { site } from '@/content/site';
import { coverWidth, wallSizes } from '@/lib/sizes';
import { CATEGORIES } from '@/server/db/schema';
import {
  CATEGORY_LABEL, designLine, getCategoryCounts, getCategoryCovers, getDesignPartners, getFeaturedProjects, getHeroSlides, sheetNo,
} from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export default function Home() {
  const slides = getHeroSlides();
  const featured = getFeaturedProjects(6);
  const counts = getCategoryCounts();
  const covers = getCategoryCovers();
  const partners = getDesignPartners();
  const total = counts.residential + counts.fnb + counts.commercial;

  const heroItems: HeroItem[] = (slides.length ? slides : featured.filter((p) => p.cover).map((p) => ({ photo: p.cover!, project: p })))
    .map(({ photo, project }) => ({
      photo: { id: photo.id, blur: photo.blur, focalX: photo.focalX, focalY: photo.focalY, width: photo.width, height: photo.height },
      alt: photo.alt ?? (project ? photoAlt(project.name, project.location) : site.legalName),
      project: project ? { slug: project.slug, no: project.no, name: project.name, location: project.location, year: project.year, design: designLine(project) } : null,
    }));

  return (
    <>
      {heroItems.length ? <HeroSheet items={heroItems} title={site.tagline} /> : <h1 className="sr-only">{site.tagline}</h1>}

      <section className="statement wrap grid12" aria-labelledby="statement-title">
        <h2 id="statement-title" className="statement__label label">Est. {site.founded}, Jakarta</h2>
        <div className="statement__body">
          <p className="statement__text" data-split="lines">{site.statement}</p>
          <Link prefetch={false} href="/about" className="arrow-link">About Us <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
      </section>

      {featured.length ? (
        <section className="works wrap" aria-labelledby="works-title">
          <div className="section-head">
            <h2 id="works-title" className="h2">Selected projects</h2>
            <span className="section-head__count">{String(featured.length).padStart(2, '0')} of {total}</span>
          </div>
          <ul className="grid12 wall">
            {featured.map((p, i) => (
              <li key={p.id}>
                <Link prefetch={false} href={`/projects/${p.slug}`} className="card-link" data-label={p.name} data-sheet={sheetNo(p.no)}>
                  {p.cover ? (
                    <div data-reveal="clip" data-delay={String((i % 2) * 0.08)}>
                      <Pic photo={p.cover} alt={photoAlt(p.name, p.location)} className="photo--zoom" sizes={wallSizes(p.cover, i)} />
                    </div>
                  ) : null}
                  <div className="cap cap--sheet">
                    <span className="cap__no">{sheetNo(p.no)}</span>
                    <span className="cap__name">{p.name}</span>
                    <span className="cap__meta">{CATEGORY_LABEL[p.category]}</span>
                    {p.year ? <span className="cap__meta">{p.year}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="works__more">
            <Link prefetch={false} href="/projects" className="arrow-link">All {total} projects <span className="arrow" aria-hidden="true">→</span></Link>
          </div>
        </section>
      ) : null}

      <section className="cats wrap" aria-labelledby="cats-title">
        <h2 id="cats-title" className="sr-only">Categories</h2>
        <ul className="cats__list" data-preview-list>
          {CATEGORIES.map((c) => {
            const cover = covers[c];
            return (
              <li key={c}>
                <Link prefetch={false} href={`/projects?category=${c}`} className="cat" data-label="Projects" data-preview={cover ? `/media/${cover.id}/640.webp` : undefined}>
                  {cover ? <Pic photo={cover} alt="" className="cat__thumb" sizes={coverWidth(cover, 1, '72px')} /> : null}
                  <span className="cat__name" data-preview-label>{CATEGORY_LABEL[c]}</span>
                  <span className="cat__count"><span>{String(counts[c]).padStart(2, '0')}</span><span className="arrow" aria-hidden="true">→</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
        <PreviewBox />
      </section>

      {partners.length ? (
        <section className="partners-home wrap" aria-labelledby="partners-title">
          <div className="section-head">
            <h2 id="partners-title" className="h2">Design partners</h2>
            <Link prefetch={false} href="/partners" className="arrow-link">{partners.length} studios <span className="arrow" aria-hidden="true">→</span></Link>
          </div>
          <ul className="names">
            {partners.map((p) => (
              <li key={p.slug}>
                <Link href={`/partners#${p.slug}`} data-label="Design partners" prefetch={false}>
                  <span>{p.name}</span>
                  <span className="num">{String(p.projects.length).padStart(2, '0')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
