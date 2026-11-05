import { Cormorant_Garamond, Jost } from 'next/font/google';

// Two faces, as on the old site (../kadjoe-website): Cormorant Garamond for the hero, titles and names,
// Jost for text and the capital labels. next/font self-hosts them at build time, latin only. The
// italic is only used in the home hero, so it is not preloaded on every page. The earlier faces
// (Switzer, IBM Plex Mono, Zodiak) are still in src/fonts.
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-cormorant', display: 'swap',
});

export const cormorantItalic = Cormorant_Garamond({
  subsets: ['latin'], weight: ['400', '500'], style: 'italic', variable: '--font-cormorant-it', display: 'swap', preload: false,
});

export const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' });
