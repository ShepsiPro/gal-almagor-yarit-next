// The Yarit owner's comments of 2026-09-30, pinned so they cannot quietly come back.
import test from "node:test";
import assert from "node:assert/strict";
import { allFields, answersForReading, displayAnswer, getForm, isFieldVisible } from "../lib/forms";
import { answerPrefill, caseStageOf, leadFieldsForAnswer, leadFieldsForOffer, offerPrefill, stageLabel, type CaseFile } from "../lib/home-case";
import { israelDayIso, policyEndIso } from "../lib/dates";

const request = getForm("home-request")!;
const offerForm = getForm("home-offer")!;
const answerForm = getForm("home-answer")!;

// ── 1. A private house has no floors ────────────────────────────────────────

test("floor and building floors are asked for a flat, never for a house", () => {
  const floor = allFields(request).find((f) => f.name === "floor")!;
  const floors = allFields(request).find((f) => f.name === "building_floors")!;
  const shown = (type: string, f = floor) => isFieldVisible(request, f, { property_type: type });

  for (const f of [floor, floors]) {
    assert.equal(shown("דירה בבית משותף", f), true, `${f.name}: a flat has a floor`);
    assert.equal(shown("אחר", f), true, `${f.name}: unknown type, keep asking`);
    assert.equal(shown("בית פרטי", f), false, `${f.name}: a private house has no floors`);
    assert.equal(shown("דו-משפחתי / קוטג'", f), false, `${f.name}: a cottage has no floors`);
  }
  // Nothing chosen yet: the type comes first in the section, so the floors wait for it.
  assert.equal(isFieldVisible(request, floor, {}), false);
});

test("a floor typed for a flat and then abandoned for a house is not part of the request", () => {
  const values = { property_type: "בית פרטי", floor: "3", building_floors: "8" };
  const visible = allFields(request).filter((f) => isFieldVisible(request, f, values)).map((f) => f.name);
  assert.equal(visible.includes("floor"), false);
  assert.equal(visible.includes("building_floors"), false);
  assert.equal(visible.includes("area_m2"), true);
});

// ── 3. The representative, not "the agent" ──────────────────────────────────

test("the end of form 2 asks for the agency's representative", () => {
  const field = allFields(offerForm).find((f) => f.name === "agent_name")!;
  assert.equal(field.label, "שם הנציג/ה בסוכנות");
  assert.equal(field.required, true);
  for (const f of allFields(offerForm)) assert.ok(!/סוכן\/ת/.test(f.label), `${f.name} still says "agent"`);
});

// ── 4. The ID in the final approval ─────────────────────────────────────────

function fileWithOffer(offer: Record<string, string>): CaseFile {
  return { latestOffer: { answers: offer } } as unknown as CaseFile;
}

test("form 3 arrives with the ID already written in the final approval, and locked", () => {
  const pre = answerPrefill(fileWithOffer({ insured_name: "דנה כהן", insured_id: "123456782", insured_address: "הגפן 12", insurer: "הכשרה", premium: "1651", period_start: "2026-09-30" }))!;
  assert.equal(pre.values.sign_id, "123456782");
  assert.equal(pre.values.sign_name, "דנה כהן");
  assert.ok(pre.locked.includes("sign_id"), "the ID is the one the offer is written for, not something to retype");
  assert.ok(pre.locked.includes("insured_id"));
  // Every prefilled field is a field form 3 really has.
  const names = new Set(allFields(answerForm).map((f) => f.name));
  for (const k of Object.keys(pre.values)) assert.ok(names.has(k), `${k} is not a field of form 3`);
});

test("no ID on the offer means no lock on a blank, uneditable box", () => {
  const pre = answerPrefill(fileWithOffer({ insured_name: "דנה" }))!;
  assert.equal("sign_id" in pre.values, false);
  assert.equal(pre.locked.includes("sign_id"), false);
});

// ── 2. Dates day first ──────────────────────────────────────────────────────

test("a date answer is read day first and other answers are untouched", () => {
  const date = allFields(request).find((f) => f.type === "date")!;
  const text = allFields(request).find((f) => f.name === "street")!;
  assert.equal(displayAnswer(date, "1980-02-01"), "01/02/1980");
  assert.equal(displayAnswer(text, "2026-09-30"), "2026-09-30");
});

test("the copy that goes to Mslahtk and to the mailbox has every date day first", () => {
  const out = answersForReading(request, { birth_date: "1980-02-01", id_issue_date: "2015-05-20", sign_date: "2026-09-30", street: "הגפן" });
  assert.equal(out.birth_date, "01/02/1980");
  assert.equal(out.id_issue_date, "20/05/2015");
  assert.equal(out.sign_date, "30/09/2026");
  assert.equal(out.street, "הגפן");
});

test("every date field on every form is a real date field, so the day-first box covers them all", () => {
  const dates = ["car", "claim", "home-request", "home-offer", "home-answer"].flatMap((slug) => allFields(getForm(slug)!).filter((f) => f.type === "date"));
  assert.ok(dates.length >= 15);
  for (const f of dates) assert.ok(f.name && f.label, "a date field with no name or label");
});

test("what the offer writes on the Mslahtk card is day first", () => {
  const offer = leadFieldsForOffer({ insurer: "הכשרה", period_start: "2026-09-30", period_end: "2027-09-29", premium: "1651" });
  assert.equal(offer.home_offer_period, "30/09/2026 עד 29/09/2027");
  assert.match(offer.home_offer_savedAt, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  const answer = leadFieldsForAnswer({ decision: "אני מאשר/ת את ביצוע הביטוח", requested_start: "2026-10-05" });
  assert.equal(answer.home_answer_requestedStart, "05/10/2026");
  assert.match(answer.home_answer_at, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});

test("a new offer starts today by Israel's clock and lasts twelve months", () => {
  const file = { request: { answers: { full_name: "דנה", id_number: "123456782" } }, simulator: null, latestOffer: null } as unknown as CaseFile;
  const pre = offerPrefill(file);
  assert.equal(pre.period_start, israelDayIso());
  assert.equal(pre.offer_date, israelDayIso());
  assert.equal(pre.period_end, policyEndIso(israelDayIso()));
});

// ── 6. The stage of a customer who has only been sent form 1 ────────────────

test("a form sent and not yet filled is its own stage, ahead of everything else", () => {
  const def = { key: "home", title: "", request: "home-request", offer: "home-offer", answer: "home-answer" };
  assert.deepEqual(caseStageOf(def, [], true), { stage: "invited", decision: null });
  assert.equal(stageLabel("invited", null), "נשלח טופס 1");
  assert.deepEqual(caseStageOf(def, [], false), { stage: "request", decision: null });
});
