// next/image loader: our photographs are addressed as /media/<id>; each srcset width maps to a
// pre-cut WebP served by src/app/media/[id]/[file]/route.ts. Anything else is used as given.
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  return src.startsWith('/media/') ? `${src}/${width}.webp` : src;
}
