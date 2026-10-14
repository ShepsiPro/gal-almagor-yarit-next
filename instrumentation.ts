// Runs once when the server starts (the Next.js instrumentation hook): the
// timer behind the one-day "not filled yet" reminder (lib/reminders.ts). Node
// only, production only, and only with a database: a dormant site has no sent
// forms to chase. The back-office also nudges it on every visit (app/admin).

const EVERY_MS = 15 * 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || !(process.env.DATABASE_URL || "").trim()) return;
  const { remindUnfilled } = await import("./lib/reminders");
  const tick = () => void remindUnfilled().catch(() => undefined);
  // A minute in, so a restart never races the migrations or the first requests.
  setTimeout(tick, 60_000);
  setInterval(tick, EVERY_MS);
}
