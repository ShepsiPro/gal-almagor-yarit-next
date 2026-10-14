// Which forms a customer can open without the agency's link. The car and
// accident forms open only from the link the back-office sends (so every
// filled one has a sender on record); the apartment calculator's request stays
// public, because the calculator leads to it with no link.
import test from "node:test";
import assert from "node:assert/strict";
import { getForm, opensFromLinkOnly, publicForms } from "../lib/forms";

test("the car and accident forms open only from a sent link, the apartment request stays public", () => {
  for (const slug of ["car", "claim"]) {
    const form = getForm(slug)!;
    assert.equal(opensFromLinkOnly(form), true, `${slug} needs the agency's link`);
    assert.ok(publicForms().some((f) => f.slug === slug), `${slug} can still be sent from the back-office`);
  }
  assert.equal(opensFromLinkOnly(getForm("home-request")!), false, "the calculator leads to it with no link");
  assert.equal(opensFromLinkOnly(getForm("home-answer")!), true, "the signed answer always needed its link");
});
