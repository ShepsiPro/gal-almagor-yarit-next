// The insurers' discounts (lib/mortgage-discounts.ts) against the files the
// owner sent on 2026-11-06, and the rules for using them: only inside the
// promotion's dates, only when the track's conditions hold, one per policy,
// the one that gives the lowest price.

import test from "node:test";
import assert from "node:assert/strict";
import { allFields, getForm } from "../lib/forms";
import { PROMOTIONS, bestDiscount, discountedMonthly, eligibleDiscounts, scheduleText, type DiscountQuery } from "../lib/mortgage-discounts";
import {
  COMPANIES,
  MORTGAGE_FIELDS,
  MORTGAGE_FORM_SLUG,
  computeMortgageQuote,
  customerQuote,
  quoteAnswerFields,
  quoteEmailRows,
  quoteFromAnswers,
} from "../lib/mortgage-quote";

const TODAY = "2026-11-06";
const track = (id: string) => PROMOTIONS.flatMap((p) => p.tracks).find((t) => t.id === id)!;
/** The track a policy gets; by default a man of 37 with 850,000 ₪, 51 ₪ a month and 25 years left. */
const pick = (q: Partial<DiscountQuery> & Pick<DiscountQuery, "company">) =>
  bestDiscount({ on: TODAY, insuranceAge: 37, sumInsured: 850_000, monthly: 51, loanYears: 25, ...q })?.track.id ?? null;
const man37 = { birthDate: "1990-03-15", sex: "male" as const, smoker: false, balance: 850_000, loanYears: 25 };

test("the files, as printed: each company's tracks, numbers and dates", () => {
  assert.deepEqual(
    PROMOTIONS.map((p) => `${p.company} ${p.from} ${p.to} ${p.tracks.length}`),
    [
      "harel 2026-10-11 2026-11-30 9",
      "harel 2026-10-11 2026-11-30 10",
      "migdal 2026-11-01 2026-11-30 12",
      "migdal 2026-11-01 2026-11-30 24",
      "menora 2026-10-15 2026-12-31 9",
    ],
  );
  // Harel, mortgage: by minimum premium, every track 15 years of cover.
  assert.deepEqual(PROMOTIONS[0].tracks.map((t) => t.minPremium ?? 0), [0, 60, 60, 100, 100, 140, 140, 200, 200]);
  assert.ok(PROMOTIONS[0].tracks.every((t) => t.minYears === 15));
  assert.deepEqual(track("harel-mortgage-140b").years, [70, 60, 50, 35, 35, 35]);
  assert.deepEqual(track("harel-mortgage-200a").years, [65, 65, 65, 50, 35, 35]);
  // Harel, מגן 1: no minimum period, and year 2 can give more than year 1.
  assert.deepEqual(PROMOTIONS[1].tracks.map((t) => t.minPremium), [60, 60, 125, 125, 175, 175, 175, 250, 250, 250]);
  assert.deepEqual(track("harel-magen-175c").years, [70, 80, 70, 40, 40, 40]);
  assert.deepEqual(track("harel-magen-250c").years, [65, 65, 65, 65, 65, 50, 35]);
  // Migdal, mortgage.
  const m = track("21179");
  assert.deepEqual([m.years, m.freeMonths, m.minYears, m.maxAge], [[65, 50, 40, 30, 30, 30], 2, 25, 69]);
  assert.equal(track("18537").freeMonths, 3);
  assert.equal(track("21174").later, "60% לאחר 20 שנות ביטוח");
  // Migdal, ריסק אור 1.
  const gold = track("21722");
  assert.deepEqual([gold.minSum, gold.maxSum, gold.minPremium, gold.freeMonths, gold.years], [1_000_000, 3_000_000, 180, 1, [70, 65, 65, 55, 45, 45]]);
  assert.deepEqual(track("21532").years, [60, 60, 50, 50, 40, 40]);
  // Menora.
  const top = track("101678");
  assert.deepEqual([top.minAge, top.maxAge, top.minPremium, top.maxSum, top.years], [30, 60, 170, 4_000_000, [85, 70, 70, 35, 35, 30, 30, 30]]);
  assert.deepEqual(track("101668").years, [70, 60, 50, 40, 20, 20, 40, 50, 50]);
});

test("what is left out stays out, and every number is a percentage as printed", () => {
  const all = PROMOTIONS.flatMap((p) => p.tracks);
  const ids = new Set(all.map((t) => t.id));
  assert.equal(ids.size, all.length, "every track has its own id");
  assert.ok(!ids.has("101677"), "Menora's critical illness bundle needs a second policy");
  assert.ok(!all.some((t) => t.years.includes(100)), "Harel's reduced-commission tracks (100% from year 13) are not used");
  assert.ok([...ids].every((id) => !/^218[23]\d$/.test(id)), "Migdal's ACTIVE pairs need a private risk policy alongside");
  for (const t of all) assert.ok(t.years.length > 0 && t.years.every((p) => p > 0 && p < 100), t.id);
  for (const p of PROMOTIONS) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.from) && /^\d{4}-\d{2}-\d{2}$/.test(p.to) && p.from <= p.to, p.title);
});

test("a discount applies only inside its promotion's dates", () => {
  const migdal = (on: string) => pick({ company: "migdal", on });
  assert.equal(migdal("2026-10-31"), null);
  assert.equal(migdal("2026-11-01"), "21179");
  assert.equal(migdal("2026-11-30"), "21179");
  assert.equal(migdal("2026-12-01"), null);
  const harel = (on: string) => pick({ company: "harel", on, monthly: 67.29 });
  assert.equal(harel("2026-10-10"), null);
  assert.equal(harel("2026-10-11"), "harel-magen-60a");
  assert.equal(harel("2026-12-01"), null);
  const menora = (on: string) => pick({ company: "menora", on, insuranceAge: 45, sumInsured: 1_500_000, monthly: 335.7 });
  assert.equal(menora("2026-10-14"), null);
  assert.equal(menora("2026-10-15"), "101678");
  assert.equal(menora("2026-12-31"), "101678");
  assert.equal(menora("2027-01-01"), null);
});

test("a track is used only when every condition of it holds", () => {
  // The minimum premium is the monthly premium before the discount.
  assert.equal(pick({ company: "harel", monthly: 59.99 }), "harel-mortgage-0", "under 60 ₪: only the track without a minimum premium");
  assert.equal(pick({ company: "harel", monthly: 59.99, loanYears: 14 }), null, "and that one needs 15 years");
  assert.equal(pick({ company: "harel", monthly: 60 }), "harel-magen-60a");
  // The years left on the mortgage.
  assert.equal(pick({ company: "migdal", loanYears: 25 }), "21179");
  assert.equal(pick({ company: "migdal", loanYears: 24 }), "21176");
  assert.equal(pick({ company: "migdal", loanYears: 14 }), "19155");
  assert.equal(pick({ company: "migdal", loanYears: null }), "19155", "years unknown: nothing that needs a minimum period");
  // Ages: Menora's top packages are for 30 to 60; Migdal's mortgage tracks end at 69.
  const menora = (insuranceAge: number) => pick({ company: "menora", insuranceAge, sumInsured: 1_500_000, monthly: 335.7 });
  assert.deepEqual([menora(29), menora(30), menora(60), menora(61)], ["101668", "101678", "101678", "101668"]);
  assert.equal(pick({ company: "migdal", insuranceAge: 70 }), "21535", "past 69: ריסק אור 1 for 50 to 70 instead");
  // Sums: Migdal's gold agreements are for one to three million, from 180 ₪ a month.
  const at = (sumInsured: number, monthly = 200) => pick({ company: "migdal", insuranceAge: 45, sumInsured, monthly, loanYears: 10 });
  assert.equal(at(999_999), "19155");
  assert.equal(at(1_000_000), "21722");
  assert.equal(at(3_000_000), "21722");
  assert.equal(at(3_000_001), "19155");
  assert.equal(at(1_500_000, 179.99), "21537", "under 180 ₪: the graded agreement for one to three million");
});

test("one discount per policy: the one that gives the lowest price", () => {
  // Equal in year 1: more free months first, then more discount in the years after.
  assert.equal(pick({ company: "migdal" }), "21179", "65% three ways: the one with two free months");
  assert.equal(pick({ company: "menora", insuranceAge: 45, sumInsured: 1_500_000, monthly: 335.7 }), "101678", "85% twice: the one that gives more after");
  assert.equal(pick({ company: "harel", monthly: 300 }), "harel-magen-250a", "70% in seven tracks: the most over the next years");
  assert.ok(eligibleDiscounts({ company: "harel", on: TODAY, insuranceAge: 37, sumInsured: 850_000, monthly: 300, loanYears: 25 }).length > 7);
  // Many apply, the price takes exactly one.
  const harel = computeMortgageQuote({ ...man37, balance: 3_500_000 }, TODAY).quotes.find((c) => c.company === "harel")!;
  assert.equal(harel.monthly, discountedMonthly(harel.listMonthly!, harel.discount!.percent));
});

test("the price after the discount, in whole agorot", () => {
  assert.equal(discountedMonthly(51, 65), 17.85);
  assert.equal(discountedMonthly(67.29, 60), 26.92, "26.916");
  assert.equal(discountedMonthly(335.7, 85), 50.36, "50.355: half an agora rounds up");
});

test("a request on 6 November: each company after its discount, the customer shown the lowest, the agency told which", () => {
  const q = computeMortgageQuote(man37, TODAY);
  const [migdal, menora, harel] = q.quotes;
  assert.deepEqual([migdal.listMonthly, migdal.monthly, migdal.discount?.id, migdal.discount?.freeMonths], [51, 17.85, "21179", 2]);
  assert.deepEqual([menora.listMonthly, menora.monthly, menora.discount], [65.71, 65.71, null], "under all of Menora's minimum premiums");
  assert.deepEqual([harel.listMonthly, harel.monthly, harel.discount?.id], [67.29, 26.92, "harel-magen-60a"]);
  assert.equal(q.best, "migdal");
  assert.equal(q.saving, 9.07, "against Harel after its own discount");

  // The customer: the price and until when its discount runs; nothing of a company or its discount.
  const shown = customerQuote(q);
  assert.deepEqual(shown, { monthly: 17.85, discountUntil: "2026-11-30", insuranceAge: 37, sex: "male", smoker: false, sumInsured: 850_000 });
  const sent = JSON.stringify(shown);
  for (const c of COMPANIES) assert.ok(!sent.includes(c.key) && !sent.includes(c.name), c.key);
  assert.ok(!sent.includes("21179") && !sent.includes("listMonthly") && !sent.includes("הנחה"));

  // The agency: which company, which discount, and the row to mark on the proposal.
  const stored = quoteAnswerFields(q);
  assert.deepEqual(quoteFromAnswers(stored), q, "read back as it was on the day");
  assert.equal(stored.quote_best, "מגדל ביטוח: 17.85 ₪ לחודש, הנחה 65% בשנה הראשונה, חודשיים ראשונים חינם");
  assert.equal(stored.quote_migdal, "17.85 ₪ לחודש (לפני הנחה 51.00 ₪; הנחה 65% בשנה הראשונה, חודשיים ראשונים חינם)");
  assert.equal(stored.quote_menora, "65.71 ₪ לחודש (ללא הנחה)");
  assert.equal(stored.quote_years_left, "25");
  assert.match(stored.quote_discount, /^מגדל ביטוח: הנחה 65% בשנה הראשונה, חודשיים ראשונים חינם\. הסכם 21179/);
  assert.ok(stored.quote_discount.includes("שנה 1: 65% · שנה 2: 50% · שנה 3: 40% · שנים 4-6: 30%"));
  assert.ok(stored.quote_discount.includes("למצטרפים עד 30/11/2026"));
  const rows = quoteEmailRows(q);
  assert.equal(rows[0].value, "מגדל ביטוח, 17.85 ₪ לחודש, הנחה 65% בשנה הראשונה, חודשיים ראשונים חינם");
  const harelRow = rows.find((r) => r.label.startsWith("הראל"))!.value;
  assert.ok(harelRow.includes("לפני הנחה 67.29 ₪") && harelRow.includes("מגן 1, פרמיית מינימום 60 ₪"));
  assert.ok(harelRow.includes("ההטבה אינה אוטומטית"), "Harel's benefits page goes with the proposal");
  assert.ok(rows.find((r) => r.label.startsWith("מנורה"))!.value.startsWith("65.71 ₪ לחודש\nללא הנחה פעילה"));
  assert.equal(rows.find((r) => r.label.startsWith("מגדל"))!.value.split("\n")[0], "17.85 ₪ לחודש (לפני הנחה 51.00 ₪)", "a line each in the email");
  assert.ok(rows.some((r) => r.value.includes("25 שנים שנותרו למשכנתא")));
});

test("once the promotions end, the price is the card's own again", () => {
  const q = computeMortgageQuote(man37, "2027-01-01");
  assert.ok(q.quotes.every((c) => c.discount === null && c.monthly === c.listMonthly));
  assert.equal(customerQuote(q).discountUntil, null);
  // Menora's runs a month longer than Harel's and Migdal's.
  const dec = computeMortgageQuote({ birthDate: "1981-06-01", sex: "male", smoker: true, balance: 1_500_000, loanYears: 25 }, "2026-12-15");
  assert.deepEqual(dec.quotes.map((c) => c.discount?.id ?? null), [null, "101678", null]);
});

test("schedules read the way the files print them", () => {
  assert.equal(scheduleText([65, 50, 40, 30, 30, 30]), "שנה 1: 65% · שנה 2: 50% · שנה 3: 40% · שנים 4-6: 30%");
  assert.equal(scheduleText([30, 30, 30, 30, 30, 30, 30, 30]), "שנים 1-8: 30%");
  assert.equal(scheduleText([70, 80, 70, 40, 40, 40]), "שנה 1: 70% · שנה 2: 80% · שנה 3: 70% · שנים 4-6: 40%");
});

test("the form asks the years left on the mortgage, as a required whole number", () => {
  const f = allFields(getForm(MORTGAGE_FORM_SLUG)!).find((x) => x.name === MORTGAGE_FIELDS.loanYears)!;
  assert.ok(f.required);
  assert.deepEqual([f.type, f.min, f.max], ["number", 1, 40]);
});
