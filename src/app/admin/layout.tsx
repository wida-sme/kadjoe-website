import type { Metadata } from 'next';
import '@/styles/tokens.css';
import '@/styles/admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s | Kadjoe dashboard' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return children;
}
