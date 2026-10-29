import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Timestamps are UTC ISO strings. Ids are short random strings (src/server/ids.ts).
const created = () => text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);
const updated = () => text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

export const CATEGORIES = ['residential', 'fnb', 'commercial'] as const;
export type Category = (typeof CATEGORIES)[number];
export const PROJECT_STATUSES = ['published', 'draft', 'hidden'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: created(),
  lastLoginAt: text('last_login_at'),
});

export const sessions = sqliteTable('sessions', {
  // sha256 of the cookie token; the token itself is never stored.
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: created(),
});

export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(), // email or ip
  failures: integer('failures').notNull().default(0),
  lockedUntil: text('locked_until'),
  updatedAt: updated(),
});

export const partners = sqliteTable('partners', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  // design: interior design or architecture studio. photo: photographer.
  kind: text('kind', { enum: ['design', 'photo'] }).notNull(),
  instagram: text('instagram'),
  website: text('website'),
  // Created by the Instagram import from a bare handle: the name still needs a human look.
  needsReview: integer('needs_review', { mode: 'boolean' }).notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('partners_instagram').on(t.instagram)]);

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category', { enum: CATEGORIES }).notNull(),
  // Free label shown next to the category, e.g. Retail, Office, Clinic, Café.
  typeLabel: text('type_label'),
  location: text('location'),
  year: text('year'),
  service: text('service'),
  // Designed by Kadjoe itself (no partner studio).
  inHouse: integer('in_house', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  status: text('status', { enum: PROJECT_STATUSES }).notNull().default('published'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  featuredOrder: integer('featured_order').notNull().default(0),
  coverId: text('cover_id'),
  // Newest work first; filled from the photographs' dates, editable.
  sortDate: text('sort_date').notNull(),
  source: text('source', { enum: ['legacy', 'instagram', 'manual'] }).notNull().default('manual'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('projects_category').on(t.category, t.status), index('projects_sort').on(t.sortDate)]);

export const projectPartners = sqliteTable('project_partners', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  partnerId: text('partner_id').notNull().references(() => partners.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['design', 'photo'] }).notNull(),
  position: integer('position').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.projectId, t.partnerId, t.role] }), index('project_partners_partner').on(t.partnerId)]);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  blur: text('blur').notNull(), // tiny webp data URL
  color: text('color').notNull(), // dominant colour, #rrggbb
  focalX: real('focal_x').notNull().default(0.5),
  focalY: real('focal_y').notNull().default(0.5),
  alt: text('alt'),
  position: integer('position').notNull().default(0),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  source: text('source', { enum: ['legacy-wp', 'legacy-ig', 'instagram', 'upload'] }).notNull(),
  originalName: text('original_name'),
  igMediaId: text('ig_media_id'),
  igShortcode: text('ig_shortcode'),
  igIndex: integer('ig_index'),
  takenAt: text('taken_at'),
  hash: text('hash').notNull(), // 64-bit difference hash, hex: finds near-duplicates
  bytes: integer('bytes').notNull(),
  createdAt: created(),
}, (t) => [index('media_project').on(t.projectId, t.position), index('media_shortcode').on(t.igShortcode)]);

export const heroSlides = sqliteTable('hero_slides', {
  id: text('id').primaryKey(),
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdAt: created(),
});

export const IG_POST_STATUSES = ['imported', 'pending', 'ignored', 'not_project', 'error'] as const;
export type IgPostStatus = (typeof IG_POST_STATUSES)[number];

export const igPosts = sqliteTable('ig_posts', {
  shortcode: text('shortcode').primaryKey(),
  igMediaId: text('ig_media_id'),
  permalink: text('permalink'),
  caption: text('caption'),
  postedAt: text('posted_at'),
  mediaType: text('media_type'),
  status: text('status', { enum: IG_POST_STATUSES }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  // Why a post waits for a person (pending) or was skipped.
  note: text('note'),
  parsed: text('parsed', { mode: 'json' }),
  fetchedAt: created(),
  importedAt: text('imported_at'),
}, (t) => [index('ig_posts_status').on(t.status, t.postedAt)]);

export const igSyncRuns = sqliteTable('ig_sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  trigger: text('trigger', { enum: ['schedule', 'manual'] }).notNull(),
  ok: integer('ok', { mode: 'boolean' }),
  seen: integer('seen').notNull().default(0),
  imported: integer('imported').notNull().default(0),
  pending: integer('pending').notNull().default(0),
  message: text('message'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: updated(),
});
