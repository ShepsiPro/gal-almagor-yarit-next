// Which forms a customer can open without the agency's link. The car and
// accident forms open only from the link the back-office sends (so every
// filled one has a sender on record); the apartment calculator's request stays
// public, because the calculator leads to it with no link.
import test from "node:test";
import assert from "node:assert/strict";
import { FORMS, getForm, linkTokenRequired, officeFillable, opensFromLinkOnly, publicForms } from "../lib/forms";

test("the car and accident forms open only from a sent link, the apartment request stays public", () => {
  for (const slug of ["car", "claim"]) {
    const form = getForm(slug)!;
    assert.equal(opensFromLinkOnly(form), true, `${slug} needs the agency's link`);
    assert.ok(publicForms().some((f) => f.slug === slug), `${slug} can still be sent from the back-office`);
  }
  assert.equal(opensFromLinkOnly(getForm("home-request")!), false, "the calculator leads to it with no link");
  assert.equal(opensFromLinkOnly(getForm("home-answer")!), true, "the signed answer always needed its link");
});

test("in the office the agent fills the same forms it can send, and a link-only form needs no link from them", () => {
  // Owner, 2026-11-06: with the customer present, fill it in place instead of sending a link.
  assert.deepEqual(
    FORMS.filter(officeFillable).map((f) => f.slug),
    publicForms().map((f) => f.slug),
  );
  assert.deepEqual(publicForms().map((f) => f.slug).sort(), ["car", "claim", "home-request", "mortgage-life"]);
  assert.equal(officeFillable(getForm("home-offer")!), false, "the offer is written inside its case");
  assert.equal(officeFillable(getForm("home-answer")!), false, "the customer's own answer is theirs to sign");
  for (const slug of ["car", "claim"]) {
    const form = getForm(slug)!;
    assert.equal(linkTokenRequired(form, false), true, `${slug}: the public still needs the sent link`);
    assert.equal(linkTokenRequired(form, true), false, `${slug}: a signed-in agent filling it in the office does not`);
  }
  for (const slug of ["home-request", "mortgage-life"]) assert.equal(linkTokenRequired(getForm(slug)!, false), false, `${slug} never needed one`);
});
