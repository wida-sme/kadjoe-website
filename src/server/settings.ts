import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db/client';
import { settings } from './db/schema';

// Small editable facts live in the settings table as JSON, each with a schema and a default, so a
// missing or malformed row never breaks a page.

export const ADDRESS = 'Jl. Perumahan Kalideres Permai Blok C8 No.2, Kalideres, Kec. Kalideres, Kota Jakarta Barat, Daerah Khusus Ibukota Jakarta 11840';

export const contactSchema = z.object({
  email: z.email(),
  phone: z.string().trim().max(40).default(''),
  instagram: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/),
  addressLines: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
  mapsUrl: z.url(),
});
export type Contact = z.infer<typeof contactSchema>;

const DEFAULTS = {
  contact: {
    email: 'info@kadjoe.com',
    phone: '',
    instagram: 'kadjoe_id',
    addressLines: ['Jl. Perumahan Kalideres Permai Blok C8 No.2', 'Kalideres, Jakarta Barat', 'DKI Jakarta 11840'],
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
  } satisfies Contact,
  // Transcribed from the clients page of Kadjoe's company profile.
  clients: [
    'J.CO', 'BreadTalk', 'Samsung', 'Erafone', 'Miniso', 'Watsons', 'Bank Mandiri', 'BNI', 'Johnny Andrean',
    'Yoshinoya', 'IUIGA', "Bag'us", 'Startime', 'Dr. Barbara Sturm', 'Nappa Milano', 'HMNS', 'Gelato Divino',
    'HONU', 'The Roots', 'Lean Mean', 'ShuShu', 'HAVA', 'Bingsuljip', 'Liang Sandwich Bar', 'Hadi Kitchen', 'Rejuve',
  ],
};

export const clientsSchema = z.array(z.string().trim().min(1).max(60)).max(120);

export const instagramSchema = z.object({
  token: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
  username: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  connectedAt: z.string().nullable().default(null),
  // Posts older than this were handled by the legacy import; they go to the inbox, never straight
  // onto the site.
  importSince: z.string().nullable().default(null),
  autoPublish: z.boolean().default(true),
  lastSyncAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
  // Pending OAuth state; there is no website cookie to hold it any more. Valid for 10 minutes, once.
  oauthState: z.string().nullable().default(null),
  oauthStateAt: z.string().nullable().default(null),
});
export type InstagramState = z.infer<typeof instagramSchema>;

// The company profile PDF's own photos and texts. null = take the website's (About page, Clients list)
// or, for photos, choose one from the projects in the profile. Editing these never changes the website.
const mediaId = z.string().regex(/^[A-Za-z0-9_-]{12}$/).nullable().default(null);
export const profilePdfSchema = z.object({
  coverMediaId: mediaId,
  aboutMediaId: mediaId,
  about: z.array(z.string().trim().min(1).max(700)).min(1).max(4).nullable().default(null),
  services: z.array(z.object({ name: z.string().trim().min(1).max(40), text: z.string().trim().min(1).max(240) })).min(1).max(6).nullable().default(null),
  clients: z.array(z.string().trim().min(1).max(60)).min(1).max(120).nullable().default(null),
});
export type ProfilePdf = z.infer<typeof profilePdfSchema>;

function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

export function write(key: string, value: unknown) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date().toISOString() } })
    .run();
}

export const getContact = () => read('contact', contactSchema, DEFAULTS.contact);
export const getClients = () => read('clients', clientsSchema, DEFAULTS.clients);
export const getProfilePdf = () => read('profilePdf', profilePdfSchema, profilePdfSchema.parse({}));
export const getInstagram = () => read('instagram', instagramSchema, instagramSchema.parse({}));
export const setInstagram = (patch: Partial<InstagramState>) => write('instagram', { ...getInstagram(), ...patch });
