// The car insurance request's two documents (owner, 2026-11-06): the vehicle
// registration and the car owner's ID are required, and every upload is checked
// to really be an image or a PDF, by its first bytes, not its name or the type
// the browser declared.
import test from "node:test";
import assert from "node:assert/strict";
import { allFields, getForm, sniffFileKind } from "../lib/forms";

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)));

test("the car request requires the vehicle registration and the owner's ID", () => {
  const form = getForm("car")!;
  const section = form.sections.find((s) => s.fields.some((f) => f.name === "doc_owner_id"))!;
  assert.equal(section.title, "צירוף מסמכים", "no longer marked optional");
  assert.ok(!(section.description ?? "").includes("אינו חובה"));
  for (const name of ["doc_vehicle_license", "doc_owner_id"]) {
    const field = allFields(form).find((f) => f.name === name)!;
    assert.equal(field.type, "file", name);
    assert.equal(field.required, true, `${name} is required`);
    assert.equal(field.showWhen, undefined, `${name} is always asked`);
  }
});

test("an upload is checked by what it really is", () => {
  assert.equal(sniffFileKind(bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF")), "image", "JPEG");
  assert.equal(sniffFileKind(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR")), "image", "PNG");
  assert.equal(sniffFileKind(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")), "image", "WEBP");
  assert.equal(sniffFileKind(bytes([0, 0, 0, 24], "ftypheic", [0, 0, 0, 0], "mif1")), "image", "an iPhone HEIC");
  assert.equal(sniffFileKind(bytes([0, 0, 0, 24], "ftypmif1")), "image", "a HEIF");
  assert.equal(sniffFileKind(bytes("%PDF-1.7\n")), "pdf");
  assert.equal(sniffFileKind(bytes(" ".repeat(300), "%PDF-1.4")), "pdf", "a PDF whose header is not on the first byte");

  assert.equal(sniffFileKind(bytes([0, 0, 0, 24], "ftypisom")), null, "a video opens with ftyp too, but not an image brand");
  assert.equal(sniffFileKind(bytes("PK", [3, 4], "word/document.xml")), null, "a Word file renamed to .jpg");
  assert.equal(sniffFileKind(bytes("hello, this is not a photo")), null, "text");
  assert.equal(sniffFileKind(new Uint8Array(0)), null, "empty");
  assert.equal(sniffFileKind(bytes(" ".repeat(1100), "%PDF-1.4")), null, "a PDF header past the first kilobyte is not a PDF");
});
