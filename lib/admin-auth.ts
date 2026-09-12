// Admin session for the Yarit back-office.
//
// Entry is a signed, short-lived link minted by Mslahtk — the same handoff
// Mslahtk already uses for "Re-open in Verox": a base64url payload plus an
// HMAC-SHA256 signature over a secret both sides hold. The secret never leaves
// either server; the browser only ever carries the finished token.
//
// Once verified, the token is exchanged for a longer-lived session cookie so a
// single link does not have to be re-clicked all day, and so the entry token
// (which may sit in browser history or a chat log) stops being useful quickly.
//
//   ADMIN_LINK_SECRET   shared with Mslahtk, mints/verifies the entry link
//   ADMIN_SESSION_TTL_H optional, default 8

import { createHmac, timingSafeEqual } from "crypto";

const ENTRY_TTL_MS = 15 * 60_000; // a launch link is used immediately or not at all
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_H || 8) * 60 * 60_000;

export const ADMIN_COOKIE = "yarit_admin";

export type AdminIdentity = {
  /** Mslahtk user id */
  sub: string;
  email?: string;
  /** Mslahtk project this admin was launched for. */
  pid?: string;
};

function secret(): string {
  const s = process.env.ADMIN_LINK_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_LINK_SECRET must be set in production");
  }
  return "yarit-admin-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Verification must never throw.
 *
 * `secret()` refuses to fall back in production, which is right when MINTING —
 * a link signed with the dev secret would be forgeable by anyone who has read
 * this file. But on the verify path that same throw turned an unconfigured
 * deployment into a 500 on /admin/entry for every visitor, instead of the
 * honest "this link is not valid". Fail closed, quietly: no readable secret
 * means no valid token, which is exactly what an unconfigured server should
 * believe.
 */
function verifiable(): string | null {
  try {
    return secret();
  } catch {
    return null;
  }
}

/** Constant-time compare so a wrong signature leaks nothing through timing. */
function signatureMatches(payload: string, given: string): boolean {
  if (!verifiable()) return false;
  const expected = Buffer.from(sign(payload), "base64url");
  const got = Buffer.from(given, "base64url");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

function encode(obj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined | null): Record<string, unknown> | null {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  try {
    if (!signatureMatches(payload, sig)) return null;
  } catch {
    return null;
  }
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!obj?.exp || Date.now() > Number(obj.exp)) return null;
    return obj as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Mint an entry link. Mslahtk does this in production; the script in
 *  scripts/mint-admin-link.mjs does it locally against the same secret. */
export function mintEntryToken(identity: AdminIdentity): string {
  return encode({ ...identity, kind: "entry", exp: Date.now() + ENTRY_TTL_MS });
}

export function verifyEntryToken(token: string | undefined | null): AdminIdentity | null {
  const obj = decode(token);
  if (!obj || obj.kind !== "entry") return null;
  return { sub: String(obj.sub), email: obj.email ? String(obj.email) : undefined, pid: obj.pid ? String(obj.pid) : undefined };
}

export function mintSessionCookie(identity: AdminIdentity): { value: string; maxAge: number } {
  return {
    value: encode({ ...identity, kind: "session", exp: Date.now() + SESSION_TTL_MS }),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function readSession(cookieValue: string | undefined | null): AdminIdentity | null {
  const obj = decode(cookieValue);
  if (!obj || obj.kind !== "session") return null;
  return { sub: String(obj.sub), email: obj.email ? String(obj.email) : undefined, pid: obj.pid ? String(obj.pid) : undefined };
}
