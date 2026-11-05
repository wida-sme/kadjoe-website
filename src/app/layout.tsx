import type { Metadata, Viewport } from 'next';
import { site } from '@/content/site';
import { cormorant, cormorantItalic, jost } from './fonts';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Design and build, Jakarta`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
};

export const viewport: Viewport = { themeColor: '#f4f4f2', width: 'device-width', initialScale: 1 };

// Runs before first paint. `motion` gates hidden-until-revealed styles; `no-loader` skips the
// loader after the first page of a visit.
const flags = `(function(){var h=document.documentElement;h.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('motion');try{if(sessionStorage.getItem('kadjoe:loaded'))h.classList.add('no-loader')}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jost.variable} ${cormorant.variable} ${cormorantItalic.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: flags }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
