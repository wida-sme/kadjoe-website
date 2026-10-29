// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const on = process.env.KADJOE_SITE_SCHEDULER ?? (process.env.NODE_ENV === 'production' ? 'on' : 'off');
  if (on !== 'on') return;
  const { startScheduler } = await import('./server/instagram/scheduler');
  startScheduler();
}
