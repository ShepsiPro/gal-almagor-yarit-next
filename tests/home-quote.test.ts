// The calculator against the spreadsheet it was ported from.
//
// tests/fixtures/home-quote-oracle.json holds 45 input sets (the workbook's
// own example first, then randomised ones) and, for each, the values the
// ORIGINAL workbook's formulas produce for every priced line, computed by
// evaluating the .xlsm itself with a formula engine. If a rate or a rule here
// drifts from the generator, a case fails and names the cell.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeHomeQuote, DEFAULT_INPUT, decodeSnapshot, encodeSnapshot, normalizeInput, type HomeQuoteInput } from "../lib/home-quote";

type Cell = string | number;
type OracleRow = { inputs: Record<string, Cell>; outputs: Record<string, Cell> };

const rows: OracleRow[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/home-quote-oracle.json"), "utf8"),
);

const on = (v: Cell) => v === "בתוקף";

/** The workbook's input cells → the calculator's input. */
function toInput(c: Record<string, Cell>): HomeQuoteInput {
  return normalizeInput({
    apartmentType: c.D8,
    areaM2: c.D11,
    buildingSum: c.H12,
    earthquakeBuilding: on(c.F17),
    splitUnits: c.F18 === "ללא" ? 0 : Number(c.F18),
    wooden: on(c.F19),
    waterRoute: c.D21,
    contentsSum: c.H24,
    earthquakeContents: on(c.F25),
    jewelryWaived: Number(c.H26) === 0,
    jewelrySum: c.H27,
    thirdPartyLimit: c.H33,
    airbnb: on(c.H36),
    sublet: on(c.H37),
    parkingStackerSum: c.H38,
    evChargerSum: c.H39,
    poolSum: c.H40,
    poolThirdParty: on(c.H41),
    earthquakeExtraSum: c.H42,
    earthquakeFireExtraSum: c.H44,
    bikesAbove5000Sum: c.H46,
    businessActivity: c.E47,
    fursSum: c.H48,
    stampsSum: c.H49,
    silverSum: c.H50,
    cameraSum: c.H51,
    religiousExtensions: on(c.H52),
    instrumentsSum: c.H59,
    laptopSum: c.H60,
    abroadJewelry: { days: c.E61, sum: c.H61 },
    abroadCamera: { days: c.E62, sum: c.H62 },
    abroadLaptop: { days: c.E63, sum: c.H63 },
    pets: on(c.H64),
    gunSum: c.H65,
    terror: on(c.H66),
    toiletsSum: c.H67,
    unoccupiedDays: c.E68,
    photovoltaicSum: c.H69,
    solarHeaters: on(c.H70),
  });
}

const PRICED = [
  "J12", "J17", "J18", "J21", "J24", "J25", "J27", "J33", "J36", "J37", "J38", "J39", "J40", "J41", "J42", "J44",
  "J46", "J47", "J48", "J49", "J50", "J51", "J52", "J59", "J60", "J61", "J62", "J63", "J64", "J65", "J66", "J67",
  "J68", "J69", "J70", "J72", "J73", "J74", "J75", "J76", "J85", "J87",
];
const SHEET2 = ["E62", "H84", "H90", "H91", "H92", "E93", "E98"];

function close(a: number, b: number) {
  return Math.abs(a - b) < 0.011;
}

for (const [i, row] of rows.entries()) {
  test(`oracle case ${i}: every priced line matches the workbook`, () => {
    const r = computeHomeQuote(toInput(row.inputs));
    const bad: string[] = [];
    for (const c of PRICED) {
      const exp = Number(row.outputs[c]);
      const got = r.cells[c];
      if (!close(exp, got)) bad.push(`${c}: workbook ${exp} calculator ${got}`);
    }
    for (const c of SHEET2) {
      const exp = Number(row.outputs["g2_" + c]);
      const got = r.cells[c];
      if (!close(exp, got)) bad.push(`sheet2!${c}: workbook ${exp} calculator ${got}`);
    }
    const e81 = row.outputs.g2_E81;
    if (e81 === "ללא") assert.equal(r.deductibles.water, null, "water deductible should be absent");
    else if (!close(Number(e81), r.deductibles.water ?? -1)) bad.push(`E81 water deductible: workbook ${e81} calculator ${r.deductibles.water}`);
    assert.deepEqual(bad, [], `inputs ${JSON.stringify(row.inputs)}`);
  });
}

test("the workbook's own example totals 1,651.55", () => {
  const r = computeHomeQuote(toInput(rows[0].inputs));
  assert.ok(close(r.premiumBase, 484.3));
  assert.equal(r.minimumTopUp, 0);
  assert.ok(close(r.completion, 1160.25));
  assert.ok(close(r.total, 1651.55));
  assert.equal(r.deductibles.water, 800);
  assert.equal(r.blocked, null);
});

test("minimum premium tops up a tiny contents-only policy", () => {
  const r = computeHomeQuote({ ...DEFAULT_INPUT, buildingSum: 0, contentsSum: 30000, jewelrySum: 6000, waterRoute: "ללא", earthquakeBuilding: false, earthquakeContents: false });
  // 30,000 * 0.003 = 90 base; contents-only on a middle floor has a 300 minimum.
  assert.equal(r.minimumPremium, 300);
  assert.ok(close(r.premiumBase, 90));
  assert.ok(close(r.minimumTopUp, 210));
  assert.ok(close(r.total, 300 + 7));
});

test("ten million of building cover is refused, not priced", () => {
  const r = computeHomeQuote({ ...DEFAULT_INPUT, buildingSum: 10_000_000 });
  assert.ok(r.blocked);
  assert.equal(r.total, 0);
  assert.equal(r.lines.length, 0);
});

test("a wooden house gets no discounts", () => {
  const r = computeHomeQuote({ ...DEFAULT_INPUT, wooden: true });
  assert.equal(r.cells.J72, 0);
  assert.equal(r.cells.J73, 0);
  assert.equal(r.cells.J74, 0);
  assert.equal(r.cells.J76, 0);
});

test("snapshot survives a round trip and rejects junk", () => {
  const input: HomeQuoteInput = { ...DEFAULT_INPUT, apartmentType: "בית פרטי", buildingSum: 1234567, abroadLaptop: { days: 12, sum: 8000 } };
  const back = decodeSnapshot(encodeSnapshot(input));
  assert.deepEqual(back, input);
  assert.equal(decodeSnapshot("not-base64-json"), null);
  assert.equal(decodeSnapshot(""), null);
  const fromJunk = normalizeInput({ apartmentType: "castle", buildingSum: -5, thirdPartyLimit: 999 });
  assert.equal(fromJunk.apartmentType, DEFAULT_INPUT.apartmentType);
  assert.equal(fromJunk.buildingSum, 0);
  assert.equal(fromJunk.thirdPartyLimit, 1500000);
});
