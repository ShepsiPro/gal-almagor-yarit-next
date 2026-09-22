#!/usr/bin/env node
// Boot: apply migrations when a database is configured, then start Next.
//
// A site that has not been upgraded to a system yet has no DATABASE_URL and
// must still boot: the system kit stays dormant until Mslahtk's "Upgrade the
// site to a system" writes one into the service. Signals are forwarded so a
// Railway stop reaches Next cleanly.
import { spawn, spawnSync } from "node:child_process";

const port = process.env.PORT || "3000";
const hasDb = Boolean((process.env.DATABASE_URL || "").trim());

if (hasDb) {
  const m = spawnSync("npx", ["--no-install", "prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
  if (m.status !== 0) {
    console.error(`[start] prisma migrate deploy exited with ${m.status ?? "signal"}`);
    process.exit(m.status ?? 1);
  }
} else {
  console.log("[start] DATABASE_URL is not set: starting without a database (system kit dormant)");
}

const next = spawn("npx", ["--no-install", "next", "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit", env: process.env });
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
