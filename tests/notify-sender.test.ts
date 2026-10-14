// Who hears about a sent form: the employee who sent it, on their phone, when
// the customer files it, and once more a day later if the customer has not.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { senderOf, sourceAfterSend } from "../lib/case-invite";
import { notifyBusiness } from "../lib/mslahtk";
import { mintPrefillToken, verifyPrefillToken } from "../lib/prefill";
import { REMIND_AFTER_MS, dueForReminder } from "../lib/reminders";

const DANA = { sub: "uDana123", email: "dana@almagor-yaarit.com" };

// ── Who sent it ─────────────────────────────────────────────────────────────

test("a send records who sent it and when, and a later send by someone else takes over", () => {
  const at = new Date("2026-10-14T08:00:00Z");
  const first = sourceAfterSend({ page: "/admin/send", invite: true }, DANA, at);
  assert.deepEqual(first, { page: "/admin/send", invite: true, agency: DANA.email, agencyId: DANA.sub, lastSentAt: at.toISOString() });
  assert.equal(senderOf({ source: first as never }), DANA.sub, "the Mslahtk id wins over the email");

  const later = new Date("2026-10-15T09:30:00Z");
  const again = sourceAfterSend({ ...first, remindedAt: "2026-10-15T08:00:00Z" }, { sub: "uMoshe456", email: "moshe@almagor-yaarit.com" }, later);
  assert.equal(senderOf({ source: again as never }), "uMoshe456", "the alerts follow whoever sent it last");
  assert.equal((again as Record<string, unknown>).remindedAt, undefined, "a new send earns a new reminder");
  assert.equal((again as Record<string, unknown>).lastSentAt, later.toISOString());
});

test("older rows fall back to the email they recorded, and nobody on record is null", () => {
  assert.equal(senderOf({ source: { agency: "dana@almagor-yaarit.com" } as never }), "dana@almagor-yaarit.com");
  assert.equal(senderOf({ source: { agency: "  " } as never }), null);
  assert.equal(senderOf({ source: null }), null);
  // A send with no one signed in (never from the back-office, but defensively) keeps no sender.
  assert.equal(senderOf({ source: sourceAfterSend({}, null) as never }), null);
});

test("a link names who made it, and a forged name is dropped", () => {
  const ok = verifyPrefillToken(mintPrefillToken({ slug: "car", values: {}, locked: [], fromLeadId: "sub1", by: DANA.sub }));
  assert.equal(ok?.by, DANA.sub);
  const hostile = verifyPrefillToken(mintPrefillToken({ slug: "car", values: {}, locked: [], by: "../../etc" }));
  assert.equal(hostile?.by, undefined);
  const none = verifyPrefillToken(mintPrefillToken({ slug: "car", values: {}, locked: [] }));
  assert.equal(none && "by" in none, false);
});

// ── The one reminder ────────────────────────────────────────────────────────

test("a sent form is reminded about once, a day after it was sent, and only while its link lives", () => {
  const sentAt = new Date("2026-10-14T08:00:00Z");
  const row = {
    id: "s1",
    name: "רון לוי",
    formTitle: "הודעה על תאונת דרכים",
    mslahtkLeadId: "lead1",
    awaitingCustomer: true,
    parentId: null,
    source: sourceAfterSend({ invite: true }, DANA, sentAt) as never,
  };
  const at = (ms: number) => new Date(sentAt.getTime() + ms);
  assert.equal(dueForReminder(row, at(REMIND_AFTER_MS - 60_000)), false, "not before a day");
  assert.equal(dueForReminder(row, at(REMIND_AFTER_MS)), true, "a day after the send");
  assert.equal(dueForReminder({ ...row, source: { ...(row.source as object), remindedAt: at(REMIND_AFTER_MS).toISOString() } as never }, at(2 * REMIND_AFTER_MS)), false, "only once");
  assert.equal(dueForReminder({ ...row, awaitingCustomer: false }, at(REMIND_AFTER_MS)), false, "filled: nothing to chase");
  assert.equal(dueForReminder(row, at(15 * 24 * 60 * 60_000)), false, "the link has expired");
  assert.equal(dueForReminder({ ...row, source: { invite: true, agency: DANA.email } as never }, at(REMIND_AFTER_MS)), false, "a send from before this version is never chased");
  assert.equal(dueForReminder({ ...row, source: { invite: true, lastSentAt: sentAt.toISOString() } as never }, at(REMIND_AFTER_MS)), false, "nobody to remind");
});

// ── What Mslahtk is asked ───────────────────────────────────────────────────

test("the alert names the employee and asks for the owner's card only when told to", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    calls.push({ url: req.url ?? "", body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, deduped: false, linkId: "l1", deliveredTo: "member" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const keep = { api: process.env.MSLAHTK_API_BASE, pid: process.env.MSLAHTK_PROJECT_ID, tok: process.env.MSLAHTK_SERVICE_TOKEN };
  process.env.MSLAHTK_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MSLAHTK_PROJECT_ID = "proj1";
  process.env.MSLAHTK_SERVICE_TOKEN = "tok";
  try {
    assert.deepEqual(
      await notifyBusiness({ title: "הלקוח מילא את הטופס", body: "רון לוי: הודעה על תאונת דרכים", to: "/admin/s1", leadId: "lead1", recipient: DANA.sub, ownerCard: true }),
      { ok: true },
    );
    assert.equal(calls[0].url, "/service/sites/proj1/notify");
    assert.deepEqual(calls[0].body, {
      title: "הלקוח מילא את הטופס",
      body: "רון לוי: הודעה על תאונת דרכים",
      to: "/admin/s1",
      leadId: "lead1",
      recipient: DANA.sub,
      ownerCard: true,
    });
    await notifyBusiness({ title: "הלקוח עוד לא מילא את הטופס", recipient: DANA.sub });
    assert.equal("ownerCard" in calls[1].body, false, "a reminder is the employee's alone");
    await notifyBusiness({ title: "t" });
    assert.equal("recipient" in calls[2].body, false, "no sender: the owner, as before");
  } finally {
    server.close();
    for (const [k, v] of [["MSLAHTK_API_BASE", keep.api], ["MSLAHTK_PROJECT_ID", keep.pid], ["MSLAHTK_SERVICE_TOKEN", keep.tok]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
