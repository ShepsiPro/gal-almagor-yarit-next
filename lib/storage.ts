// Where the customers' documents live.
//
// R2 is the standard for every custom system: a PRIVATE bucket, the bytes put
// from the server, and every read a short-lived signed URL minted for one
// signed-in admin. Nothing in the bucket is ever public, and no URL is ever
// stored: a row holds a KEY, and the URL is made at the moment it is needed.
//
// "disk" exists for local development only (no credentials needed): files go
// under .data/uploads. Production without R2 configured stores nothing and
// says so; the submission still goes through, with the files on the email.
//
// Env: R2_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID), R2_ACCESS_KEY_ID,
//      R2_SECRET_ACCESS_KEY, R2_BUCKET. Optional STORAGE_DRIVER=disk|r2.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageDriver = "r2" | "disk";

// Read lazily, not at import time, so a script can load its env file first.
function r2Env() {
  return {
    accountId: (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || "").trim(),
    bucket: (process.env.R2_BUCKET || "").trim(),
  };
}

export function r2Configured(): boolean {
  const e = r2Env();
  return Boolean(e.accountId && e.accessKeyId && e.secretAccessKey && e.bucket);
}

/** The driver in force, or null when files cannot be stored at all. */
export function storageDriver(): StorageDriver | null {
  const forced = (process.env.STORAGE_DRIVER || "").trim().toLowerCase();
  if (forced === "disk") return "disk";
  if (r2Configured()) return "r2";
  if (forced === "r2") return null;
  return process.env.NODE_ENV === "production" ? null : "disk";
}

/** Non-secret summary for the health page and logs. */
export function describeStorage() {
  const e = r2Env();
  return {
    driver: storageDriver(),
    r2: { configured: r2Configured(), bucket: e.bucket || null, accountId: e.accountId ? `${e.accountId.slice(0, 6)}...` : null },
  };
}

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    const e = r2Env();
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${e.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey },
    });
  }
  return s3;
}

const DISK_ROOT = path.resolve(process.cwd(), process.env.STORAGE_DISK_ROOT || ".data/uploads");

function diskPath(key: string): string {
  const file = path.resolve(DISK_ROOT, key);
  if (!file.startsWith(DISK_ROOT + path.sep)) throw new Error("storage key escapes the upload root");
  return file;
}

/**
 * A key never carries a user-typed name. The submission groups its files, a
 * random id makes the key unguessable even if the bucket were ever listed, and
 * the extension is kept only so a viewer opening the object gets the right app.
 */
export function newObjectKey(submissionId: string, filename: string): string {
  const ext = (filename.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] || "").toLowerCase();
  return `submissions/${submissionId}/${randomBytes(12).toString("hex")}${ext}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<StorageDriver> {
  const driver = storageDriver();
  if (!driver) {
    throw new Error("no file storage configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
  }
  if (driver === "r2") {
    await client().send(new PutObjectCommand({ Bucket: r2Env().bucket, Key: key, Body: body, ContentType: contentType }));
  } else {
    const file = diskPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  return driver;
}

/** Seconds a read URL stays valid: long enough to open, too short to pass around. */
export const READ_URL_TTL_S = 300;

export function contentDisposition(filename?: string, download = false): string {
  const kind = download ? "attachment" : "inline";
  return filename ? `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}` : kind;
}

export async function signedReadUrl(
  key: string,
  opts: { filename?: string; contentType?: string; download?: boolean } = {},
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: r2Env().bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(opts.filename, opts.download),
      ResponseContentType: opts.contentType,
    }),
    { expiresIn: READ_URL_TTL_S },
  );
}

export async function readObject(driver: StorageDriver, key: string): Promise<Buffer> {
  if (driver === "disk") return readFile(diskPath(key));
  const out = await client().send(new GetObjectCommand({ Bucket: r2Env().bucket, Key: key }));
  const bytes = await out.Body?.transformToByteArray();
  return Buffer.from(bytes ?? new Uint8Array());
}

export async function deleteObject(driver: StorageDriver, key: string): Promise<void> {
  if (driver === "disk") {
    await unlink(diskPath(key)).catch(() => undefined);
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: r2Env().bucket, Key: key }));
}

/** Is the bucket there, and does the token reach it? For the setup script and the health probe. */
export async function checkBucket(): Promise<{ ok: true } | { ok: false; status?: number; message: string }> {
  try {
    await client().send(new HeadBucketCommand({ Bucket: r2Env().bucket }));
    return { ok: true };
  } catch (err) {
    const e = err as { $metadata?: { httpStatusCode?: number }; name?: string; message?: string };
    return { ok: false, status: e.$metadata?.httpStatusCode, message: e.name || e.message || String(err) };
  }
}

/**
 * Create the bucket if it is missing. R2 accepts CreateBucket over the S3 API,
 * which is what lets ONE token do the whole setup with no dashboard visit
 * beyond creating that token.
 */
export async function ensureBucket(): Promise<"exists" | "created"> {
  const head = await checkBucket();
  if (head.ok) return "exists";
  if (head.status && head.status !== 404) throw new Error(`bucket check failed: ${head.status} ${head.message}`);
  await client().send(new CreateBucketCommand({ Bucket: r2Env().bucket }));
  return "created";
}
