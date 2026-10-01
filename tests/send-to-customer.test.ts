import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { cleanChannels, cleanRecipient, inviteLink, lastSendLine, leadFieldsFor, sameInvitee, sendLogOf } from "../lib/case-invite";
import { answerMessage, inviteMessage } from "../lib/invite-messages";
import { customerMailMode, renderCustomerEmail } from "../lib/mailer";
import { sendWhatsappText, updateLeadFields } from "../lib/mslahtk";
import { mintPrefillToken, verifyPrefillToken } from "../lib/prefill";
import { getCase, getForm } from "../lib/forms";

// ── What the agent typed ────────────────────────────────────────────────────

test("the customer needs a phone or an email, and both must be real", () => {
  assert.equal(cleanRecipient({ name: "דנה" }).ok, false);
  assert.equal(cleanRecipient({ name: "דנה", phone: "12" }).ok, false);
  assert.equal(cleanRecipient({ name: "דנה", email: "not-an-email" }).ok, false);
  const ok = cleanRecipient({ name: " דנה ", phone: "050-1234567", email: " Dana@Example.com " });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.value, { name: "דנה", phone: "050-1234567", email: "dana@example.com" });
  assert.equal(cleanRecipient({ phone: "050-1234567" }).ok, true);
  assert.equal(cleanRecipient({ email: "a@b.co" }).ok, true);
});

test("only known channels get through", () => {
  assert.deepEqual(cleanChannels(["email", "sms", "whatsapp", "whatsapp"]), ["whatsapp", "email"]);
  assert.deepEqual(cleanChannels("whatsapp"), []);
  assert.deepEqual(cleanChannels(undefined), []);
});

// ── Who an unanswered send belongs to ───────────────────────────────────────

test("the same customer is picked up, a different name on a shared phone is not", () => {
  const row = { name: "רונית כהן", phone: "050-1234567", email: null };
  assert.equal(sameInvitee(row, { name: "רונית כהן", phone: "+972 50 123 4567", email: "" }), true, "same person, phone typed another way");
  assert.equal(sameInvitee(row, { name: "  רונית   כהן ", phone: "0501234567", email: "" }), true, "spacing does not make a new customer");
  assert.equal(sameInvitee(row, { name: "", phone: "0501234567", email: "" }), true, "no name typed this time: still her");
  assert.equal(sameInvitee({ ...row, name: null }, { name: "דני לוי", phone: "0501234567", email: "" }), true, "the earlier send had no name");
  assert.equal(sameInvitee(row, { name: "דני כהן", phone: "0501234567", email: "" }), false, "a couple sharing a number are two files");
  assert.equal(sameInvitee(row, { name: "רונית כהן", phone: "0509999999", email: "" }), false, "another number");
  assert.equal(sameInvitee({ name: "דנה", phone: null, email: "d@e.co" }, { name: "דנה", phone: "", email: "D@E.co" }), true, "email match ignores case");
  assert.equal(sameInvitee({ name: "דנה", phone: null, email: "office@x.co" }, { name: "אבי", phone: "", email: "office@x.co" }), false, "an office address shared by two people");
});

// ── What the Mslahtk card learns when the customer files ────────────────────

test("the card gets the answers day first, without the site's private keys, and says where the file stands", () => {
  const form = getForm("home-request")!;
  const out = leadFieldsFor(form, { full_name: "דנה", birth_date: "1980-02-01", _simulator: "{}", _resentFrom: "x", street: "" }, "2026-09-30T10:05:00.000Z");
  assert.equal(out.full_name, "דנה");
  assert.equal(out.birth_date, "01/02/1980");
  assert.equal(out.form_stage, "הלקוח מילא את הטופס");
  assert.equal(out.form_filledAt, "30/09/2026 13:05");
  assert.ok(!("_simulator" in out) && !("_resentFrom" in out) && !("street" in out));
});

// ── The signed link ─────────────────────────────────────────────────────────

test("the invite link carries the file it completes and what the agent knew, unlocked", () => {
  const form = getForm("home-request")!;
  const url = inviteLink({ form, id: "cmabc123", to: { name: "דנה כהן", phone: "050-1234567", email: "d@e.co" }, origin: "https://almagor-yaarit.com", kind: "form" });
  assert.ok(url.startsWith("https://almagor-yaarit.com/forms/home-request?p="));
  const token = decodeURIComponent(url.split("?p=")[1]);
  const p = verifyPrefillToken(token)!;
  assert.equal(p.slug, "home-request");
  assert.equal(p.inviteId, "cmabc123");
  assert.deepEqual(p.values, { full_name: "דנה כהן", phone: "050-1234567", email: "d@e.co" });
  assert.deepEqual(p.locked, []);
});

test("sending the calculator first keeps the same file on the way to the form", () => {
  const form = getForm("home-request")!;
  const url = inviteLink({ form, id: "cmabc123", to: { name: "", phone: "050-1234567", email: "" }, origin: "https://x.test", kind: "simulator" });
  assert.ok(url.startsWith("https://x.test/simulator/home?p="));
  const p = verifyPrefillToken(decodeURIComponent(url.split("?p=")[1]))!;
  assert.equal(p.slug, "home-request");
  assert.equal(p.inviteId, "cmabc123");
});

test("a token that names an invite cannot be tampered with, and a hostile id is dropped", () => {
  const token = mintPrefillToken({ slug: "home-request", values: {}, locked: [], inviteId: "cmabc123" });
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), inviteId: "cmother" })).toString("base64url");
  assert.equal(verifyPrefillToken(`${forged}.${sig}`), null);
  const hostile = mintPrefillToken({ slug: "home-request", values: {}, locked: [], inviteId: "x/../../etc" });
  assert.equal(verifyPrefillToken(hostile)!.inviteId, undefined);
});

// ── The words ───────────────────────────────────────────────────────────────

test("every message carries the link and the customer's name, and no dash the owner banned", () => {
  const link = "https://almagor-yaarit.com/forms/home-request?p=abc";
  const msgs = [
    inviteMessage({ title: "פנייה להצעת ביטוח לדירת מגורים", link, name: "דנה" }),
    inviteMessage({ title: "x", link, name: "דנה", calculator: true }),
    inviteMessage({ title: "x", link, name: "דנה", calculator: true, calculatorTitle: getCase("home")!.simulatorTitle }),
    answerMessage({ link, name: "דנה" }),
  ];
  for (const m of msgs) {
    assert.ok(m.whatsapp.includes(link));
    assert.ok(m.whatsapp.startsWith("שלום דנה,"));
    assert.equal(m.link, link);
    for (const text of [m.whatsapp, m.subject, m.heading, m.greeting, ...m.lines, m.ctaLabel]) {
      assert.ok(!new RegExp("[\\u2014\\u2013\\u2015]").test(text), `dash in: ${text}`);
    }
  }
  assert.equal(inviteMessage({ title: "t", link }).greeting, "שלום,");
});

test("the calculator is called what the owner named it, on the page's data and in what the agency sends", () => {
  const name = "פנייה להצעת ביטוח לדירת מגורים ועלות ביטוח";
  assert.equal(getCase("home")!.simulatorTitle, name);
  const link = "https://almagor-yaarit.com/simulator/home?p=abc";
  const m = inviteMessage({ title: "פנייה להצעת ביטוח לדירת מגורים", link, name: "דנה", calculator: true, calculatorTitle: name });
  assert.equal(m.heading, name);
  assert.ok(m.subject.startsWith(name));
  assert.ok(m.whatsapp.includes(`"${name}"`) && m.whatsapp.includes(link));
  assert.ok(!m.heading.includes("מחשבון") && !m.subject.includes("מחשבון"), "the old name is gone from the heading and the subject");
  // The form's own message is untouched.
  assert.equal(inviteMessage({ title: "פנייה להצעת ביטוח לדירת מגורים", link, name: "דנה" }).heading, "פנייה להצעת ביטוח לדירת מגורים");
});

test("the customer email escapes what it is given and shows the link twice: button and plain", () => {
  const { html, text } = renderCustomerEmail({ heading: "<b>x</b>", greeting: "שלום", lines: ["a & b"], ctaLabel: "למילוי", link: "https://x.test/?a=1&b=2" });
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.ok(html.includes('href="https://x.test/?a=1&amp;b=2"'));
  assert.ok(text.includes("https://x.test/?a=1&b=2"));
});

test("mail is only attempted when it can log in", () => {
  const keep = { ...process.env };
  try {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    (process.env as Record<string, string>).NODE_ENV = "development";
    assert.equal(customerMailMode(), "preview");
    (process.env as Record<string, string>).NODE_ENV = "production";
    assert.equal(customerMailMode(), "off");
    process.env.SMTP_HOST = "smtp.office365.com";
    process.env.SMTP_USER = "office@almagor-yaarit.com";
    assert.equal(customerMailMode(), "off", "a user with no password fails every send, so do not try");
    process.env.SMTP_PASS = "secret";
    assert.equal(customerMailMode(), "smtp");
  } finally {
    for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "NODE_ENV"]) {
      if (keep[k] === undefined) delete process.env[k];
      else process.env[k] = keep[k];
    }
  }
});

test("the log of what was sent reads as one line", () => {
  assert.equal(lastSendLine({ source: null }), null);
  const at = "2026-09-30T10:05:00.000Z";
  const both = { source: { sends: [{ at, channel: "whatsapp", state: "sent" }, { at, channel: "email", state: "sent" }] } };
  assert.equal(lastSendLine(both), "נשלח בווטסאפ ובמייל 30/09/2026 13:05");
  const manual = { source: { sends: [{ at, channel: "whatsapp", state: "prepared" }] } };
  assert.equal(lastSendLine(manual), "הוכן לשליחה ידנית (ווטסאפ) 30/09/2026 13:05");
  assert.equal(sendLogOf({ source: { sends: "junk" } }).length, 0);
});

// ── Talking to Mslahtk (a local stand-in for its API) ───────────────────────

type Call = { method: string; url: string; body: Record<string, unknown> };

async function withMslahtk<T>(handler: (call: Call, res: http.ServerResponse) => void, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const calls: Call[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    const call = { method: req.method ?? "", url: req.url ?? "", body: raw ? JSON.parse(raw) : {} };
    calls.push(call);
    res.setHeader("content-type", "application/json");
    handler(call, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const keep = { api: process.env.MSLAHTK_API_BASE, pid: process.env.MSLAHTK_PROJECT_ID, tok: process.env.MSLAHTK_SERVICE_TOKEN };
  process.env.MSLAHTK_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MSLAHTK_PROJECT_ID = "proj1";
  process.env.MSLAHTK_SERVICE_TOKEN = "tok";
  try {
    return await run(calls);
  } finally {
    server.close();
    for (const [k, v] of [["MSLAHTK_API_BASE", keep.api], ["MSLAHTK_PROJECT_ID", keep.pid], ["MSLAHTK_SERVICE_TOKEN", keep.tok]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("a WhatsApp send is only a send when Mslahtk says it sent", async () => {
  await withMslahtk(
    (call, res) => res.end(JSON.stringify({ status: call.url.includes("1111") ? "sent" : "suppressed", messageId: "m" })),
    async (calls) => {
      assert.deepEqual(await sendWhatsappText("050-0001111", "hi"), { ok: true });
      const held = await sendWhatsappText("050-0002222", "hi");
      assert.equal(held.ok, false);
      if (!held.ok) assert.equal(held.reason, "not_sent");
      // Israeli local number goes out as E.164, in the path, as a text message.
      assert.equal(calls[0].url, "/service/sites/proj1/whatsapp/contacts/%2B972500001111/messages");
      assert.deepEqual(calls[0].body, { kind: "text", text: "hi" });
    },
  );
});

test("each way a WhatsApp send fails has its own name", async () => {
  const cases: Array<[number, unknown, string]> = [
    [403, { code: "window_closed", message: "Outside 24h" }, "window_closed"],
    [403, { statusCode: 403, message: "Missing required scope: whatsapp:send" }, "no_permission"],
    [404, { message: "not found" }, "not_sent"],
    [500, { message: "boom" }, "not_sent"],
  ];
  for (const [status, body, reason] of cases) {
    await withMslahtk(
      (_c, res) => {
        res.statusCode = status;
        res.end(JSON.stringify(body));
      },
      async () => {
        const r = await sendWhatsappText("050-1234567", "hi");
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.reason, reason, `${status} ${JSON.stringify(body)}`);
      },
    );
  }
  const bad = await sendWhatsappText("12", "hi");
  assert.equal(bad.ok, false);
});

test("no connection to Mslahtk is reported as such, not thrown", async () => {
  const keep = { p: process.env.MSLAHTK_PROJECT_ID, t: process.env.MSLAHTK_SERVICE_TOKEN };
  delete process.env.MSLAHTK_PROJECT_ID;
  delete process.env.MSLAHTK_SERVICE_TOKEN;
  try {
    const r = await sendWhatsappText("050-1234567", "hi");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_configured");
  } finally {
    if (keep.p !== undefined) process.env.MSLAHTK_PROJECT_ID = keep.p;
    if (keep.t !== undefined) process.env.MSLAHTK_SERVICE_TOKEN = keep.t;
  }
});

test("a long form is written onto the lead in batches Mslahtk accepts", async () => {
  const fields: Record<string, string> = {};
  for (let i = 0; i < 95; i++) fields[`k${i}`] = `v${i}`;
  fields.empty = "";
  await withMslahtk(
    (_c, res) => res.end(JSON.stringify({ ok: true })),
    async (calls) => {
      assert.deepEqual(await updateLeadFields("lead1", fields), { ok: true });
      assert.equal(calls.length, 3);
      for (const c of calls) {
        assert.equal(c.method, "PATCH");
        assert.ok(Object.keys(c.body.fields as object).length <= 40);
      }
      const sent = calls.flatMap((c) => Object.keys(c.body.fields as object));
      assert.equal(sent.length, 95);
      assert.ok(!sent.includes("empty"));
    },
  );
});

test("the first batch Mslahtk refuses stops the rest", async () => {
  const fields: Record<string, string> = {};
  for (let i = 0; i < 90; i++) fields[`k${i}`] = "v";
  await withMslahtk(
    (_c, res) => {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "Invalid field key" }));
    },
    async (calls) => {
      const r = await updateLeadFields("lead1", fields);
      assert.equal(r.ok, false);
      assert.equal(calls.length, 1);
    },
  );
});
