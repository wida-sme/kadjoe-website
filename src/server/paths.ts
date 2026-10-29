import path from 'node:path';

// Everything the site writes lives under one directory: the database and the photographs.
// Production mounts it as a volume (KADJOE_SITE_DATA_DIR=/data). The turbopackIgnore comments keep
// Next's file tracer from copying the whole project into the standalone build.
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.KADJOE_SITE_DATA_DIR || 'data');
export const DB_FILE = path.join(/*turbopackIgnore: true*/ DATA_DIR, 'site.db');
export const MEDIA_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, 'media');
export const MIGRATIONS_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.KADJOE_SITE_MIGRATIONS_DIR || 'drizzle');
