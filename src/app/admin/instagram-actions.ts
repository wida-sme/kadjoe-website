'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth';
import { legacy, WRITE } from '@/server/internal/ops';
import { getInstagram } from '@/server/settings';
import type { ActionResult } from './actions';

// Thin wrappers over the internal ops until the finance app owns the Instagram page.
const run = async (op: string, body?: unknown): Promise<ActionResult> => {
  await requireUser();
  const r = await WRITE[op](body ?? {});
  if (r.ok) { revalidatePath('/admin/instagram'); revalidatePath('/admin', 'layout'); }
  return legacy(r);
};

export async function igSyncNowAction(): Promise<ActionResult> { return run('instagram.sync'); }
export async function igSaveTokenAction(token: string): Promise<ActionResult> { return run('instagram.token', { token }); }
export async function igDisconnectAction(): Promise<ActionResult> { return run('instagram.disconnect'); }
export async function igOptionsAction(input: { autoPublish: boolean; importSince: string | null }): Promise<ActionResult> { return run('instagram.options', input); }
export async function igApproveAction(input: unknown): Promise<ActionResult> { return run('instagram.approve', input); }
export async function igIgnoreAction(shortcodes: string[]): Promise<ActionResult> { return run('instagram.ignore', { shortcodes }); }
export async function igIgnoreOlderAction(): Promise<ActionResult> { return run('instagram.ignoreOlder'); }

export async function igStatus() {
  await requireUser();
  const s = getInstagram();
  return { connected: !!s.token, username: s.username };
}
