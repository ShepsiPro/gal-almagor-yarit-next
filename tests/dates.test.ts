import test from "node:test";
import assert from "node:assert/strict";
import {
  displayToIso,
  dmy,
  dmyHm,
  isValidIsoDate,
  isoToDisplay,
  israelDayIso,
  policyEndIso,
  typedDate,
} from "../lib/dates";

test("an ISO date is shown day first", () => {
  assert.equal(isoToDisplay("2026-09-30"), "30/09/2026");
  assert.equal(isoToDisplay("1980-02-01"), "01/02/1980");
});

test("something that is not an ISO date is shown as it was, never blanked", () => {
  assert.equal(isoToDisplay("30/09"), "30/09");
  assert.equal(isoToDisplay(""), "");
  assert.equal(isoToDisplay(undefined), "");
  assert.equal(isoToDisplay("2026-02-30"), "2026-02-30");
});

test("only real calendar days are valid", () => {
  assert.equal(isValidIsoDate("2026-02-28"), true);
  assert.equal(isValidIsoDate("2028-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("2026-00-10"), false);
  assert.equal(isValidIsoDate("2026-04-31"), false);
  assert.equal(isValidIsoDate("1899-12-31"), false);
  assert.equal(isValidIsoDate("2101-01-01"), false);
  assert.equal(isValidIsoDate("30/09/2026"), false);
});

test("what a person types becomes ISO", () => {
  assert.equal(displayToIso("30/09/2026"), "2026-09-30");
  assert.equal(displayToIso("3/9/2026"), "2026-09-03");
  assert.equal(displayToIso("30.9.2026"), "2026-09-30");
  assert.equal(displayToIso("30-09-2026"), "2026-09-30");
  assert.equal(displayToIso("30092026"), "2026-09-30");
  assert.equal(displayToIso(" 30/09/2026 "), "2026-09-30");
  assert.equal(displayToIso("2026-09-30"), "2026-09-30");
});

test("a wrong day, an unfinished one or a two digit year is refused", () => {
  assert.equal(displayToIso("31/02/2026"), null);
  assert.equal(displayToIso("30/13/2026"), null);
  assert.equal(displayToIso("30/09/26"), null);
  assert.equal(displayToIso("30/09"), null);
  assert.equal(displayToIso("30/09/202"), null);
  assert.equal(displayToIso(""), null);
  assert.equal(displayToIso("hello"), null);
  // The month-first reading is not silently accepted as day-first: 09/30 is not a day-first date.
  assert.equal(displayToIso("09/30/2026"), null);
});

test("typing closes the day and the month with a slash by itself", () => {
  assert.equal(typedDate("3", ""), "3");
  assert.equal(typedDate("30", "3"), "30/");
  assert.equal(typedDate("30/0", "30/"), "30/0");
  assert.equal(typedDate("30/09", "30/0"), "30/09/");
  assert.equal(typedDate("30/09/2", "30/09/"), "30/09/2");
  assert.equal(typedDate("30/09/2026", "30/09/202"), "30/09/2026");
});

test("someone who types the slashes and skips the zeros is left alone", () => {
  assert.equal(typedDate("3/", "3"), "3/");
  assert.equal(typedDate("3/9", "3/"), "3/9");
  assert.equal(typedDate("3/9/", "3/9"), "3/9/");
  assert.equal(typedDate("3/9/2026", "3/9/202"), "3/9/2026");
});

test("deleting is never fought", () => {
  assert.equal(typedDate("30/", "30/0"), "30/");
  assert.equal(typedDate("30", "30/"), "30");
  assert.equal(typedDate("30/09", "30/09/"), "30/09");
});

test("other separators and junk are cleaned, a doubled slash is collapsed, length is capped", () => {
  assert.equal(typedDate("30.09", "30.0"), "30/09/");
  assert.equal(typedDate("30-09-2026", "30-09-202"), "30/09/2026");
  assert.equal(typedDate("30//", "30/"), "30/");
  assert.equal(typedDate("ab30", ""), "30/");
  assert.equal(typedDate("30/09/20261", "30/09/2026"), "30/09/2026");
});

test("a pasted ISO date turns into the day-first form", () => {
  assert.equal(typedDate("2026-09-30", ""), "30/09/2026");
});

test("a 12-month policy ends the day before its anniversary", () => {
  assert.equal(policyEndIso("2026-09-30"), "2027-09-29");
  assert.equal(policyEndIso("2026-01-01"), "2026-12-31");
  assert.equal(policyEndIso("2026-03-01"), "2027-02-28");
  assert.equal(policyEndIso("2028-02-29"), "2029-02-28");
  assert.equal(policyEndIso("nonsense"), "");
});

test("instants are read in Israel, day first", () => {
  // 22:30 UTC on the 29th is 01:30 on the 30th in Israel (UTC+3 in September).
  const late = new Date("2026-09-29T22:30:00Z");
  assert.equal(israelDayIso(late), "2026-09-30");
  assert.equal(dmy(late), "30/09/2026");
  assert.equal(dmyHm(late), "30/09/2026 01:30");
  // Winter time is UTC+2.
  assert.equal(dmyHm("2026-12-31T22:30:00Z"), "01/01/2027 00:30");
  assert.equal(dmy(null), "");
  assert.equal(dmy("not a date"), "");
});
