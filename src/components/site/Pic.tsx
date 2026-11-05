import Image, { getImageProps } from 'next/image';
import type { Photo } from '@/server/site/queries';

/** A photograph in a frame. The frame's CSS gives the size (aspect ratio); the image fills it,
 *  cropped around the focal point set in the dashboard. With `phone`, phones get that one width
 *  whatever their pixel density (a page's lead photograph stays light there); larger screens pick
 *  from the srcset as usual. */
export function Pic({
  photo, alt, sizes, className = '', priority = false, critical = false, phone,
}: { photo: Photo; alt: string; sizes: string; className?: string; priority?: boolean; critical?: boolean; phone?: number }) {
  const props = {
    src: `/media/${photo.id}`,
    alt,
    fill: true,
    sizes,
    placeholder: photo.blur ? ('blur' as const) : ('empty' as const),
    blurDataURL: photo.blur,
    style: { objectPosition: `${Math.round(photo.focalX * 100)}% ${Math.round(photo.focalY * 100)}%` },
    ...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {}),
    ...(critical ? { 'data-critical': '' } : {}),
  };
  if (!phone) return <div className={`photo ${className}`}><Image {...props} alt={alt} /></div>;
  const { props: { srcSet, sizes: wide, ...img } } = getImageProps(props);
  return (
    <div className={`photo ${className}`}>
      <picture>
        <source media="(min-width: 768px)" srcSet={srcSet} sizes={wide} />
        <img {...img} alt={alt} src={`/media/${photo.id}/${phone}.webp`} />
      </picture>
    </div>
  );
}

export const photoAlt = (name: string, location?: string | null) => (location ? `${name}, ${location}` : name);

/** The floating photograph that follows the pointer over index lists (src/motion/setup.ts). */
export function PreviewBox() {
  return (
    <div className="preview" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" width={320} height={400} src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
    </div>
  );
}
