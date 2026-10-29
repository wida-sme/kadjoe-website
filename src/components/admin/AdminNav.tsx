'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/hero', label: 'Home page' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/partners', label: 'Partners' },
  { href: '/admin/instagram', label: 'Instagram' },
  { href: '/admin/profile', label: 'Company profile' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminNav({ pending, review }: { pending: number; review: number }) {
  const path = usePathname();
  return (
    <nav className="a-nav" aria-label="Dashboard">
      {ITEMS.map((i) => {
        const current = i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`);
        const badge = i.href === '/admin/instagram' ? pending : i.href === '/admin/partners' ? review : 0;
        return (
          <Link key={i.href} href={i.href} aria-current={current ? 'page' : undefined}>
            {i.label}
            {badge ? <span className="a-badge a-badge--warn" aria-label={`${badge} to review`}>{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
