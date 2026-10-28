// Each employee has their own section: who sees which customer file, who may
// hand it over or share it, and who hears when the customer acts on it.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mintEntryToken, mintSessionCookie, readSession, verifyEntryToken } from "../lib/admin-auth";
import {
  alertFile,
  alertRecipients,
  canManage,
  canSee,
  colleagues,
  isUnclaimed,
  nameOf,
  ownerLine,
  sectionWhere,
  sectionsFor,
  teamFrom,
  viewerOf,
} from "../lib/staff";

const at = new Date("2026-10-28T09:00:00Z");
const row = (id: string, role: string, extra: Partial<{ name: string | null; email: string | null; active: boolean; syncedAt: Date | null }> = {}) => ({
  id,
  name: extra.name === undefined ? id : extra.name,
  email: extra.email === undefined ? `${id}@almagor-daood.co.il` : extra.email,
  role,
  active: extra.active ?? true,
  syncedAt: extra.syncedAt === undefined ? at : extra.syncedAt,
});

// The owner (Yarit) and three employees, as Mslahtk lists them; Noa has left.
const TEAM = teamFrom([
  row("uYarit", "owner", { name: "יערית" }),
  row("uDana", "staff", { name: "דנה" }),
  row("uRami", "staff", { name: "רמי" }),
  row("uNoa", "staff", { name: "נועה", active: false }),
  row("uOps", "admin", { name: null, syncedAt: null }),
]);
const YARIT = viewerOf({ sub: "uYarit", role: "owner" });
const DANA = viewerOf({ sub: "uDana", role: "member" });
const RAMI = viewerOf({ sub: "uRami", role: "member" });

// ── Who is looking ──────────────────────────────────────────────────────────

test("the owner of the business and a Mslahtk operator see everything; an employee sees their own", () => {
  assert.equal(viewerOf({ sub: "u1", role: "owner" }).seesAll, true);
  assert.equal(viewerOf({ sub: "u1", role: "admin" }).seesAll, true);
  assert.equal(viewerOf({ sub: "u1", role: "broker" }).seesAll, true);
  assert.equal(viewerOf({ sub: "u1", role: "member" }).seesAll, false);
  assert.equal(viewerOf({ sub: "u1", role: "partner" }).seesAll, false);
  // A session from before Mslahtk sent the role: what everyone saw then, everything.
  assert.equal(viewerOf({ sub: "u1" }).seesAll, true);
  assert.equal(viewerOf({ sub: "unknown", role: "member" }).id, "");
});

test("the role rides the signed entry token into the session, and nothing else can set it", () => {
  const entry = verifyEntryToken(mintEntryToken({ sub: "uDana", email: "dana@x.co.il", pid: "p1", role: "member", lid: "lead1" }));
  assert.deepEqual(entry, { sub: "uDana", email: "dana@x.co.il", pid: "p1", role: "member", lid: "lead1" });
  const session = readSession(mintSessionCookie(entry!).value);
  assert.deepEqual(session, { sub: "uDana", email: "dana@x.co.il", pid: "p1", role: "member" });
  // A token from before roles: no role at all, not an empty one.
  assert.equal("role" in (verifyEntryToken(mintEntryToken({ sub: "u1", pid: "p1" })) ?? {}), false);
  // A role that is not a plain word is dropped.
  assert.equal(verifyEntryToken(mintEntryToken({ sub: "u1", role: "owner\"<x>" }))?.role, undefined);
});

// ── Which files ─────────────────────────────────────────────────────────────

test("an employee sees their own files, the ones shared with them, and the ones nobody has", () => {
  const danas = { ownerId: "uDana", shares: [] };
  const sharedWithRami = { ownerId: "uDana", shares: [{ userId: "uRami" }] };
  const fromTheSite = { ownerId: null, shares: [] };
  const noasOld = { ownerId: "uNoa", shares: [] };
  assert.equal(canSee(DANA, danas, TEAM), true);
  assert.equal(canSee(RAMI, danas, TEAM), false, "a colleague's file stays theirs");
  assert.equal(canSee(RAMI, sharedWithRami, TEAM), true);
  assert.equal(canSee(RAMI, fromTheSite, TEAM), true, "a request nobody has is everyone's to take");
  assert.equal(canSee(RAMI, noasOld, TEAM), true, "the file of someone who left goes back to everyone");
  assert.equal(isUnclaimed(noasOld, TEAM), true);
  assert.equal(isUnclaimed(noasOld, teamFrom([])), false, "before Mslahtk has listed the team, nobody counts as gone");
  for (const f of [danas, sharedWithRami, fromTheSite, noasOld]) assert.equal(canSee(YARIT, f, TEAM), true, "the owner sees every file");
});

test("only the file's owner and the owner of the business hand it over or choose who it is shared with", () => {
  const sharedWithRami = { ownerId: "uDana", shares: [{ userId: "uRami" }] };
  assert.equal(canManage(DANA, sharedWithRami), true);
  assert.equal(canManage(RAMI, sharedWithRami), false, "a colleague it was shared with works it, but does not give it away");
  assert.equal(canManage(YARIT, sharedWithRami), true);
  assert.equal(canManage(DANA, { ownerId: null }), false, "a file nobody has is taken first");
});

test("each section asks the database for the right rows", () => {
  assert.deepEqual(sectionsFor(DANA), { initial: "mine", allowed: ["mine", "open"] });
  assert.deepEqual(sectionsFor(YARIT), { initial: "all", allowed: ["all", "mine", "open"] });
  assert.deepEqual(sectionWhere("mine", DANA, TEAM), { parentId: null, OR: [{ ownerId: "uDana" }, { shares: { some: { userId: "uDana" } } }] });
  assert.deepEqual(sectionWhere("open", DANA, TEAM), {
    parentId: null,
    OR: [{ ownerId: null }, { ownerId: { notIn: ["uYarit", "uDana", "uRami"] } }],
  });
  assert.deepEqual(sectionWhere("open", DANA, teamFrom([])), { parentId: null, OR: [{ ownerId: null }] });
  assert.deepEqual(sectionWhere("all", YARIT, TEAM), { parentId: null });
  assert.deepEqual(sectionWhere("all", YARIT, TEAM, "uRami"), { parentId: null, ownerId: "uRami" });
  // An employee who asks for everything gets their own.
  assert.deepEqual(sectionWhere("all", DANA, TEAM), sectionWhere("mine", DANA, TEAM));
  assert.deepEqual(sectionWhere("mine", viewerOf({ sub: "unknown", role: "member" }), TEAM), { parentId: null, id: "__nobody__" });
});

test("a row says whose it is, from where the viewer stands", () => {
  assert.deepEqual(ownerLine({ ownerId: null }, DANA, TEAM), { text: "ממתינה לשיוך", kind: "open" });
  assert.deepEqual(ownerLine({ ownerId: "uDana", shares: [] }, DANA, TEAM), { text: "שלך", kind: "mine" });
  assert.deepEqual(ownerLine({ ownerId: "uDana", shares: [{ userId: "uRami" }] }, DANA, TEAM), { text: "שלך · משותפת עם רמי", kind: "mine" });
  assert.deepEqual(ownerLine({ ownerId: "uDana", shares: [{ userId: "uRami" }] }, RAMI, TEAM), { text: "משותפת איתך · אצל דנה", kind: "shared" });
  assert.deepEqual(ownerLine({ ownerId: "uRami", shares: [{ userId: "uDana" }, { userId: "uNoa" }] }, YARIT, TEAM), {
    text: "אצל רמי · משותפת עם 2 עמיתים",
    kind: "theirs",
  });
  // The owner of the business can be in a file's share list too: then it is shared with her.
  assert.equal(ownerLine({ ownerId: "uRami", shares: [{ userId: "uYarit" }] }, YARIT, TEAM).kind, "shared");
});

test("a file goes to the people Mslahtk lists as on the team, the owner first, never an operator", () => {
  assert.deepEqual(colleagues(TEAM).map((p) => p.id), ["uYarit", "uDana", "uRami"]);
  // Before Mslahtk has listed anyone: whoever signed in here, still never an operator.
  const early = teamFrom([row("uDana", "unknown", { syncedAt: null }), row("uOps", "admin", { syncedAt: null })]);
  assert.deepEqual(colleagues(early).map((p) => p.id), ["uDana"]);
  assert.equal(nameOf(TEAM, "uDana"), "דנה");
  assert.equal(nameOf(teamFrom([row("uX", "staff", { name: null })]), "uX"), "uX@almagor-daood.co.il");
  assert.equal(nameOf(TEAM, "uStranger"), "עובד/ת");
});

// ── Who hears about it ──────────────────────────────────────────────────────

test("the owner, the colleagues it is shared with and whoever sent the link each hear it once", () => {
  const file = { ownerId: "uDana", shares: [{ userId: "uRami" }, { userId: "uDana" }] };
  assert.deepEqual(alertRecipients(file, { withShares: true, also: ["uRami", "uDana@almagor-daood.co.il"], team: TEAM }), ["uDana", "uRami"]);
  assert.deepEqual(alertRecipients(file, { withShares: false, also: ["uRami"], team: TEAM }), ["uDana", "uRami"], "a reminder: the owner and the sender");
  assert.deepEqual(alertRecipients(file, { withShares: false, team: TEAM }), ["uDana"]);
  // Someone who left is not told (Mslahtk would hand it to the owner of the business, twice).
  assert.deepEqual(alertRecipients({ ownerId: "uNoa", shares: [{ userId: "uRami" }] }, { withShares: true, team: TEAM }), ["uRami"]);
  // Before Mslahtk has listed the team, everyone on record is tried, emails included.
  assert.deepEqual(alertRecipients({ ownerId: "uX" }, { withShares: true, also: ["old@agency.co.il", "unknown", "", null], team: teamFrom([]) }), [
    "uX",
    "old@agency.co.il",
  ]);
});

test("Mslahtk is asked once per person, the owner's card rides along once, and nobody on it means the owner hears", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    calls.push(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, deduped: false, linkId: "l1", deliveredTo: "member" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const keep = { api: process.env.MSLAHTK_API_BASE, pid: process.env.MSLAHTK_PROJECT_ID, tok: process.env.MSLAHTK_SERVICE_TOKEN };
  process.env.MSLAHTK_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MSLAHTK_PROJECT_ID = "proj1";
  process.env.MSLAHTK_SERVICE_TOKEN = "tok";
  const alert = { title: "הלקוח מילא את הטופס", body: "רון לוי: הודעה על תאונת דרכים", to: "/admin/s1", leadId: "lead1" };
  try {
    const told = await alertFile({ ownerId: "uDana", shares: [{ userId: "uRami" }] }, alert, { withShares: true, ownerCard: true, team: TEAM });
    assert.deepEqual(told, { told: 2, failed: 0, error: undefined, skipped: undefined });
    assert.deepEqual(
      calls.map((c) => [c.recipient, c.ownerCard ?? false]),
      [
        ["uDana", true],
        ["uRami", false],
      ],
    );

    calls.length = 0;
    await alertFile({ ownerId: "uYarit", shares: [{ userId: "uDana" }] }, alert, { withShares: true, ownerCard: true, team: TEAM });
    assert.equal(
      calls.some((c) => c.ownerCard),
      false,
      "the owner of the business got the alert itself: no card on top",
    );

    calls.length = 0;
    await alertFile({ ownerId: null }, alert, { withShares: true, ownerCard: true, team: TEAM });
    assert.equal(calls.length, 1);
    assert.equal("recipient" in calls[0], false, "nobody on it: the owner of the business, as before");
    assert.equal("ownerCard" in calls[0], false);
  } finally {
    server.close();
    for (const [k, v] of [["MSLAHTK_API_BASE", keep.api], ["MSLAHTK_PROJECT_ID", keep.pid], ["MSLAHTK_SERVICE_TOKEN", keep.tok]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
