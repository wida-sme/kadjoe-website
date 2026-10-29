import Image from 'next/image';
import type { Photo } from '@/server/site/queries';

/** A photograph in a frame. The frame's CSS gives the size (aspect ratio); the image fills it,
 *  cropped around the focal point set in the dashboard. */
export function Pic({
  photo, alt, sizes, className = '', priority = false, critical = false,
}: { photo: Photo; alt: string; sizes: string; className?: string; priority?: boolean; critical?: boolean }) {
  return (
    <div className={`photo ${className}`}>
      <Image
        src={`/media/${photo.id}`}
        alt={alt}
        fill
        sizes={sizes}
        placeholder={photo.blur ? 'blur' : 'empty'}
        blurDataURL={photo.blur}
        style={{ objectPosition: `${Math.round(photo.focalX * 100)}% ${Math.round(photo.focalY * 100)}%` }}
        {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
        {...(critical ? { 'data-critical': '' } : {})}
      />
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
