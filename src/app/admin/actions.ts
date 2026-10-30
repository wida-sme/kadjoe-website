'use server';
// Every dashboard write goes through here: sign-in check, input validation, then the service.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, setPassword, signIn, signOut, createUser, verifyPassword } from '@/server/auth';
import { db } from '@/server/db/client';
import { PROJECT_STATUSES, users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { legacy, WRITE } from '@/server/internal/ops';

export type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

// ---------------------------------------------------------------------------------------------
// Session

export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  if (!email || !password) return fail('Enter email and password');
  const r = await signIn(email, password);
  if (!r.ok) return fail(r.error === 'locked' ? 'Too many attempts. Try again in 15 minutes' : 'Wrong email or password');
  redirect('/admin');
}

export async function logoutAction() {
  await signOut();
  redirect('/admin/login');
}

// ---------------------------------------------------------------------------------------------
// Projects, hero, partners, settings: thin wrappers over the internal ops until the finance app owns these pages.

export async function saveProjectAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['project.save']({ id, input });
  revalidatePath(id ? `/admin/projects/${id}` : '/admin/projects');
  return legacy(r);
}

export async function projectFlagsAction(id: string, patch: { status?: (typeof PROJECT_STATUSES)[number]; featured?: boolean }): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['project.flags']({ id, patch });
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  return legacy(r);
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['project.delete']({ id });
  revalidatePath('/admin/projects');
  return legacy(r);
}

export async function photosAction(projectId: string, op: 'order' | 'cover' | 'hide' | 'show' | 'delete' | 'hero', photoIds: string[]): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['photos.op']({ projectId, op, photoIds });
  revalidatePath(`/admin/projects/${projectId}`);
  if (op === 'hero') revalidatePath('/admin/hero');
  return legacy(r);
}

export async function movePhotosAction(fromId: string, photoIds: string[], toId: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['photos.move']({ fromId, photoIds, toId });
  revalidatePath(`/admin/projects/${fromId}`);
  return legacy(r);
}

export async function splitProjectAction(fromId: string, photoIds: string[], name: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['project.split']({ fromId, photoIds, name });
  revalidatePath(`/admin/projects/${fromId}`);
  return legacy(r);
}

export async function mergeProjectAction(fromId: string, intoId: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['project.merge']({ fromId, intoId });
  revalidatePath('/admin/projects');
  return legacy(r);
}

export async function updatePhotoAction(mediaId: string, patch: { alt?: string | null; focalX?: number; focalY?: number }): Promise<ActionResult> {
  await requireUser();
  return legacy(await WRITE['photo.update']({ mediaId, patch }));
}

export async function uploadPhotosAction(projectId: string, form: FormData): Promise<ActionResult> {
  await requireUser();
  form.set('projectId', projectId);
  const r = await WRITE['photos.upload'](form);
  revalidatePath(`/admin/projects/${projectId}`);
  return legacy(r);
}

export async function heroAction(op: 'add' | 'remove' | 'order', values: string[]): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['hero.op']({ op, values });
  revalidatePath('/admin/hero');
  return legacy(r);
}

export async function featuredOrderAction(values: string[]): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['featured.order']({ values });
  revalidatePath('/admin/hero');
  return legacy(r);
}

export async function savePartnerAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['partner.save']({ id, input });
  revalidatePath('/admin/partners');
  return legacy(r);
}

export async function mergePartnerAction(fromId: string, intoId: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['partner.merge']({ fromId, intoId });
  revalidatePath('/admin/partners');
  return legacy(r);
}

export async function deletePartnerAction(id: string): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['partner.delete']({ id });
  revalidatePath('/admin/partners');
  return legacy(r);
}

export async function saveContactAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['contact.save']({ input });
  revalidatePath('/admin/settings');
  return legacy(r);
}

export async function saveClientsAction(list: string[]): Promise<ActionResult> {
  await requireUser();
  const r = await WRITE['clients.save']({ list });
  revalidatePath('/admin/settings');
  return legacy(r);
}

export async function changePasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const current = String(form.get('current') ?? '');
  const next = String(form.get('next') ?? '');
  if (next.length < 10) return fail('Use at least 10 characters');
  const row = db.select().from(users).where(eq(users.id, user.id)).get();
  if (!row || !(await verifyPassword(current, row.passwordHash))) return fail('Current password is wrong');
  await setPassword(user.id, next);
  redirect('/admin/login');
}

export async function addUserAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireUser();
  const s = z.object({ email: z.email(), name: z.string().trim().min(1).max(80), password: z.string().min(10, 'Use at least 10 characters') })
    .safeParse({ email: form.get('email'), name: form.get('name'), password: form.get('password') });
  if (!s.success) return fail(s.error.issues[0]?.message ?? 'Check the form');
  try {
    await createUser(s.data.email, s.data.name, s.data.password);
  } catch {
    return fail('That email already has an account');
  }
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Account created' };
}
