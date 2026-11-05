// The mortgage life insurance price check against the rate cards it came from.
//
// tests/fixtures/mortgage-rate-cards.json is a MACHINE read of what the owner
// sent (Apple Vision and Tesseract over the Migdal and Menora photos, the text
// layer of Harel's PDF), not a copy of lib/mortgage-quote.ts: every cell in the
// module has to agree with it, so a slipped digit, a swapped column or a
// missing age fails here and names the cell.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { completedYears } from "../lib/dates";
import { dateRuleProblem, getForm, allFields, publicForms, opensFromLinkOnly } from "../lib/forms";
import {
  COMPANIES,
  HAREL_MAGEN_1,
  MENORA_RISK_1_ABOVE_HALF_MILLION,
  MENORA_RISK_1_UP_TO_HALF_MILLION,
  MIGDAL_RISK_OR_1,
  MORTGAGE_FIELDS,
  MORTGAGE_FORM_SLUG,
  SEX_OPTIONS,
  SMOKING_OPTIONS,
  computeMortgageQuote,
  customerQuote,
  insuranceAge,
  monthlyPremium,
  quoteAnswerFields,
  quoteEmailRows,
  quoteFromAnswers,
  quoteInputFromAnswers,
  rateFor,
  type RateTable,
} from "../lib/mortgage-quote";
import { SITE } from "../lib/site";

type CardCopy = { columns: string[]; rows: Record<string, string[]> };
const cards = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/mortgage-rate-cards.json"), "utf8")) as Record<string, CardCopy>;

const TABLES: Array<[string, RateTable]> = [
  ["migdal_risk_or_1", MIGDAL_RISK_OR_1],
  ["menora_risk_1_up_to_half_million", MENORA_RISK_1_UP_TO_HALF_MILLION],
  ["menora_risk_1_above_half_million", MENORA_RISK_1_ABOVE_HALF_MILLION],
  ["harel_magen_1", HAREL_MAGEN_1],
];

for (const [key, table] of TABLES) {
  test(`${key}: every cell matches the card`, () => {
    const card = cards[key];
    assert.deepEqual([...table.columns], card.columns, "column order");
    const ages = Object.keys(table.rows).map(Number).sort((a, b) => a - b);
    assert.deepEqual(ages, Object.keys(card.rows).map(Number).sort((a, b) => a - b), "the same ages");
    assert.equal(ages[0], 18);
    assert.equal(ages[ages.length - 1], key === "harel_magen_1" ? 75 : 79);
    for (const age of ages) {
      table.rows[age].forEach((value, i) => {
        assert.equal(value.toFixed(2), card.rows[String(age)][i], `${key} age ${age}, ${table.columns[i]}`);
      });
    }
  });
}

test("cells read off the photos by eye land in the right column", () => {
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 18, "male", false), 6.0);
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 18, "female", false), 3.1);
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 60, "male", true), 108.24);
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 79, "female", true), 485.92);
  assert.equal(rateFor(MENORA_RISK_1_UP_TO_HALF_MILLION, 18, "male", true), 11.34);
  assert.equal(rateFor(MENORA_RISK_1_UP_TO_HALF_MILLION, 79, "female", true), 491.03);
  assert.equal(rateFor(MENORA_RISK_1_ABOVE_HALF_MILLION, 18, "female", false), 4.39);
  assert.equal(rateFor(MENORA_RISK_1_ABOVE_HALF_MILLION, 64, "male", true), 194.95);
  assert.equal(rateFor(HAREL_MAGEN_1, 18, "male", false), 0.8);
  assert.equal(rateFor(HAREL_MAGEN_1, 75, "female", true), 60.62);
  assert.equal(rateFor(HAREL_MAGEN_1, 76, "male", false), null, "Harel's card ends at 75");
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 17, "male", false), null, "no row under 18");
  assert.equal(rateFor(MIGDAL_RISK_OR_1, 80, "male", false), null, "no row over 79");
});

test("the premium is worked in whole agorot, half an agora rounding up", () => {
  assert.equal(monthlyPremium(8.24, 850_000), 70.04);
  // 7.73 x 8.5 = 65.705: a float would land either side of the half.
  assert.equal(monthlyPremium(7.73, 850_000), 65.71);
  assert.equal(monthlyPremium(17.25, 450_000), 77.63);
  assert.equal(monthlyPremium(6.0, 100_000), 6.0);
  assert.equal(monthlyPremium(5.68, 500_001), 28.4);
  // Harel's card is a year per 1,000: 0.80 x 850 = 680 a year, 56.666... a month.
  assert.equal(monthlyPremium(0.8, 850_000, HAREL_MAGEN_1.unit), 56.67);
  assert.equal(monthlyPremium(1.02, 500_000, HAREL_MAGEN_1.unit), 42.5);
});

test("insurance age: from six months after a birthday the next age's row is used", () => {
  assert.equal(insuranceAge("1988-05-10", "2026-11-09"), 38);
  assert.equal(insuranceAge("1988-05-10", "2026-11-10"), 39);
  assert.equal(completedYears("1988-05-10", "2026-11-10"), 38);
  assert.equal(insuranceAge("1988-05-10", "2026-05-10"), 38);
  // A 29 February birthday turns over on 1 March in other years.
  assert.equal(completedYears("2000-02-29", "2026-02-28"), 25);
  assert.equal(completedYears("2000-02-29", "2026-03-01"), 26);
});

test("a man, insurance age 37, non-smoker, 850,000: Migdal is the cheapest", () => {
  const q = computeMortgageQuote({ birthDate: "1990-03-15", sex: "male", smoker: false, balance: 850_000 }, "2026-11-05");
  assert.equal(q.age, 36);
  assert.equal(q.insuranceAge, 37);
  const [migdal, menora, harel] = q.quotes;
  assert.equal(migdal.company, "migdal");
  assert.equal(migdal.rate, 6.0);
  assert.equal(migdal.monthly, 51.0);
  assert.equal(menora.company, "menora");
  assert.equal(menora.table, "סכום ביטוח מעל חצי מיליון ₪", "850,000 is priced from Menora's second table");
  assert.equal(menora.rate, 7.73);
  assert.equal(menora.monthly, 65.71);
  assert.equal(harel.company, "harel");
  assert.equal(harel.rate, 0.95);
  assert.equal(harel.rateUnit, "לשנה לכל 1,000 ₪");
  assert.equal(harel.monthly, 67.29);
  assert.equal(q.best, "migdal");
  assert.equal(q.tie, false);
  assert.equal(q.saving, 14.71, "against the next cheapest, Menora");
});

test("a young man with 600,000: Menora's second table makes it the cheapest", () => {
  const q = computeMortgageQuote({ birthDate: "2000-08-01", sex: "male", smoker: false, balance: 600_000 }, "2026-11-05");
  assert.equal(q.insuranceAge, 26);
  assert.deepEqual(q.quotes.map((c) => c.monthly), [36.0, 34.08, 35.5]);
  assert.equal(q.best, "menora");
  assert.equal(q.saving, 1.42, "against the next cheapest, Harel");
});

test("a young smoker with 500,000: Harel is the cheapest", () => {
  const q = computeMortgageQuote({ birthDate: "2008-08-01", sex: "male", smoker: true, balance: 500_000 }, "2026-11-05");
  assert.equal(q.insuranceAge, 18);
  assert.deepEqual(q.quotes.map((c) => c.monthly), [44.15, 56.7, 42.5]);
  assert.equal(q.best, "harel");
  assert.equal(q.saving, 1.65);
});

test("Harel prices only from 500,000 of cover, and only to age 75", () => {
  const harelAt = (birthDate: string, balance: number) =>
    computeMortgageQuote({ birthDate, sex: "male", smoker: false, balance }, "2026-11-05").quotes.find((c) => c.company === "harel")!;
  assert.equal(harelAt("2000-08-01", 499_999).monthly, null);
  assert.equal(harelAt("2000-08-01", 499_999).unavailable, "לא מחושב לסכום ביטוח מתחת ל-500,000 ₪");
  assert.equal(harelAt("2000-08-01", 500_000).monthly, 29.58);
  assert.equal(harelAt("1950-08-01", 800_000).monthly, null, "insurance age 76");
  assert.equal(harelAt("1950-08-01", 800_000).unavailable, "לא מחושב מעל גיל 75");
});

test("Menora's tier is the whole sum's: 500,000 from the first table, 500,001 all from the second", () => {
  const at = (balance: number) => computeMortgageQuote({ birthDate: "2000-08-01", sex: "male", smoker: false, balance }, "2026-11-05").quotes[1];
  assert.equal(at(500_000).rate, 5.97);
  assert.equal(at(500_000).monthly, 29.85);
  assert.equal(at(500_001).rate, 5.68);
  assert.equal(at(500_001).monthly, 28.4);
});

test("the same price at two companies: a tie, the first of them named, no saving", () => {
  const q = computeMortgageQuote({ birthDate: "1996-08-01", sex: "female", smoker: true, balance: 600_000 }, "2026-11-05");
  assert.equal(q.insuranceAge, 30);
  assert.equal(q.quotes[0].monthly, 36.9);
  assert.equal(q.quotes[1].monthly, 36.9);
  assert.equal(q.quotes[2].monthly, 37.5);
  assert.equal(q.tie, true);
  assert.equal(q.best, "migdal");
  assert.equal(q.saving, 0);
});

test("past Migdal's mortgage entry age (69), under Harel's 500,000: only Menora prices it", () => {
  const q = computeMortgageQuote({ birthDate: "1956-01-01", sex: "female", smoker: false, balance: 300_000 }, "2026-11-05");
  assert.equal(q.insuranceAge, 71);
  assert.equal(q.quotes[0].monthly, null);
  assert.equal(q.quotes[0].unavailable, "לא מחושב מעל גיל 69");
  assert.equal(q.quotes[2].monthly, null, "300,000 is under Harel's card");
  assert.equal(q.quotes[1].rate, 133.02);
  assert.equal(q.quotes[1].monthly, 399.06);
  assert.equal(q.best, "menora");
  assert.equal(q.saving, null);
});

test("past every card: no price, and the result says so instead of guessing", () => {
  const q = computeMortgageQuote({ birthDate: "1940-01-01", sex: "male", smoker: false, balance: 300_000 }, "2026-11-05");
  assert.equal(q.best, null);
  assert.ok(q.quotes.every((c) => c.monthly === null && c.unavailable));
  assert.equal(quoteAnswerFields(q).quote_best, "לא חושב אוטומטית");
});

test("the form's answers become the input, and an incomplete set does not", () => {
  const answers = {
    [MORTGAGE_FIELDS.birthDate]: "1990-03-15",
    [MORTGAGE_FIELDS.sex]: SEX_OPTIONS.female,
    [MORTGAGE_FIELDS.smoking]: SMOKING_OPTIONS.smoker,
    [MORTGAGE_FIELDS.balance]: "850000",
  };
  assert.deepEqual(quoteInputFromAnswers(answers), { birthDate: "1990-03-15", sex: "female", smoker: true, balance: 850_000 });
  assert.equal(quoteInputFromAnswers({ ...answers, [MORTGAGE_FIELDS.sex]: "" }), null);
  assert.equal(quoteInputFromAnswers({ ...answers, [MORTGAGE_FIELDS.balance]: "lots" }), null);
  assert.equal(quoteInputFromAnswers({ ...answers, [MORTGAGE_FIELDS.birthDate]: "15/03/1990" }), null);
});

test("what a submission stores reads back as it was, with plain keys for the Mslahtk card", () => {
  const q = computeMortgageQuote({ birthDate: "1990-03-15", sex: "male", smoker: false, balance: 850_000 }, "2026-11-05");
  const stored = quoteAnswerFields(q);
  assert.deepEqual(quoteFromAnswers(stored), q);
  assert.equal(stored.quote_best, "מגדל ביטוח: 51.00 ₪ לחודש");
  assert.equal(stored.quote_migdal, "51.00 ₪ לחודש");
  assert.equal(stored.quote_menora, "65.71 ₪ לחודש");
  assert.equal(stored.quote_harel, "67.29 ₪ לחודש");
  assert.equal(stored.quote_sum_insured, "850,000 ₪");
  assert.equal(quoteFromAnswers({}), null);
  assert.equal(quoteFromAnswers({ _quote: "not json" }), null);
  const rows = quoteEmailRows(q);
  assert.equal(rows[0].value, "מגדל ביטוח, 51.00 ₪ לחודש");
  assert.ok(rows.some((r) => r.value.includes("7.73 ₪ לחודש לכל 100,000 ₪")), "the email shows the rate each price came from");
  assert.ok(rows.some((r) => r.value.includes("0.95 ₪ לשנה לכל 1,000 ₪")), "in that card's own unit");
});

test("the customer is sent the lowest price only, with no company named", () => {
  const q = computeMortgageQuote({ birthDate: "1990-03-15", sex: "male", smoker: false, balance: 850_000 }, "2026-11-05");
  const shown = customerQuote(q);
  assert.deepEqual(shown, { monthly: 51, insuranceAge: 37, sex: "male", smoker: false, sumInsured: 850_000 });
  const sent = JSON.stringify(shown);
  for (const c of COMPANIES) {
    assert.ok(!sent.includes(c.key) && !sent.includes(c.name) && !sent.includes(c.plan), `nothing of ${c.key} reaches the browser`);
  }
  assert.ok(!sent.includes("65.71") && !sent.includes("67.29"), "nor the other prices");
  const none = customerQuote(computeMortgageQuote({ birthDate: "1940-01-01", sex: "male", smoker: false, balance: 300_000 }, "2026-11-05"));
  assert.equal(none.monthly, null, "past every card: no price, so the card says the agency will check");
});

test("the form: public, priced, and wired to the fields the price reads", () => {
  const form = getForm(MORTGAGE_FORM_SLUG)!;
  assert.ok(form, "the form exists");
  assert.equal(form.quote, "mortgage-life");
  assert.equal(opensFromLinkOnly(form), false, "customers open it from the site with no link");
  assert.ok(publicForms().some((f) => f.slug === MORTGAGE_FORM_SLUG), "the back-office can send it");
  const byName = new Map(allFields(form).map((f) => [f.name, f]));
  for (const name of Object.values(MORTGAGE_FIELDS)) assert.ok(byName.get(name)?.required, `${name} is asked and required`);
  assert.deepEqual(byName.get(MORTGAGE_FIELDS.sex)!.options, [SEX_OPTIONS.male, SEX_OPTIONS.female]);
  assert.deepEqual(byName.get(MORTGAGE_FIELDS.smoking)!.options, [SMOKING_OPTIONS.smoker, SMOKING_OPTIONS.nonSmoker]);
  for (const f of allFields(form)) for (const o of f.options ?? []) assert.ok(!o.includes(", "), `option "${o}" may not hold the answer separator`);
  assert.ok(byName.get("har_statement")!.body!.includes(SITE.legalName), "the authorization names the agency by its legal name");
  assert.ok(byName.get("har_consent")!.required && byName.get("confirm")!.required, "both approvals are required");
});

test("date rules: the insured is 18 or over, an ID is not issued in the future", () => {
  const birth = getForm(MORTGAGE_FORM_SLUG)!.sections[0].fields.find((f) => f.name === MORTGAGE_FIELDS.birthDate)!;
  assert.match(dateRuleProblem(birth, "2008-11-06", "2026-11-05") ?? "", /18/, "17 the day before the birthday");
  assert.equal(dateRuleProblem(birth, "2008-11-05", "2026-11-05"), null, "18 on the birthday");
  assert.ok(dateRuleProblem(birth, "2027-01-01", "2026-11-05"));
  assert.ok(dateRuleProblem(birth, "1900-01-01", "2026-11-05"), "over 120");
  assert.ok(dateRuleProblem({ pastOnly: true }, "2026-11-06", "2026-11-05"));
  assert.equal(dateRuleProblem({ pastOnly: true }, "2026-11-05", "2026-11-05"), null);
  assert.equal(dateRuleProblem({}, "2030-01-01", "2026-11-05"), null, "other date fields keep no such rule");
});
