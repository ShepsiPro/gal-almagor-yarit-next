// A file's owner here is its lead's assignee in Mslahtk, where an employee can
// be limited to their own leads: only changes are sent, and an owner Mslahtk
// does not count as on the team is sent as nobody.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { leadOwnerChange } from "../lib/staff";
import { setLeadAssignee } from "../lib/mslahtk";

// ── What a file's lead needs ────────────────────────────────────────────────

test("a file with no Mslahtk lead needs nothing", () => {
  assert.equal(leadOwnerChange({ ownerId: "uDana", mslahtkLeadId: null, mslahtkOwnerSynced: null }), null);
});

test("the owner is sent once, and not again while it stays the same", () => {
  assert.deepEqual(leadOwnerChange({ ownerId: "uDana", mslahtkLeadId: "lead1", mslahtkOwnerSynced: null }), {
    leadId: "lead1",
    send: true,
    assignee: "uDana",
    mark: "uDana",
  });
  assert.equal(leadOwnerChange({ ownerId: "uDana", mslahtkLeadId: "lead1", mslahtkOwnerSynced: "uDana" }), null);
});

test("a hand-over is sent", () => {
  assert.deepEqual(leadOwnerChange({ ownerId: "uRami", mslahtkLeadId: "lead1", mslahtkOwnerSynced: "uDana" }), {
    leadId: "lead1",
    send: true,
    assignee: "uRami",
    mark: "uRami",
  });
});

test("a request nobody has is only noted: the lead starts out unassigned, and an assignment made in Mslahtk stands", () => {
  assert.deepEqual(leadOwnerChange({ ownerId: null, mslahtkLeadId: "lead1", mslahtkOwnerSynced: null }), { leadId: "lead1", send: false, mark: "" });
  assert.equal(leadOwnerChange({ ownerId: null, mslahtkLeadId: "lead1", mslahtkOwnerSynced: "" }), null);
});

test("a file that lost its owner after one was sent goes back to nobody there too", () => {
  assert.deepEqual(leadOwnerChange({ ownerId: null, mslahtkLeadId: "lead1", mslahtkOwnerSynced: "uDana" }), {
    leadId: "lead1",
    send: true,
    assignee: null,
    mark: "",
  });
});

// ── The call ────────────────────────────────────────────────────────────────

async function withMslahtk(answer: (body: Record<string, unknown>) => { status: number; json: Record<string, unknown> }, run: (calls: Array<{ method: string; url: string; auth: string; body: Record<string, unknown> }>) => Promise<void>) {
  const calls: Array<{ method: string; url: string; auth: string; body: Record<string, unknown> }> = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    calls.push({ method: req.method || "", url: req.url || "", auth: String(req.headers.authorization || ""), body });
    const out = answer(body);
    res.statusCode = out.status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(out.json));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const keep = { api: process.env.MSLAHTK_API_BASE, pid: process.env.MSLAHTK_PROJECT_ID, tok: process.env.MSLAHTK_SERVICE_TOKEN };
  process.env.MSLAHTK_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MSLAHTK_PROJECT_ID = "proj1";
  process.env.MSLAHTK_SERVICE_TOKEN = "tok";
  try {
    await run(calls);
  } finally {
    process.env.MSLAHTK_API_BASE = keep.api;
    process.env.MSLAHTK_PROJECT_ID = keep.pid;
    process.env.MSLAHTK_SERVICE_TOKEN = keep.tok;
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test("the assignee goes out as a PATCH on the lead, and null clears it", async () => {
  await withMslahtk(
    () => ({ status: 200, json: { ok: true, changed: ["assigneeUserId"] } }),
    async (calls) => {
      assert.deepEqual(await setLeadAssignee("lead1", "uDana"), { ok: true });
      assert.deepEqual(await setLeadAssignee("lead1", null), { ok: true });
      assert.deepEqual(
        calls.map((c) => [c.method, c.url, c.auth, c.body]),
        [
          ["PATCH", "/service/sites/proj1/leads/lead1", "Bearer tok", { assigneeUserId: "uDana" }],
          ["PATCH", "/service/sites/proj1/leads/lead1", "Bearer tok", { assigneeUserId: null }],
        ],
      );
    },
  );
});

test("someone Mslahtk does not count as on the team comes back with its code", async () => {
  await withMslahtk(
    () => ({ status: 400, json: { statusCode: 400, code: "assignee_not_on_team", message: "assigneeUserId must be the owner or an active team member with the leads area" } }),
    async () => {
      const res = await setLeadAssignee("lead1", "uNoa");
      assert.equal(res.ok, false);
      assert.equal(!res.ok && res.code, "assignee_not_on_team");
      assert.equal(!res.ok && res.unsupported, undefined);
    },
  );
});

test("a Mslahtk from before the field is told apart, so the caller backs off quietly", async () => {
  await withMslahtk(
    () => ({ status: 400, json: { statusCode: 400, message: "Nothing to update", error: "Bad Request" } }),
    async () => {
      const res = await setLeadAssignee("lead1", "uDana");
      assert.equal(!res.ok && res.unsupported, true);
    },
  );
});

test("with no Mslahtk connection nothing is sent", async () => {
  const keep = process.env.MSLAHTK_SERVICE_TOKEN;
  delete process.env.MSLAHTK_SERVICE_TOKEN;
  try {
    const res = await setLeadAssignee("lead1", "uDana");
    assert.equal(!res.ok && res.skipped, true);
  } finally {
    if (keep !== undefined) process.env.MSLAHTK_SERVICE_TOKEN = keep;
  }
});
