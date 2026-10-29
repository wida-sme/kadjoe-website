import { randomBytes } from 'node:crypto';

/** 12 url-safe characters (72 bits): short enough for media URLs, wide enough never to collide. */
export const newId = () => randomBytes(9).toString('base64url');

export function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}
