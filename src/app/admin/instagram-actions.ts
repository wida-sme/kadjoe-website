'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db/client';
import { CATEGORIES, igPosts } from '@/server/db/schema';
import { getMe, InstagramError } from '@/server/instagram/api';
import { approvePost, ignorePosts, runSync } from '@/server/instagram/sync';
import { getInstagram, setInstagram } from '@/server/settings';
import type { ActionResult } from './actions';

const done = (r: ActionResult) => { revalidatePath('/admin/instagram'); revalidatePath('/admin', 'layout'); return r; };

export async function igSyncNowAction(): Promise<ActionResult> {
  await requireUser();
  const r = await runSync('manual');
  return done(r.ok ? { ok: true, message: `${r.message}: ${r.imported} imported, ${r.pending} waiting` } : { ok: false, error: r.message });
}

/** For a long-lived token generated in the Meta app dashboard (Instagram > API setup > Generate token). */
export async function igSaveTokenAction(token: string): Promise<ActionResult> {
  await requireUser();
  const t = token.trim();
  if (t.length < 20) return { ok: false, error: 'Paste the whole token' };
  try {
    const me = await getMe(t);
    setInstagram({
      token: t, userId: me.user_id ?? me.id, username: me.username, connectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 59 * 86_400_000).toISOString(), lastError: null,
    });
    return done({ ok: true, message: `Connected as @${me.username}` });
  } catch (e) {
    return { ok: false, error: e instanceof InstagramError ? `Instagram refused the token: ${e.message}` : 'Could not reach Instagram' };
  }
}

export async function igDisconnectAction(): Promise<ActionResult> {
  await requireUser();
  setInstagram({ token: null, userId: null, username: null, expiresAt: null, connectedAt: null });
  return done({ ok: true, message: 'Disconnected' });
}

export async function igOptionsAction(input: { autoPublish: boolean; importSince: string | null }): Promise<ActionResult> {
  await requireUser();
  const s = z.object({ autoPublish: z.boolean(), importSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).safeParse(input);
  if (!s.success) return { ok: false, error: 'Check the date' };
  setInstagram({ autoPublish: s.data.autoPublish, importSince: s.data.importSince ? `${s.data.importSince}T00:00:00.000Z` : null });
  return done({ ok: true, message: 'Saved' });
}

const approveSchema = z.object({
  shortcode: z.string().min(5).max(40),
  intoId: z.string().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  location: z.string().trim().max(160).nullable().optional(),
  year: z.string().trim().max(20).nullable().optional(),
});

export async function igApproveAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const s = approveSchema.safeParse(input);
  if (!s.success) return { ok: false, error: s.error.issues[0]?.message ?? 'Check the form' };
  try {
    const { shortcode, intoId, ...overrides } = s.data;
    const r = await approvePost(shortcode, intoId, overrides);
    return done({ ok: true, id: r.projectId, message: `${r.added} photograph${r.added === 1 ? '' : 's'} imported` });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'Import failed' };
  }
}

export async function igIgnoreAction(shortcodes: string[]): Promise<ActionResult> {
  await requireUser();
  ignorePosts(shortcodes.filter((s) => /^[A-Za-z0-9_-]{5,40}$/.test(s)));
  return done({ ok: true, message: 'Ignored' });
}

export async function igIgnoreOlderAction(): Promise<ActionResult> {
  await requireUser();
  db.update(igPosts).set({ status: 'ignored' }).where(and(eq(igPosts.status, 'pending'), like(igPosts.note, 'Posted before%'))).run();
  return done({ ok: true, message: 'Older posts ignored' });
}

export async function igStatus() {
  await requireUser();
  const s = getInstagram();
  return { connected: !!s.token, username: s.username };
}
