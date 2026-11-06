// The insurance areas: the pages, the footer and the contact form agree, and the
// mortgage price check sits on the mortgage page (owner, 2026-11-06).
import test from "node:test";
import assert from "node:assert/strict";
import { INSURANCE_CONTENT, INSURANCE_SLUGS } from "../lib/insurance-data";
import { FOOTER_INSURANCE } from "../lib/site";
import { CONTACT_TOPICS } from "../lib/contact-form";
import { MORTGAGE_FORM_SLUG } from "../lib/mortgage-quote";

const priceCheck = `/forms/${MORTGAGE_FORM_SLUG}`;

test("mortgage insurance is an area of its own, right after life", () => {
  const at = INSURANCE_SLUGS.indexOf("life");
  assert.deepEqual(INSURANCE_SLUGS.slice(at, at + 2), ["life", "mortgage"]);
  assert.equal(INSURANCE_CONTENT.mortgage.eyebrow, "ביטוח משכנתאות");
});

test("the mortgage price check is on the mortgage page and no longer on the life page", () => {
  const mortgage = INSURANCE_CONTENT.mortgage;
  assert.equal(mortgage.calculator?.href, priceCheck, "the page leads with it");
  assert.ok(mortgage.sections.some((s) => s.action?.href === priceCheck), "and offers it under the life cover section");

  const life = INSURANCE_CONTENT.life;
  assert.equal(life.calculator, undefined);
  assert.ok(!life.sections.some((s) => s.action?.href === priceCheck), "moved off the life page");
  assert.ok(life.relatedTo.includes("mortgage"), "the life page still points to it");
});

test("the footer lists every area, in the order of the pages", () => {
  assert.deepEqual(FOOTER_INSURANCE.map((f) => f.slug), INSURANCE_SLUGS);
});

test("each page's contact topic is an option of the contact form, and its related areas exist", () => {
  for (const slug of INSURANCE_SLUGS) {
    const c = INSURANCE_CONTENT[slug];
    assert.ok(CONTACT_TOPICS.includes(c.topic), `${slug}: "${c.topic}" is in the form's list`);
    for (const r of c.relatedTo) assert.ok(INSURANCE_CONTENT[r], `${slug} relates to ${r}, which exists`);
  }
});
