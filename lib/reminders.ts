// "Not filled yet": one reminder to the file's owner and whoever sent the
// customer the form, a day after it was sent, if the customer still has not
// filed it. (The colleagues it is shared with hear when the customer DOES fill
// it; the nudge to chase them is for the people the file waits on.)
//
// It goes through the same Mslahtk alert as "the customer filled the form", so
// it lands on that employee's phone and a tap opens the customer's file, where
// "send again" is one click. An employee who has left is not an error: Mslahtk
// gives the owner the alert instead. Sending the form again restarts the clock
// (lib/case-invite.ts sourceAfterSend), so each send earns its own reminder.
//
// Runs on a timer started with the server (instrumentation.ts) and on visits to
// the back-office, throttled, one run at a time. Server-only.

import type { Prisma, Submission } from "@prisma/client";
import { INVITE_TTL_MS, senderOf } from "./case-invite";
import { db } from "./db";
import { mslahtkConfigured } from "./mslahtk";
import { alertFile, loadTeam } from "./staff";

/** How long after a send the customer gets before the sender is reminded. */
export const REMIND_AFTER_MS = 24 * 60 * 60_000;
const MIN_INTERVAL_MS = 5 * 60_000;

type ReminderRow = Pick<Submission, "id" | "name" | "formTitle" | "mslahtkLeadId" | "source" | "awaitingCustomer" | "parentId"> &
  Partial<Pick<Submission, "ownerId">>;

function objectOf(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Is this sent form due its one reminder? Only sends this version recorded
 * (they carry `lastSentAt`) count, so older test sends never wake up as a burst
 * of reminders the day this ships. A link past its two weeks is not chased.
 */
export function dueForReminder(row: ReminderRow, now: Date): boolean {
  if (!row.awaitingCustomer || row.parentId) return false;
  const src = objectOf(row.source);
  if (src.remindedAt) return false;
  const sentAt = typeof src.lastSentAt === "string" ? Date.parse(src.lastSentAt) : NaN;
  if (!Number.isFinite(sentAt)) return false;
  const age = now.getTime() - sentAt;
  return age >= REMIND_AFTER_MS && age < INVITE_TTL_MS && Boolean(senderOf(row));
}

let running = false;
let lastRunAt = 0;

/** Send the reminders that are due. Throttled, one run at a time, never throws. */
export async function remindUnfilled(opts: { force?: boolean; now?: Date } = {}): Promise<{ reminded: number; failed: number }> {
  const out = { reminded: 0, failed: 0 };
  if (running || !mslahtkConfigured()) return out;
  const now = opts.now ?? new Date();
  if (!opts.force && now.getTime() - lastRunAt < MIN_INTERVAL_MS) return out;
  running = true;
  lastRunAt = now.getTime();
  try {
    const rows = await db.submission.findMany({
      // A wide first cut on the indexed column; dueForReminder has the last word
      // (a form sent again long after it was first sent is still in play).
      where: { awaitingCustomer: true, parentId: null, invitedAt: { gte: new Date(now.getTime() - 4 * INVITE_TTL_MS) } },
      select: { id: true, name: true, formTitle: true, mslahtkLeadId: true, source: true, awaitingCustomer: true, parentId: true, ownerId: true },
      orderBy: { invitedAt: "asc" },
      take: 200,
    });
    const due = rows.filter((row) => dueForReminder(row, now));
    const team = due.length ? await loadTeam() : undefined;
    for (const row of due) {
      const told = await alertFile(
        { ownerId: row.ownerId ?? null },
        { title: "הלקוח עוד לא מילא את הטופס", body: `${row.name || "לקוח"}: ${row.formTitle}`, to: `/admin/${row.id}`, leadId: row.mslahtkLeadId || undefined },
        { withShares: false, also: [senderOf(row)], team },
      );
      if (told.failed && !told.told) {
        // Mslahtk took it for nobody: no mark, so the next run tries again.
        // (Taken for some: marked, so they are never reminded twice.)
        out.failed += 1;
        console.error("[reminders] notify failed", { id: row.id, error: told.error });
        continue;
      }
      await markReminded(row.id, now);
      if (told.told) out.reminded += 1;
    }
  } catch (err) {
    console.error("[reminders] run failed", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
  if (out.reminded || out.failed) console.log("[reminders] run", out);
  return out;
}

async function markReminded(id: string, now: Date): Promise<void> {
  const row = await db.submission.findUnique({ where: { id }, select: { source: true } });
  if (!row) return;
  await db.submission
    .update({ where: { id }, data: { source: { ...objectOf(row.source), remindedAt: now.toISOString() } as Prisma.InputJsonObject } })
    .catch((err) => console.error("[reminders] could not mark", { id, error: err instanceof Error ? err.message : String(err) }));
}
