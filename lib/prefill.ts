// "Send this form again, with some answers already filled and locked."
//
// The agency picks a form, sets values, and marks which of them the customer
// may NOT change (a plate number the agency verified, a premium that was
// quoted). That whole instruction travels inside one signed token in the link,
// so there is nothing to store and nothing to look up when the link is opened.
//
// Signed, because the locked values are the point: without a signature the
// customer could edit the URL and hand back a declaration that says whatever
// they like while looking exactly like one the agency prepared.

import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 14 * 24 * 60 * 60_000; // a fortnight to act on a sent form

export type Prefill = {
  slug: string;
  /** Field name → value the form opens with. */
  values: Record<string, string>;
  /** Field names the customer cannot change. Must be a subset of `values`. */
  locked: string[];
  /** Lead this was built from, so the new submission can be traced back. */
  fromLeadId?: string;
};

function secret(): string {
  const s = process.env.ADMIN_LINK_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_LINK_SECRET must be set in production");
  }
  return "yarit-admin-dev-secret";
}

export function mintPrefillToken(p: Prefill): string {
  const payload = Buffer.from(
    JSON.stringify({ ...p, exp: Date.now() + TTL_MS }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPrefillToken(token: string | undefined | null): Prefill | null {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!obj?.exp || Date.now() > Number(obj.exp)) return null;
    const values = (obj.values ?? {}) as Record<string, string>;
    // A lock on a field with no value would render an empty, uneditable box the
    // customer can neither fill nor get past.
    const locked = (Array.isArray(obj.locked) ? obj.locked : []).filter(
      (n: unknown) => typeof n === "string" && n in values,
    );
    return { slug: String(obj.slug), values, locked, fromLeadId: obj.fromLeadId ? String(obj.fromLeadId) : undefined };
  } catch {
    return null;
  }
}
