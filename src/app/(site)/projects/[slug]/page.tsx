import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gallery, type GalleryRow } from '@/components/site/Gallery';
import { Pic, photoAlt } from '@/components/site/Pic';
import { site } from '@/content/site';
import { CATEGORY_LABEL, designLine, getNextProject, getProject, sheetNo, type Photo } from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/projects/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  const design = designLine(p);
  const facts = [
    `${p.name}${p.location ? `, ${p.location}` : ''}: ${CATEGORY_LABEL[p.category].toLowerCase() === 'f&b' ? 'an F&B' : `a ${CATEGORY_LABEL[p.category].toLowerCase()}`} project built by Kadjoe${p.year ? ` (${p.year})` : ''}.`,
    design && design !== 'Kadjoe' ? `Designed by ${design}.` : p.inHouse ? 'Designed and built by Kadjoe.' : '',
    p.photographers.length ? `Photography by ${p.photographers.map((x) => x.name.replace(/^@/, '')).join(' and ')}.` : '',
  ].filter(Boolean).join(' ');
  return {
    title: p.location ? `${p.name}, ${p.location}` : p.name,
    description: facts,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: p.cover ? { images: [{ url: `/media/${p.cover.id}/1280.webp`, width: 1280, height: Math.round((1280 * p.cover.height) / p.cover.width) }] } : undefined,
  };
}

const LANDSCAPE = 1.15;
const ratio = (p: Photo) => p.width / p.height;

/** Hangs the photographs: landscapes alone (full, then inset right, then inset left), portraits in
 *  justified pairs, a leftover portrait alone on alternating sides. */
function hang(photos: Photo[]): GalleryRow[] {
  const rows: GalleryRow[] = [];
  let land = 0, solo = 0;
  for (let i = 0; i < photos.length;) {
    const p = photos[i];
    if (ratio(p) >= LANDSCAPE) {
      rows.push({ kind: (['full', 'right', 'left'] as const)[land++ % 3], photos: [i] });
      i += 1;
    } else if (photos[i + 1] && ratio(photos[i + 1]) < LANDSCAPE) {
      rows.push({ kind: 'pair', photos: [i, i + 1] });
      i += 2;
    } else {
      rows.push({ kind: solo++ % 2 ? 'solo-right' : 'solo-left', photos: [i] });
      i += 1;
    }
  }
  return rows;
}

export default async function ProjectPage({ params }: PageProps<'/projects/[slug]'>) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();
  const next = getNextProject(p.slug);
  const category = p.typeLabel && p.typeLabel !== CATEGORY_LABEL[p.category] ? `${CATEGORY_LABEL[p.category]}, ${p.typeLabel}` : CATEGORY_LABEL[p.category];
  const alt = photoAlt(p.name, p.location);

  const cells: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    { label: 'Sheet', value: <span className="num">{sheetNo(p.no)}</span> },
    { label: 'Category', value: category },
    ...(p.location ? [{ label: 'Location', value: p.location }] : []),
    ...(p.year ? [{ label: 'Year', value: p.year }] : []),
    ...(p.service ? [{ label: 'Service', value: p.service }] : []),
    ...(p.designers.length || p.inHouse ? [{
      label: 'Design',
      value: p.designers.length
        ? p.designers.map((d, i) => (
          <span key={d.slug}>{i ? ' and ' : ''}<Link href={`/partners#${d.slug}`} data-label="Design partners" prefetch={false}>{d.name}</Link></span>
        ))
        : 'Kadjoe',
    }] : []),
    ...(p.photographers.length ? [{
      label: 'Photography',
      value: p.photographers.map((d, i) => (
        <span key={d.slug}>{i ? ' and ' : ''}{d.instagram ? <a href={`https://www.instagram.com/${d.instagram}/`} target="_blank" rel="noopener">{d.name}</a> : d.name}</span>
      )),
    }] : []),
    { label: 'Build', value: 'Kadjoe' },
  ];

  return (
    <article>
      <header className="case-head wrap">
        <h1 className="display case-head__title" data-split="lines" data-intro>{p.name}</h1>
        <div className="tb-wrap" data-tb>
        <span className="tb__rule" aria-hidden="true" />
        <dl className="tb">
          {cells.map((c) => (
            <div key={c.label} className={`tb__cell${c.wide ? ' tb__cell--wide' : ''}`}>
              <dt className="label">{c.label}</dt>
              <dd className="tb__value">{c.value}</dd>
            </div>
          ))}
        </dl>
        </div>
        <div className="double-rule" aria-hidden="true" />
        {p.description ? <p className="case-desc">{p.description}</p> : null}
      </header>

      <Gallery photos={p.photos} rows={hang(p.photos)} alt={alt} name={p.name} />

      {next ? (
        <nav className="next wrap" aria-label="Next project">
          <Link prefetch={false} href={`/projects/${next.slug}`} className="next__row" data-label={next.name} data-sheet={sheetNo(next.no)}>
            <div>
              <span className="label">Next project</span>
              <span className="next__name display">{next.name}</span>
            </div>
            {next.cover ? <Pic photo={next.cover} alt="" className="next__photo" sizes="220px" /> : null}
          </Link>
        </nav>
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: p.name,
            url: `${site.url}/projects/${p.slug}`,
            ...(p.year ? { dateCreated: p.year.slice(0, 4) } : {}),
            ...(p.location ? { locationCreated: { '@type': 'Place', name: p.location } } : {}),
            creator: [
              ...p.designers.map((d) => ({ '@type': 'Organization', name: d.name })),
              { '@type': 'Organization', name: site.legalName },
            ],
            ...(p.cover ? { image: `${site.url}/media/${p.cover.id}/1280.webp` } : {}),
          }).replace(/</g, '\\u003c'),
        }}
      />
    </article>
  );
}
