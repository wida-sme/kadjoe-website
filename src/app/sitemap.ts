import type { MetadataRoute } from 'next';
import { site } from '@/content/site';
import { getProjects } from '@/server/site/queries';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/projects', '/portfolio', '/partners', '/about', '/contact'].map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'weekly' as const, priority: p ? 0.7 : 1 }));
  const projects = getProjects().map((p) => ({ url: `${site.url}/projects/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 }));
  return [...pages, ...projects];
}
