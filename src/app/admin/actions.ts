'use server';
// Every dashboard write goes through here: sign-in check, input validation, then the service.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, setPassword, signIn, signOut, createUser, verifyPassword } from '@/server/auth';
import { db } from '@/server/db/client';
import { CATEGORIES, PROJECT_STATUSES, users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import * as P from '@/server/admin/projects';
import * as R from '@/server/admin/partners';
import { clientsSchema, contactSchema, write as writeSetting } from '@/server/settings';

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
// Projects

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();
const projectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: z.string().trim().max(90).optional(),
  category: z.enum(CATEGORIES),
  typeLabel: text(60),
  location: text(160),
  year: text(20),
  service: text(60),
  inHouse: z.boolean(),
  description: text(1200),
  status: z.enum(PROJECT_STATUSES),
  featured: z.boolean(),
  sortDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  designers: z.array(z.string()).max(8),
  photographers: z.array(z.string()).max(8),
});

export async function saveProjectAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form');
  if (id) {
    P.updateProject(id, parsed.data);
    revalidatePath(`/admin/projects/${id}`);
    return { ok: true, id, message: 'Saved' };
  }
  const newId = P.createProject(parsed.data);
  revalidatePath('/admin/projects');
  return { ok: true, id: newId, message: 'Created' };
}

export async function projectFlagsAction(id: string, patch: { status?: (typeof PROJECT_STATUSES)[number]; featured?: boolean }): Promise<ActionResult> {
  await requireUser();
  const s = z.object({ status: z.enum(PROJECT_STATUSES).optional(), featured: z.boolean().optional() }).safeParse(patch);
  if (!s.success) return fail('Invalid change');
  P.setProjectFlags(id, s.data);
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  return { ok: true };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  await requireUser();
  P.deleteProject(id);
  revalidatePath('/admin/projects');
  return { ok: true };
}

const ids = z.array(z.string().regex(/^[A-Za-z0-9_-]{12}$/)).min(1).max(500);

export async function photosAction(projectId: string, op: 'order' | 'cover' | 'hide' | 'show' | 'delete' | 'hero', photoIds: string[]): Promise<ActionResult> {
  await requireUser();
  const list = ids.safeParse(photoIds);
  if (!list.success) return fail('Select photographs first');
  if (op === 'order') P.reorderPhotos(projectId, list.data);
  else if (op === 'cover') P.setCover(projectId, list.data[0]);
  else if (op === 'hide') P.setPhotosHidden(projectId, list.data, true);
  else if (op === 'show') P.setPhotosHidden(projectId, list.data, false);
  else if (op === 'delete') P.deletePhotos(projectId, list.data);
  else if (op === 'hero') list.data.forEach(P.addHero);
  revalidatePath(`/admin/projects/${projectId}`);
  if (op === 'hero') revalidatePath('/admin/hero');
  return { ok: true };
}

export async function movePhotosAction(fromId: string, photoIds: string[], toId: string): Promise<ActionResult> {
  await requireUser();
  const list = ids.safeParse(photoIds);
  if (!list.success) return fail('Select photographs first');
  P.movePhotos(fromId, list.data, toId);
  revalidatePath(`/admin/projects/${fromId}`);
  return { ok: true, id: toId, message: 'Moved' };
}

export async function splitProjectAction(fromId: string, photoIds: string[], name: string): Promise<ActionResult> {
  await requireUser();
  const list = ids.safeParse(photoIds);
  const n = z.string().trim().min(1).max(120).safeParse(name);
  if (!list.success) return fail('Select photographs first');
  if (!n.success) return fail('Name the new project');
  const id = P.splitProject(fromId, list.data, n.data);
  revalidatePath(`/admin/projects/${fromId}`);
  return { ok: true, id, message: 'New project created as a draft' };
}

export async function mergeProjectAction(fromId: string, intoId: string): Promise<ActionResult> {
  await requireUser();
  P.mergeProjects(fromId, intoId);
  revalidatePath('/admin/projects');
  return { ok: true, id: intoId };
}

export async function updatePhotoAction(mediaId: string, patch: { alt?: string | null; focalX?: number; focalY?: number }): Promise<ActionResult> {
  await requireUser();
  const s = z.object({
    alt: z.string().trim().max(200).transform((v) => v || null).nullable().optional(),
    focalX: z.number().min(0).max(1).optional(),
    focalY: z.number().min(0).max(1).optional(),
  }).safeParse(patch);
  if (!s.success) return fail('Invalid value');
  P.updatePhoto(mediaId, s.data);
  return { ok: true };
}

const MAX_UPLOAD = 30 * 1024 * 1024;
export async function uploadPhotosAction(projectId: string, form: FormData): Promise<ActionResult> {
  await requireUser();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail('Choose photographs');
  let added = 0, skipped = 0;
  for (const f of files) {
    if (f.size > MAX_UPLOAD || !/^image\//.test(f.type)) { skipped++; continue; }
    try {
      const id = await P.addPhoto(projectId, Buffer.from(await f.arrayBuffer()), { source: 'upload', originalName: f.name });
      if (id) added++; else skipped++;
    } catch { skipped++; }
  }
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, message: skipped ? `${added} added, ${skipped} skipped` : `${added} added` };
}

// ---------------------------------------------------------------------------------------------
// Hero

export async function heroAction(op: 'add' | 'remove' | 'order', values: string[]): Promise<ActionResult> {
  await requireUser();
  const list = ids.safeParse(values);
  if (!list.success) return fail('Nothing selected');
  if (op === 'add') list.data.forEach(P.addHero);
  else if (op === 'remove') list.data.forEach(P.removeHero);
  else P.reorderHero(list.data);
  revalidatePath('/admin/hero');
  return { ok: true };
}

export async function featuredOrderAction(values: string[]): Promise<ActionResult> {
  await requireUser();
  const list = ids.safeParse(values);
  if (!list.success) return fail('Nothing selected');
  P.reorderFeatured(list.data);
  revalidatePath('/admin/hero');
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Partners

const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  kind: z.enum(['design', 'photo']),
  instagram: z.string().trim().max(80).transform((v) => v || null).nullable(),
  website: z.union([z.literal(''), z.url()]).transform((v) => v || null).nullable(),
});

export async function savePartnerAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireUser();
  const s = partnerSchema.safeParse(input);
  if (!s.success) return fail(s.error.issues[0]?.message ?? 'Check the form');
  try {
    const pid = id ? (R.updatePartner(id, s.data), id) : R.createPartner(s.data);
    revalidatePath('/admin/partners');
    return { ok: true, id: pid, message: 'Saved' };
  } catch (e) {
    return fail(String(e).includes('UNIQUE') ? 'That Instagram handle is already used' : 'Could not save');
  }
}

export async function mergePartnerAction(fromId: string, intoId: string): Promise<ActionResult> {
  await requireUser();
  R.mergePartners(fromId, intoId);
  revalidatePath('/admin/partners');
  return { ok: true };
}

export async function deletePartnerAction(id: string): Promise<ActionResult> {
  await requireUser();
  R.deletePartner(id);
  revalidatePath('/admin/partners');
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Settings

export async function saveContactAction(input: unknown): Promise<ActionResult> {
  await requireUser();
  const s = contactSchema.safeParse(input);
  if (!s.success) return fail(s.error.issues[0]?.message ?? 'Check the form');
  writeSetting('contact', s.data);
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Saved' };
}

export async function saveClientsAction(list: string[]): Promise<ActionResult> {
  await requireUser();
  const s = clientsSchema.safeParse(list.map((x) => x.trim()).filter(Boolean));
  if (!s.success) return fail('Check the list');
  writeSetting('clients', s.data);
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Saved' };
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
