import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connectionSecret } from "@/lib/admin-auth";
import { describeMslahtk, listLeads } from "@/lib/mslahtk";
import { sweepStatuses } from "@/lib/mslahtk-sync";
import { checkBucket, describeStorage, r2Configured } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/mslahtk/health[?probe=1]
 *
 * Is this site connected, and is everything it depends on reachable? Names and
 * counts only, never a value. With probe=1 it makes one real read against
 * Mslahtk and one against the bucket, so a missing scope, a revoked token or
 * a wrong bucket name shows up here instead of as a silent empty list.
 */
export async function GET(req: NextRequest) {
  const [submissions, files, deliveries, lastSync] = await Promise.all([
    db.submission.count().catch(() => -1),
    db.submissionFile.count().catch(() => -1),
    db.webhookDelivery.count().catch(() => -1),
    db.syncRun.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: "desc" } }).catch(() => null),
  ]);
  const out: Record<string, unknown> = {
    database: submissions >= 0,
    submissions,
    files,
    webhookDeliveries: deliveries,
    lastSweep: lastSync ? { at: lastSync.finishedAt, updated: lastSync.updated, linked: lastSync.linked, error: lastSync.error } : null,
    mslahtk: { ...describeMslahtk(), hasConnectionSecret: Boolean(process.env.ADMIN_LINK_SECRET || process.env.MSLAHTK_CONNECTION_SECRET), launchReady: Boolean(connectionSecret()) },
    storage: describeStorage(),
  };

  if (req.nextUrl.searchParams.get("probe") === "1") {
    const probe: Record<string, unknown> = {};
    try {
      const page = await listLeads({ limit: 1, timeoutMs: 6_000 });
      probe.mslahtk = { ok: true, totalLeads: page.total };
      probe.sweep = await sweepStatuses({ force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      probe.mslahtk = { ok: false, message: msg, hint: /403/.test(msg) ? "token lacks leads:fields (site-backend preset)" : /401/.test(msg) ? "token invalid or revoked" : undefined };
    }
    probe.storage = r2Configured() ? await checkBucket() : { ok: false, message: "R2 not configured" };
    out.probe = probe;
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
