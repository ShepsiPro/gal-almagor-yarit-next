// The record: this site's own submissions, in its own database.
//
// Everything the back-office shows comes from here. Mslahtk gets a copy as a
// lead (lib/mslahtk.ts) and the agency mailbox gets a notification
// (lib/mailer.ts), but a form that reached this table is on record whatever
// happened to the other two.

import type { Prisma, Submission, SubmissionFile } from "@prisma/client";
import { db } from "./db";
import { newObjectKey, putObject, storageDriver, type StorageDriver } from "./storage";

export type SubmissionWithFiles = Submission & { files: SubmissionFile[] };

export type NewSubmission = {
  formSlug: string;
  formTitle: string;
  name?: string;
  phone?: string;
  email?: string;
  answers: Record<string, string>;
  source?: Record<string, unknown>;
  resentFromId?: string | null;
  /** The case (request submission) this offer or answer belongs to. */
  parentId?: string | null;
};

export async function createSubmission(input: NewSubmission): Promise<Submission> {
  return db.submission.create({
    data: {
      formSlug: input.formSlug,
      formTitle: input.formTitle,
      name: input.name || null,
      phone: input.phone || null,
      email: input.email || null,
      answers: input.answers as Prisma.InputJsonObject,
      source: (input.source ?? undefined) as Prisma.InputJsonObject | undefined,
      resentFromId: input.resentFromId || null,
      parentId: input.parentId || null,
    },
  });
}

export type IncomingFile = { fieldName: string; filename: string; contentType: string; content: Buffer };
export type StoreResult = { driver: StorageDriver | null; stored: number; failed: number; errors: string[] };

// One budget for the whole batch, not per file: the customer is waiting on
// this response, and a storage outage should cost them one wait, not six.
const STORE_BUDGET_MS = 20_000;

/** Never throws. Reports what happened so the email and the log can say so. */
export async function storeFiles(submissionId: string, files: IncomingFile[]): Promise<StoreResult> {
  const out: StoreResult = { driver: storageDriver(), stored: 0, failed: 0, errors: [] };
  if (!files.length) return out;
  if (!out.driver) {
    out.failed = files.length;
    out.errors.push("no file storage configured");
    return out;
  }
  const deadline = Date.now() + STORE_BUDGET_MS;
  for (const f of files) {
    if (Date.now() > deadline) {
      out.failed += 1;
      out.errors.push(`${f.filename}: skipped, time budget spent`);
      continue;
    }
    const key = newObjectKey(submissionId, f.filename);
    try {
      const driver = await putObject(key, f.content, f.contentType);
      await db.submissionFile.create({
        data: {
          submissionId,
          fieldName: f.fieldName,
          storage: driver,
          storageKey: key,
          filename: f.filename,
          mimeType: f.contentType,
          size: f.content.byteLength,
        },
      });
      out.stored += 1;
    } catch (err) {
      out.failed += 1;
      out.errors.push(`${f.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

export async function listSubmissions(opts: { limit?: number; offset?: number } = {}) {
  const take = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const skip = Math.max(opts.offset ?? 0, 0);
  const [items, total] = await Promise.all([
    db.submission.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        _count: { select: { files: true } },
        children: { select: { formSlug: true, answers: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.submission.count(),
  ]);
  return { items, total, limit: take, offset: skip };
}

/** By this site's own id, or by the Mslahtk lead id a launch token carries. */
export async function getSubmission(ref: string): Promise<SubmissionWithFiles | null> {
  if (!ref) return null;
  return db.submission.findFirst({
    where: { OR: [{ id: ref }, { mslahtkLeadId: ref }] },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
}

/** The stored answers as the flat string map the form definition expects. */
export function answersOf(sub: Pick<Submission, "answers">): Record<string, string> {
  const raw = sub.answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
}
