// Checks Instagram for new posts on a timer inside the server process (one container, one timer).
// Started from src/instrumentation.ts; off in development unless KADJOE_SITE_SCHEDULER=on.
import { getInstagram } from '../settings';
import { runSync } from './sync';

const g = globalThis as unknown as { __kadjoeScheduler?: NodeJS.Timeout };

export function startScheduler() {
  if (g.__kadjoeScheduler) return;
  const minutes = Math.max(10, Number(process.env.IG_SYNC_MINUTES || 30));
  const tick = async () => {
    try {
      if (!getInstagram().token) return;
      const r = await runSync('schedule');
      if (!r.ok) console.warn(`[instagram] ${r.message}`);
      else if (r.seen) console.log(`[instagram] ${r.message}: ${r.imported} imported, ${r.pending} waiting`);
    } catch (e) {
      console.warn('[instagram] check failed:', e instanceof Error ? e.message : e);
    }
  };
  g.__kadjoeScheduler = setInterval(tick, minutes * 60_000);
  g.__kadjoeScheduler.unref();
  setTimeout(tick, 60_000).unref(); // first check a minute after start
  console.log(`[instagram] checking every ${minutes} minutes`);
}
