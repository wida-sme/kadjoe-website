import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from './db/client';
import { loginAttempts, sessions, users } from './db/schema';
import { newId } from './ids';
import { hashPassword, verifyPassword } from './auth-core';

export { hashPassword, verifyPassword };

// Dashboard sign-in. Passwords: scrypt (N=2^15). Sessions: a random token in an httpOnly cookie;
// the database keeps only its sha256, so a leaked database cannot be replayed as a cookie.

export const COOKIE = 'kadjoe_admin';
const SESSION_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export type SessionUser = { id: string; email: string; name: string };

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const now = new Date().toISOString();
  const row = db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, now)))
    .get();
  return row ?? null;
}

/** For pages and actions of the dashboard: the signed-in user, or a redirect to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  return user;
}

function locked(key: string) {
  const row = db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  return !!row?.lockedUntil && row.lockedUntil > new Date().toISOString();
}

function fail(key: string) {
  const row = db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
  const failures = (row?.failures ?? 0) + 1;
  const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  db.insert(loginAttempts).values({ key, failures, lockedUntil })
    .onConflictDoUpdate({ target: loginAttempts.key, set: { failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: new Date().toISOString() } })
    .run();
}

export type SignInResult = { ok: true } | { ok: false; error: 'invalid' | 'locked' };

export async function signIn(emailRaw: string, password: string): Promise<SignInResult> {
  const email = emailRaw.trim().toLowerCase();
  const key = `email:${email}`;
  if (locked(key)) return { ok: false, error: 'locked' };
  const user = db.select().from(users).where(eq(users.email, email)).get();
  // Always spend the scrypt time so a missing account answers as slowly as a wrong password.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !ok) { fail(key); return { ok: false, error: 'invalid' }; }
  db.delete(loginAttempts).where(eq(loginAttempts.key, key)).run();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.insert(sessions).values({ id: sha(token), userId: user.id, expiresAt: expiresAt.toISOString() }).run();
  db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id)).run();
  db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', expires: expiresAt,
    secure: process.env.NODE_ENV === 'production' && process.env.KADJOE_SITE_INSECURE_COOKIE !== '1',
  });
  return { ok: true };
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, sha(token))).run();
  jar.delete(COOKIE);
}

export async function createUser(email: string, name: string, password: string) {
  const id = newId();
  db.insert(users).values({ id, email: email.trim().toLowerCase(), name: name.trim(), passwordHash: await hashPassword(password) }).run();
  return id;
}

export async function setPassword(userId: string, password: string) {
  db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId)).run();
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}
