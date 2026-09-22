/**
 * One-time R2 setup, from the one token you created in the Cloudflare
 * dashboard: creates the bucket if it is missing, then proves a put, a signed
 * read and a delete. Prints names and outcomes, never a value.
 *
 *   npm run r2:setup            reads .env.local and .env like the app does
 *   railway run npm run r2:setup   same, with the Railway service's variables
 */
import { existsSync, readFileSync } from "node:fs";
import { checkBucket, deleteObject, describeStorage, ensureBucket, putObject, r2Configured, signedReadUrl } from "../lib/storage";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const d = describeStorage();
  console.log("bucket:", d.r2.bucket ?? "(R2_BUCKET missing)", "| account:", d.r2.accountId ?? "(R2_ACCOUNT_ID missing)");
  if (!r2Configured()) {
    console.error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");
    process.exit(1);
  }

  console.log("bucket:", await ensureBucket());
  const head = await checkBucket();
  if (!head.ok) throw new Error(`bucket not reachable: ${head.status ?? ""} ${head.message}`);

  const key = `_probe/${Date.now()}.txt`;
  await putObject(key, Buffer.from("yarit storage probe"), "text/plain");
  const url = await signedReadUrl(key, { filename: "probe.txt" });
  const res = await fetch(url);
  const body = await res.text();
  await deleteObject("r2", key);
  if (!res.ok || body !== "yarit storage probe") throw new Error(`signed read failed: ${res.status}`);
  console.log("put / signed read / delete: ok");
  console.log("R2 is ready.");
}

main().catch((err) => {
  console.error("r2-setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
