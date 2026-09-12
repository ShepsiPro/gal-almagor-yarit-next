#!/usr/bin/env node
// Mint a back-office entry link.
//
// Mslahtk will do this itself once the button is wired; until then this is how
// the agency gets in. The secret is read from the environment and never printed,
// so the link can be pasted anywhere but the secret stays where you put it.
//
//   ADMIN_LINK_SECRET=… node scripts/mint-admin-link.mjs [email] [--prod]
//
// Without ADMIN_LINK_SECRET it uses the same dev fallback as the app, which
// only works against a local dev server.

import { createHmac } from "node:crypto";

const args = process.argv.slice(2).filter((a) => a !== "--prod");
const prod = process.argv.includes("--prod");
const email = args[0] || "agency@almagor-yaarit.com";

const secret = process.env.ADMIN_LINK_SECRET || "yarit-admin-dev-secret";
if (!process.env.ADMIN_LINK_SECRET) {
  if (prod) {
    console.error("ADMIN_LINK_SECRET is required with --prod (copy it from Railway).");
    process.exit(1);
  }
  console.error("· no ADMIN_LINK_SECRET set — using the dev fallback (localhost only)\n");
}

const payload = Buffer.from(
  JSON.stringify({
    sub: `manual:${email}`,
    email,
    pid: process.env.MSLAHTK_PROJECT_ID || undefined,
    kind: "entry",
    exp: Date.now() + 15 * 60_000,
  }),
).toString("base64url");

const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
const origin = prod ? "https://almagor-yaarit.com" : "http://localhost:3100";

console.log(`${origin}/admin/entry?t=${encodeURIComponent(token)}`);
console.log("\n· valid 15 minutes, then it is exchanged for an 8-hour session cookie");
