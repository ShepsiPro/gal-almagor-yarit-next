// The agency's accident notice (the "claim" form, 2026-09-30): what is required,
// what is not, and what only appears when the customer says so. The two owner
// requests, section 7 optional and the third party's name optional, are pinned
// here so they cannot quietly come back.
import test from "node:test";
import assert from "node:assert/strict";
import { allFields, getForm, identityField, isFieldVisible, publicForms, type FormField } from "../lib/forms";
import { WA_HREF } from "../lib/site";

const form = getForm("claim")!;
const fields = allFields(form);
const field = (name: string): FormField => {
  const f = fields.find((x) => x.name === name);
  assert.ok(f, `the form has no field "${name}"`);
  return f;
};
const visible = (name: string, values: Record<string, string>) => isFieldVisible(form, field(name), values);

test("the claim form is the accident notice, on the same public link", () => {
  assert.equal(form.slug, "claim");
  assert.equal(form.title, "הודעה על תאונת דרכים");
  assert.ok(publicForms().some((f) => f.slug === "claim"), "still listed for the agency to send");
  assert.equal(form.requiresToken, undefined);
  assert.equal(fields.filter((f) => f.type === "file").length, 0, "documents go by WhatsApp, not by upload");
});

test("the sections are the draft's eight, in its order, then the privacy consent", () => {
  assert.deepEqual(
    form.sections.map((s) => s.title),
    ["פרטים כלליים על התאונה", "תיאור התאונה", "פרטי נהג הרכב המבוטח", "פרטי רכב צד שלישי והנהג", "רכבים נוספים", "עדים", "מצב הרכב והמוסך", "מסמכים ותמונות לשליחה", "אישור"],
  );
});

test("section 7 (the car and the garage) is optional, every field of it", () => {
  const section = form.sections[6];
  assert.equal(section.title, "מצב הרכב והמוסך");
  assert.deepEqual(
    section.fields.map((f) => f.name),
    ["drivable", "tow", "vehicleLocation", "garageType", "garageName", "garagePhone"],
  );
  for (const f of section.fields) {
    assert.ok(!f.required, `${f.name} must stay optional`);
    assert.equal(f.showWhen, undefined, `${f.name} is always shown, never hidden behind an answer`);
  }
  assert.match(section.description ?? "", /אינם חובה/, "the customer is told the section is optional");
});

test("the third party's name is optional, their vehicle number is still asked for", () => {
  assert.ok(!field("thirdOwner").required, "the other side's name is optional");
  assert.ok(!field("thirdDriver").required);
  assert.equal(field("thirdVehicle").required, true, "the draft keeps the third party's vehicle number required");
});

test("exactly the draft's required fields are required, nothing more and nothing less", () => {
  const required = fields.filter((f) => f.required).map((f) => f.name).sort();
  const expected = [
    "fullName", "idNumber", "phone", "vehicleNumber", "accidentDate", "accidentTime", "accidentPlace", "police", // 1
    "description", "fault", // 2
    "driverName", "driverId", "driverBirthDate", "driverPhone", // 3
    "thirdVehicle", // 4
    "extraVehicles", "extraVehicleDetails", // 5 (the details only once the customer says yes)
    "consent",
  ].sort();
  assert.deepEqual(required, expected);
});

test("follow-up questions appear only after the answer that asks for them", () => {
  assert.equal(visible("extraVehicleDetails", {}), false);
  assert.equal(visible("extraVehicleDetails", { extraVehicles: "לא" }), false);
  assert.equal(visible("extraVehicleDetails", { extraVehicles: "כן" }), true);
  assert.equal(field("extraVehicleDetails").required, true, "asked, so answered, but only when shown");

  for (const name of ["witnessName", "witnessPhone"]) {
    assert.equal(visible(name, {}), false, `${name} waits for the question`);
    assert.equal(visible(name, { witnesses: "לא" }), false);
    assert.equal(visible(name, { witnesses: "כן" }), true);
    assert.ok(!field(name).required, `${name}: a witness's details are optional`);
  }

  assert.equal(visible("police_notice", {}), false);
  assert.equal(visible("police_notice", { police: "לא" }), false);
  assert.equal(visible("police_notice", { police: "כן" }), true);
});

test("the insured and the driver have their ID checked; the other side's is kept as typed", () => {
  assert.equal(field("idNumber").type, "id");
  assert.equal(field("driverId").type, "id");
  assert.equal(field("thirdOwnerId").type, "text");
  assert.equal(field("thirdDriverId").type, "text");
});

test("dates are real date fields, so they are read and written day first", () => {
  for (const name of ["accidentDate", "driverBirthDate"]) assert.equal(field(name).type, "date");
});

test("the customer's name and phone can be pre-filled by the agency's link", () => {
  assert.equal(identityField(form, "name")?.name, "fullName");
  // The back-office send tool and the link builder both fill a field called "phone".
  assert.equal(field("phone").type, "tel");
  assert.equal(field("phone").prefillable, true);
  assert.equal(fields.find((f) => f.type === "tel")?.name, "phone", "the first phone on the form is the customer's own, it is what the lead is filed under");
});

test("the documents section points at the agency's WhatsApp", () => {
  const docs = form.sections[7];
  const buttons = docs.fields.filter((f) => f.action);
  assert.equal(buttons.length, 1);
  const url = new URL(buttons[0].action!.href);
  assert.ok(buttons[0].action!.href.startsWith(`${WA_HREF}?text=`), "the site's own WhatsApp, with an opening line");
  assert.ok(url.searchParams.get("text"), "the opening line is not empty");
  assert.equal(docs.fields.filter((f) => f.items).length, 2, "one checklist for the insured vehicle, one for the third party");
  // Nothing in this section is an input: it can never block a submission.
  assert.ok(docs.fields.every((f) => f.type === "statement"));
});

test("field names are unique (they are React keys and the target of every showWhen)", () => {
  const names = fields.map((f) => f.name);
  assert.equal(new Set(names).size, names.length);
  for (const f of fields) {
    if (f.showWhen) assert.ok(names.includes(f.showWhen.field), `${f.name} waits on a field that does not exist`);
  }
});

test("no dash separators in anything the customer reads", () => {
  const copy: string[] = [form.eyebrow, form.title, form.intro, form.submitLabel, form.successTitle, form.successBody];
  for (const s of form.sections) {
    copy.push(s.title, s.description ?? "");
    for (const f of s.fields) {
      copy.push(f.label, f.placeholder ?? "", f.help ?? "", f.body ?? "", ...(f.options ?? []), ...(f.items ?? []), f.action?.label ?? "");
    }
  }
  for (const text of copy) assert.ok(!new RegExp("[\\u2014\\u2013\\u2015]").test(text), `dash in: ${text}`);
});
