// The agency's accident notice (the "claim" form): what is required, what is not,
// and what only appears when the customer says so. The owner's requests are
// pinned here so they cannot quietly come back: section 7 and the third party's
// name optional, the time of the accident optional, the police question
// required, a yes to "other vehicles" opening the additional party's details,
// and photos uploaded through the form.
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

test("the time of the accident is optional, its date is not", () => {
  assert.equal(field("accidentTime").label, "שעת התאונה");
  assert.ok(!field("accidentTime").required);
  assert.equal(field("accidentDate").required, true);
});

test("the police question is required", () => {
  assert.equal(field("police").label, "האם הייתה התערבות משטרה?");
  assert.equal(field("police").type, "radio");
  assert.equal(field("police").required, true);
});

test("exactly these fields are required, nothing more and nothing less", () => {
  const required = fields.filter((f) => f.required).map((f) => f.name).sort();
  const expected = [
    "fullName", "idNumber", "phone", "vehicleNumber", "accidentDate", "accidentPlace", "police", // 1
    "description", "fault", // 2
    "driverName", "driverId", "driverBirthDate", "driverPhone", // 3
    "thirdVehicle", // 4
    "extraVehicles", "extraVehicle", // 5 (the additional vehicle's number only once the customer says yes)
    "consent",
  ].sort();
  assert.deepEqual(required, expected);
});

test("a yes to 'other vehicles' opens the additional party's details, the same as section 4", () => {
  const group = ["extra_party_title", "extraOwner", "extraOwnerId", "extraDriver", "extraDriverId", "extraPhone", "extraVehicle", "extraVehicleType", "extraInsurer", "extraPolicy"];
  for (const name of group) {
    assert.equal(visible(name, {}), false, `${name} waits for the answer`);
    assert.equal(visible(name, { extraVehicles: "לא" }), false);
    assert.equal(visible(name, { extraVehicles: "כן" }), true);
  }
  assert.equal(field("extra_party_title").label, "פרטי המעורב הנוסף");
  assert.equal(field("extra_party_title").type, "statement");
  // The same fields as section 4, in the same order, with the same wording.
  const third = form.sections[3].fields.map((f) => [f.type, f.label, Boolean(f.required)]);
  const extra = fields.filter((f) => group.includes(f.name) && f.type !== "statement").map((f) => [f.type, f.label, Boolean(f.required)]);
  assert.deepEqual(extra, third);
  assert.equal(fields.some((f) => f.name === "extraVehicleDetails"), false, "the single free-text box is gone");
});

test("other follow-up questions appear only after the answer that asks for them", () => {
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
  for (const name of ["thirdOwnerId", "thirdDriverId", "extraOwnerId", "extraDriverId"]) assert.equal(field(name).type, "text");
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

// ── Section 8: photos and documents go through the form ─────────────────────

const docs = form.sections[7];
const uploads = docs.fields.filter((f) => f.type === "file");

test("photos and documents are uploaded through the form: one box for each paper in the draft's two lists", () => {
  assert.deepEqual(
    uploads.map((f) => f.label),
    [
      "צילום רישיון הנהיגה של נהג הרכב המבוטח",
      "צילום רישיון הרכב המבוטח",
      "צילום תעודת הביטוח של הרכב המבוטח",
      "תמונות הנזקים לרכב המבוטח",
      "תמונות מזירת התאונה",
      "אישור משטרה",
      "צילום רישיון הנהיגה של נהג צד שלישי",
      "צילום רישיון רכב צד שלישי",
      "צילום תעודת הביטוח של רכב צד שלישי",
      "תמונות הנזקים לרכב צד שלישי",
      "תמונות מזירת התאונה הקשורות לצד שלישי",
    ],
  );
  for (const f of uploads) {
    assert.ok(!f.required, `${f.name}: an upload never blocks the notice`);
    assert.equal(f.multiple, true, `${f.name}: several photos at once`);
  }
  assert.equal(new Set(uploads.map((f) => f.name)).size, uploads.length);
  assert.deepEqual(docs.fields.filter((f) => f.type === "statement" && f.label).map((f) => f.label).slice(0, 2), ["א. מסמכים ותמונות הקשורים לרכב המבוטח", "ב. מסמכים ותמונות הקשורים לצד שלישי"]);
  assert.match(docs.description ?? "", /אינם חובה/);
});

test("the police approval can be uploaded only when the customer said the police were involved", () => {
  assert.equal(visible("docPolice", {}), false);
  assert.equal(visible("docPolice", { police: "לא" }), false);
  assert.equal(visible("docPolice", { police: "כן" }), true);
  for (const f of uploads.filter((x) => x.name !== "docPolice")) assert.equal(f.showWhen, undefined, `${f.name} is always offered`);
});

test("the voice recording and anything else still go by WhatsApp: the site's own number, one button", () => {
  const buttons = docs.fields.filter((f) => f.action);
  assert.equal(buttons.length, 1);
  const url = new URL(buttons[0].action!.href);
  assert.ok(buttons[0].action!.href.startsWith(`${WA_HREF}?text=`), "the site's own WhatsApp, with an opening line");
  assert.ok(url.searchParams.get("text"), "the opening line is not empty");
  assert.match(buttons[0].action!.label, /הקלטה קולית/);
});

test("the thank-you line no longer tells the customer to send photos by WhatsApp", () => {
  assert.ok(!/התמונות|המסמכים/.test(form.successBody));
  assert.match(form.successBody, /הקלטה קולית/);
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
