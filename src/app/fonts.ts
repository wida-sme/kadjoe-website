import localFont from 'next/font/local';

// Switzer (Fontshare, FFL): display and text. IBM Plex Mono (OFL): title-block lettering, the face
// closest to Kadjoe's monospaced wordmark. Self-hosted woff2, latin only. Only the weights the site
// sets are declared: next/font preloads every one, ahead of the hero photograph on a slow phone.
// (The company profile PDF has its own TTFs, Plex Mono Medium included.)
export const switzer = localFont({
  src: [
    { path: '../fonts/switzer-300-normal.woff2', weight: '300', style: 'normal' },
    { path: '../fonts/switzer-400-normal.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-switzer',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const plexMono = localFont({
  src: [
    { path: '../fonts/plex-mono-400-normal.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
});
