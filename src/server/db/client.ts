import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DATA_DIR, DB_FILE, MIGRATIONS_DIR } from '../paths';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

// One connection per process. Next can evaluate this module more than once in dev, so the handle
// is parked on globalThis.
const g = globalThis as unknown as { __kadjoeDb?: { sqlite: Database.Database; db: DB } };

export function openDatabase(file = DB_FILE) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { sqlite, db };
}

function conn() {
  if (!g.__kadjoeDb) g.__kadjoeDb = openDatabase();
  return g.__kadjoeDb;
}

export const db: DB = new Proxy({} as DB, {
  get: (_t, prop) => Reflect.get(conn().db, prop),
});

export const sqlite = () => conn().sqlite;

/** Writes run inside one immediate transaction: SQLite serialises them, readers never see half a change. */
export function tx<T>(fn: (d: DB) => T): T {
  const c = conn();
  return c.sqlite.transaction(() => fn(c.db)).immediate();
}
