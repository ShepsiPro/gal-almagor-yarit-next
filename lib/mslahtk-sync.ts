// Mslahtk -> this site.
//
// A lead's pipeline status lives in Mslahtk, because that is where the agency
// moves it. The back-office shows it as a MIRROR: filled by webhook deliveries
// when a subscription exists, and by a throttled sweep on admin visits so it
// is right even without one. Both are idempotent, and both also LINK: a
// submission whose lead create timed out, but which Mslahtk stored anyway
// (the lead carries `_submissionId`), gets its lead id filled in after the
// fact. Pure helpers first, database work below.

import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { listLeads, mslahtkConfigured } from "./mslahtk";

export const SWEEP_MIN_INTERVAL_MS = 5 * 60_000;

export type Delivery = { event: string; ts: string; payload: Record<string, unknown> };

/** X-Mslahtk-Signature is the hex HMAC-SHA256 of the RAW body with the connection secret. */
export function verifySignature(rawBody: string, signatureHex: string | null | undefined, secret: string): boolean {
  if (!secret || !signatureHex) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const given = Buffer.from(String(signatureHex).trim().toLowerCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function parseDelivery(rawBody: string): Delivery | null {
  try {
    const obj = JSON.parse(rawBody) as Record<string, unknown>;
    const event = typeof obj.event === "string" ? obj.event : "";
    if (!event) return null;
    const payload = obj.payload && typeof obj.payload === "object" ? (obj.payload as Record<string, unknown>) : {};
    return { event, ts: typeof obj.ts === "string" ? obj.ts : new Date().toISOString(), payload };
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Link a lead to the submission it was filed for, by the marker the lead carries. */
async function linkLead(lead: { id: string; fields?: unknown; status?: unknown }): Promise<boolean> {
  const sid = str(obj(lead.fields)?._submissionId);
  if (!sid) return false;
  try {
    const res = await db.submission.updateMany({
      where: { id: sid, mslahtkLeadId: null },
      data: { mslahtkLeadId: lead.id, mslahtkStatus: str(lead.status) || "new", mslahtkError: null, mslahtkSyncedAt: new Date() },
    });
    return res.count > 0;
  } catch {
    // The lead id is already on another row: nothing to link.
    return false;
  }
}

/**
 * Apply one delivery. Idempotent by delivery id: a redelivery is answered
 * "duplicate" and not applied again. Returns the outcome so the route can
 * answer 200 once it is settled.
 */
export async function applyDelivery(deliveryId: string, d: Delivery, projectId: string): Promise<string> {
  const seen = await db.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (seen) return "duplicate";

  let outcome = "ignored";
  try {
    const pid = str(d.payload.projectId);
    if (pid && projectId && pid !== projectId) {
      outcome = "ignored: another business";
    } else if (d.event === "lead.created") {
      const lead = obj(d.payload.lead);
      const id = str(lead?.id) || str(d.payload.leadId);
      outcome = id && lead && (await linkLead({ id, fields: lead.fields, status: lead.status })) ? "linked" : "ignored: not a submission of this site";
    } else if (d.event === "lead.status_changed") {
      const id = str(d.payload.leadId);
      const to = str(d.payload.to);
      if (id && to) {
        const r = await db.submission.updateMany({
          where: { mslahtkLeadId: id },
          data: { mslahtkStatus: to, mslahtkSyncedAt: new Date() },
        });
        outcome = r.count ? "status updated" : "ignored: unknown lead";
      } else {
        outcome = "ignored: no leadId or status";
      }
    } else {
      outcome = `ignored: ${d.event}`;
    }
  } catch (err) {
    outcome = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  await db.webhookDelivery.create({ data: { id: deliveryId, event: d.event, outcome } });
  return outcome;
}

/**
 * The sweep: re-read the most recent leads from Mslahtk and bring statuses
 * (and missing links) up to date. Throttled, because it runs on admin page
 * views; `force` is for the health probe. Never throws.
 */
export async function sweepStatuses(opts: { force?: boolean } = {}): Promise<{ ran: boolean; updated: number; linked: number; error: string | null }> {
  const idle = { ran: false, updated: 0, linked: 0, error: null };
  if (!mslahtkConfigured()) return idle;

  let runId: string;
  try {
    const last = await db.syncRun.findFirst({ orderBy: { startedAt: "desc" } });
    if (!opts.force && last && Date.now() - last.startedAt.getTime() < SWEEP_MIN_INTERVAL_MS) return idle;
    runId = (await db.syncRun.create({ data: {} })).id;
  } catch (err) {
    return { ...idle, error: err instanceof Error ? err.message : String(err) };
  }

  let updated = 0;
  let linked = 0;
  let error: string | null = null;
  try {
    let offset = 0;
    for (let page = 0; page < 2; page++) {
      const res = await listLeads({ limit: 100, offset, timeoutMs: 6_000 });
      for (const lead of res.items) {
        const status = str(lead.status) || "new";
        const r = await db.submission.updateMany({
          where: { mslahtkLeadId: lead.id, OR: [{ mslahtkStatus: null }, { NOT: { mslahtkStatus: status } }] },
          data: { mslahtkStatus: status, mslahtkSyncedAt: new Date() },
        });
        if (r.count) updated += r.count;
        else if (await linkLead(lead)) linked += 1;
      }
      offset += res.items.length;
      if (res.items.length < 100 || offset >= res.total) break;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  await db.syncRun.update({ where: { id: runId }, data: { finishedAt: new Date(), updated, linked, error } }).catch(() => undefined);
  return { ran: true, updated, linked, error };
}
