// What the agency fills in before it sends the accident notice: the insured
// vehicle's number, the insurance company and the policy number. Optional for
// the customer, except the vehicle number.
import test from "node:test";
import assert from "node:assert/strict";
import { inviteLink } from "../lib/case-invite";
import { FORMS, agencyFillFields, agencyFillFor, agencyMustFill, allFields, cleanAgencyFill, getForm, prefillableFields } from "../lib/forms";
import { verifyPrefillToken } from "../lib/prefill";

const claim = getForm("claim")!;
const fields = allFields(claim);
const field = (name: string) => {
  const f = fields.find((x) => x.name === name);
  assert.ok(f, `the accident form has no field "${name}"`);
  return f;
};

test("the accident form asks for the insurance company and the policy number, and neither is required", () => {
  const insurer = field("insurer");
  assert.equal(insurer.label, "חברת ביטוח");
  assert.equal(insurer.type, "select");
  assert.ok(!insurer.required);
  assert.ok(insurer.options?.includes("הראל") && insurer.options?.includes("אחר / לא ידוע"), "the agency's insurers, and a way out");
  const policy = field("policyNumber");
  assert.equal(policy.label, "מספר פוליסה");
  assert.equal(policy.type, "text");
  assert.ok(!policy.required);
});

test("the insured vehicle's number stays required for the customer", () => {
  assert.equal(field("vehicleNumber").label, "מספר הרכב המבוטח");
  assert.equal(field("vehicleNumber").required, true);
});

test("they sit in section 1, so the numbered sections and 'section 7' do not move", () => {
  const names = claim.sections[0].fields.map((f) => f.name);
  assert.deepEqual(names.slice(names.indexOf("vehicleNumber"), names.indexOf("vehicleNumber") + 3), ["vehicleNumber", "insurer", "policyNumber"]);
  assert.equal(claim.sections.length, 9);
  assert.equal(claim.sections[6].title, "מצב הרכב והמוסך");
});

test("the agency can fill in exactly those three, and only on this form", () => {
  assert.deepEqual(agencyFillFields(claim).map((f) => f.name), ["vehicleNumber", "insurer", "policyNumber"]);
  for (const f of FORMS) {
    if (f.slug !== "claim") assert.equal(agencyFillFields(f).length, 0, `${f.slug} must not grow fill-in boxes by accident`);
  }
});

test("a plain link can pre-fill them too, and so can the customer's own name and phone", () => {
  const names = prefillableFields(claim);
  for (const n of ["vehicleNumber", "insurer", "policyNumber", "fullName", "phone"]) assert.ok(names.includes(n), `${n} is prefillable`);
});

test("before sending, the agency must give the vehicle number and only that: the company and the policy number may stay empty", () => {
  assert.deepEqual(agencyMustFill(claim).map((f) => f.name), ["vehicleNumber"]);
  assert.deepEqual(agencyFillFields(claim).filter((f) => !f.required).map((f) => f.name), ["insurer", "policyNumber"]);
  for (const f of FORMS) if (f.slug !== "claim") assert.equal(agencyMustFill(f).length, 0, `${f.slug} asks nothing of the agency before sending`);
});

test("the form cannot be sent until the vehicle number is there, whatever else was typed", () => {
  assert.deepEqual(agencyFillFor(claim, {}).missing.map((f) => f.name), ["vehicleNumber"]);
  assert.deepEqual(agencyFillFor(claim, undefined).missing.map((f) => f.name), ["vehicleNumber"]);
  assert.deepEqual(agencyFillFor(claim, { insurer: "הראל", policyNumber: "123" }).missing.map((f) => f.name), ["vehicleNumber"], "the company and the policy number do not stand in for it");
  assert.deepEqual(agencyFillFor(claim, { vehicleNumber: "   " }).missing.map((f) => f.name), ["vehicleNumber"], "blanks do not count");
  const ok = agencyFillFor(claim, { vehicleNumber: " 12-345-67 " });
  assert.deepEqual(ok.missing, []);
  assert.deepEqual(ok.prefill, { vehicleNumber: "12-345-67" }, "the company and the policy number may stay empty");
  assert.deepEqual(agencyFillFor(getForm("home-request")!, {}).missing, [], "forms with nothing for the agency to give are never held back");
});

// ── What the agent typed ────────────────────────────────────────────────────

test("what the agent typed is cleaned: known fields only, trimmed, capped, a choice only if it is one of the options", () => {
  const out = cleanAgencyFill(claim, {
    vehicleNumber: "  12-345-67 ",
    insurer: "הראל",
    policyNumber: "x".repeat(300),
    fullName: "not this one",
    consent: "on",
    __proto__: { evil: "1" },
  });
  assert.equal(out.vehicleNumber, "12-345-67");
  assert.equal(out.insurer, "הראל");
  assert.equal(out.policyNumber.length, 120);
  assert.deepEqual(Object.keys(out).sort(), ["insurer", "policyNumber", "vehicleNumber"], "fields the form does not offer for this are ignored");
});

test("a choice that is not an option, an empty box and a non-text value are dropped", () => {
  assert.deepEqual(cleanAgencyFill(claim, { insurer: "חברה שלא קיימת", vehicleNumber: "   ", policyNumber: 12345 }), {});
});

test("anything that is not an object gives nothing", () => {
  for (const bad of [null, undefined, "vehicleNumber=1", 42, ["12-345-67"]]) assert.deepEqual(cleanAgencyFill(claim, bad), {});
});

test("a form with no fill-in boxes ignores whatever is sent for them", () => {
  assert.deepEqual(cleanAgencyFill(getForm("home-request")!, { vehicleNumber: "12-345-67", insurer: "הראל" }), {});
});

// ── The personal link ───────────────────────────────────────────────────────

const to = { name: "דנה כהן", phone: "050-1234567", email: "" };
const tokenOf = (url: string) => verifyPrefillToken(decodeURIComponent(url.split("?p=")[1]))!;

test("the personal link opens the form with the agency's details filled in, and none of them locked", () => {
  const url = inviteLink({ form: claim, id: "cmabc123", to, origin: "https://almagor-yaarit.com", kind: "form", prefill: { vehicleNumber: "12-345-67", insurer: "מנורה מבטחים", policyNumber: "998877" } });
  const p = tokenOf(url);
  assert.equal(p.slug, "claim");
  assert.equal(p.inviteId, "cmabc123");
  assert.deepEqual(p.values, { fullName: "דנה כהן", phone: "050-1234567", vehicleNumber: "12-345-67", insurer: "מנורה מבטחים", policyNumber: "998877" });
  assert.deepEqual(p.locked, [], "the customer may still correct them");
});

test("the link carries only what the form offers, even if more is passed", () => {
  const url = inviteLink({ form: claim, id: "cmabc123", to, origin: "https://x.test", kind: "form", prefill: { vehicleNumber: "12-345-67", idNumber: "123456782", consent: "on" } });
  assert.deepEqual(Object.keys(tokenOf(url).values).sort(), ["fullName", "phone", "vehicleNumber"]);
});

test("with nothing filled in the link is what it was before: name and phone only", () => {
  assert.deepEqual(tokenOf(inviteLink({ form: claim, id: "cmabc123", to, origin: "https://x.test", kind: "form" })).values, { fullName: "דנה כהן", phone: "050-1234567" });
});
