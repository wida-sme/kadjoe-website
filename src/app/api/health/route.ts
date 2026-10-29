import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// For the container healthcheck and an uptime monitor: the server answers and the database opens.
export function GET() {
  try {
    db.run(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
