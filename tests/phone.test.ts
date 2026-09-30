import test from "node:test";
import assert from "node:assert/strict";
import { phoneKey, toE164, waDigits } from "../lib/phone";

test("an Israeli number typed the local way gets its country code", () => {
  assert.equal(toE164("050-1234567"), "+972501234567");
  assert.equal(toE164("0501234567"), "+972501234567");
  assert.equal(toE164("050 123 4567"), "+972501234567");
  assert.equal(toE164("(050) 123-4567"), "+972501234567");
  assert.equal(toE164("04-9876543"), "+97249876543");
});

test("every spelling of one number lands on one identity", () => {
  const want = "+972501234567";
  for (const raw of ["+972501234567", "972501234567", "+972 050 123 4567", "972-050-1234567", "00972501234567", "501234567", "+0501234567"]) {
    assert.equal(toE164(raw), want, raw);
  }
});

test("a foreign number keeps its own country code", () => {
  assert.equal(toE164("+1 415 555 0100"), "+14155550100");
  assert.equal(toE164("0044 20 7946 0958"), "+442079460958");
});

test("junk is not a phone number", () => {
  assert.equal(toE164(""), "");
  assert.equal(toE164("abc"), "");
  assert.equal(toE164("12345"), "");
  assert.equal(toE164("0"), "");
  assert.equal(toE164(null), "");
  assert.equal(toE164(undefined), "");
});

test("wa.me wants digits only and phoneKey ignores formatting", () => {
  assert.equal(waDigits("050-1234567"), "972501234567");
  assert.equal(waDigits("nonsense"), "");
  assert.equal(phoneKey("050-1234567"), phoneKey("+972 50 123 4567"));
  assert.notEqual(phoneKey("050-1234567"), phoneKey("050-1234568"));
});
