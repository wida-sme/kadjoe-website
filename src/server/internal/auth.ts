import { createHash, timingSafeEqual } from 'node:crypto';

// Shared secret between the finance app and this one; both sit on a private docker network.
const digest = (s: string) => createHash('sha256').update(s).digest();

/** Compares sha256 digests so length differences do not leak. An unset token never matches. */
export function checkToken(req: Request): boolean {
  const expected = process.env.SITE_ADMIN_TOKEN ?? '';
  if (!expected) return false;
  const m = /^Bearer (.*)$/.exec(req.headers.get('authorization') ?? '');
  if (!m) return false;
  return timingSafeEqual(digest(m[1]), digest(expected));
}
