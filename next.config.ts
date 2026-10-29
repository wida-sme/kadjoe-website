import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Photographs live in data/media and are resized on demand by /media/[id]/[file]; next/image only
  // builds the srcset (src/lib/image-loader.ts), so the widths below are the only variants that exist.
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    deviceSizes: [640, 960, 1280, 1600, 1920, 2560],
    imageSizes: [160, 320, 480],
    qualities: [75],
  },
  // The PDF reads its fonts and logo from disk; make sure the standalone build carries them.
  outputFileTracingIncludes: {
    '/api/admin/profile': ['./src/server/profile/fonts/**', './src/server/profile/*.png'],
  },
  experimental: {
    // Unmatched URLs get a server-rendered 404 (src/app/global-not-found.tsx).
    globalNotFound: true,
    // Dashboard uploads go through server actions; one photograph can be a 20 MB camera file.
    serverActions: { bodySizeLimit: '32mb' },
  },
};

export default nextConfig;
