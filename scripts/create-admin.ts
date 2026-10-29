// First dashboard account, or a password reset:
//   npm run admin:create -- --name "Nama" --email you@example.com          (prints a generated password)
//   npm run admin:create -- --reset --email you@example.com
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { openDatabase } from '../src/server/db/client';
import { users } from '../src/server/db/schema';
import { hashPassword } from '../src/server/auth-core';
import { newId } from '../src/server/ids';

async function main() {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i > -1 ? args[i + 1] : undefined; };
  const email = opt('email')?.trim().toLowerCase();
  if (!email) throw new Error('--email is required');
  const password = randomBytes(12).toString('base64url');
  const { db, sqlite } = openDatabase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (args.includes('--reset')) {
    if (!existing) throw new Error(`No account for ${email}`);
    db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, existing.id)).run();
  } else {
    if (existing) throw new Error(`${email} already has an account; use --reset`);
    db.insert(users).values({ id: newId(), email, name: opt('name') ?? email, passwordHash: await hashPassword(password) }).run();
  }
  console.log(`${email}\npassword: ${password}\nSign in at /admin/login and change it under Settings.`);
  sqlite.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
