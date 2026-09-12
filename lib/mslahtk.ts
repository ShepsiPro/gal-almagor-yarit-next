// Lead capture into Mslahtk.
//
// Uses the TRUSTED server-to-server route, the same one Verox uses:
//   POST {apiBase}/service/sites/{projectId}/leads
//   Authorization: Bearer <service-account token>
//
// Why the service route and not /public/sites/... :
//   1. The public route is Origin-checked against Project.allowedOrigin, which
//      Mslahtk derives from `https://<subdomain>.mslahtk.ai`. This site is on a
//      custom domain, so the public route would 403 every submission — silently,
//      with nothing visible in either dashboard.
//   2. The service route skips Turnstile and the Origin check, because the
//      caller is a first-party backend. We already have one.
//
// Mslahtk links the lead to a Customer by phone (Customer is unique per
// [projectId, phone]), so a returning customer lands on the same card rather
// than creating a second one.

// NOTE: SHEPSIPRO_SITE_INTEGRATION.md documents the base as api.mslahtk.ai —
// that host does not resolve. The live API is intake-api.mslahtk.ai
// (staging: intake-api-staging.mslahtk.ai), which is what the frontend uses.
const API_BASE = (process.env.MSLAHTK_API_BASE || "https://intake-api.mslahtk.ai").replace(/\/$/, "");
const PROJECT_ID = process.env.MSLAHTK_PROJECT_ID || "";
const SERVICE_TOKEN = process.env.MSLAHTK_SERVICE_TOKEN || "";

/** The API caps `fields` at 32KB; stay under it so a submission is never rejected whole. */
const MAX_FIELDS_BYTES = 30 * 1024;

export type LeadSource = {
  page?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type LeadInput = {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  /** The form answers, schema-free. */
  fields: Record<string, string>;
  ctaId?: string;
  ctaLabel?: string;
  category?: string;
  source?: LeadSource;
};

export type LeadResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string; skipped?: boolean; rejected?: boolean };

export function mslahtkConfigured(): boolean {
  return Boolean(PROJECT_ID && SERVICE_TOKEN);
}

/** Drop the largest values until `fields` fits the API cap. */
function fitFields(fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  const size = () => Buffer.byteLength(JSON.stringify(out), "utf8");
  if (size() <= MAX_FIELDS_BYTES) return out;
  const byLength = Object.keys(out).sort((a, b) => out[b].length - out[a].length);
  for (const key of byLength) {
    out[key] = out[key].slice(0, 500) + "… (נחתך)";
    if (size() <= MAX_FIELDS_BYTES) break;
  }
  return out;
}

/**
 * Send one lead. Never throws: the caller emails the submission regardless, so
 * a Mslahtk outage degrades to "we still got the mail" instead of losing a
 * customer's form.
 */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  if (!mslahtkConfigured()) {
    return { ok: false, error: "Mslahtk is not configured", skipped: true };
  }
  if (!input.phone && !input.email) {
    return { ok: false, error: "lead needs at least a phone or an email" };
  }

  const body = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    message: input.message,
    fields: fitFields(input.fields),
    ctaId: input.ctaId,
    ctaLabel: input.ctaLabel,
    category: input.category,
    source: input.source,
  };

  try {
    const res = await fetch(`${API_BASE}/service/sites/${PROJECT_ID}/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify(body),
      // A slow CRM must not hold the customer on a spinner; the email is the backstop.
      signal: AbortSignal.timeout(8000),
    });

    const json = (await res.json().catch(() => ({}))) as { leadId?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `Mslahtk responded ${res.status}` };
    }
    if (!json.leadId) {
      // captureLead answers { ok: true, leadId: null } when its honeypot trips:
      // the submission is DROPPED, not stored. We never send a honeypot field,
      // so this should not happen — but reporting it as a plain error would
      // hide the one case where a real customer was silently discarded.
      return {
        ok: false,
        rejected: true,
        error: "הפנייה נדחתה על ידי מסנן הספאם של המערכת",
      };
    }
    return { ok: true, leadId: json.leadId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, error: reason };
  }
}

// ── Attachments ────────────────────────────────────────────────────────────
//
// The submission's files, onto the lead and so onto the customer's card.
// Three steps per file, mirroring the dashboard's own upload: ask for a signed
// PUT url, send the bytes straight to storage, then tell Mslahtk the object is
// there. The bytes never pass through Mslahtk's API, which is why an 8MB
// photograph is not a 32KB-capped `fields` problem.
//
// Requires the token to carry `leads:files:write` (preset `site-backend`).
// Until that scope is granted every call 403s — which is why nothing here is
// fatal: the lead is already filed, the email still carries the same files,
// and a submission must never fail because the gallery did.

export type LeadFile = { filename: string; contentType: string; content: Buffer };
export type UploadSummary = { uploaded: number; failed: number; errors: string[] };

const UPLOAD_BUDGET_MS = 15_000;

async function uploadOne(leadId: string, file: LeadFile, signal: AbortSignal): Promise<void> {
  const base = `${API_BASE}/service/sites/${PROJECT_ID}/leads/${leadId}/files`;
  const auth = { Authorization: `Bearer ${SERVICE_TOKEN}`, "Content-Type": "application/json" };

  const signRes = await fetch(`${base}/sign-upload`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ contentType: file.contentType, filename: file.filename }),
    signal,
  });
  const sign = (await signRes.json().catch(() => ({}))) as {
    uploadUrl?: string;
    publicUrl?: string;
    message?: string;
  };
  if (!signRes.ok || !sign.uploadUrl || !sign.publicUrl) {
    throw new Error(sign.message || `sign-upload responded ${signRes.status}`);
  }

  // Straight to storage. The signed url encodes the content type, so sending a
  // different one here fails the signature rather than storing a mislabelled
  // object.
  const putRes = await fetch(sign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.contentType },
    body: new Uint8Array(file.content),
    signal,
  });
  if (!putRes.ok) throw new Error(`storage PUT responded ${putRes.status}`);

  const recRes = await fetch(base, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      url: sign.publicUrl,
      mimeType: file.contentType,
      filename: file.filename,
      size: file.content.byteLength,
    }),
    signal,
  });
  if (!recRes.ok) {
    const j = (await recRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || `record responded ${recRes.status}`);
  }
}

/** Never throws. Reports what happened so the email can say so. */
export async function uploadLeadFiles(leadId: string, files: LeadFile[]): Promise<UploadSummary> {
  const out: UploadSummary = { uploaded: 0, failed: 0, errors: [] };
  if (!leadId || !files.length || !PROJECT_ID || !SERVICE_TOKEN) return out;

  // One budget for the whole batch, not per file: the customer is waiting on
  // this response, and a storage outage should cost them one wait, not six.
  const deadline = Date.now() + UPLOAD_BUDGET_MS;
  for (const file of files) {
    const left = deadline - Date.now();
    if (left <= 500) {
      out.failed += 1;
      out.errors.push(`${file.filename}: לא הועלה (חריגת זמן)`);
      continue;
    }
    try {
      await uploadOne(leadId, file, AbortSignal.timeout(left));
      out.uploaded += 1;
    } catch (err) {
      out.failed += 1;
      out.errors.push(`${file.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

// ── Reading submissions back ───────────────────────────────────────────────
//
// The other direction: Mslahtk stores `fields` as opaque keys, because it has
// no idea what an insurance declaration is. This site holds the map — labels,
// section order, conditional logic — so the back-office renders from here.
//
// Needs `leads:fields` on the token (preset `site-backend`).

export type StoredFile = {
  id: string;
  url: string;
  kind: string;
  mimeType: string | null;
  filename: string | null;
  size: number | null;
  createdAt: string;
};

export type StoredLead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  category: string | null;
  ctaId: string | null;
  ctaLabel: string | null;
  fields: Record<string, string>;
  createdAt: string;
};

export type StoredLeadDetail = {
  lead: StoredLead;
  customer: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  files: StoredFile[];
};

async function readJson<T>(path: string, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(`${API_BASE}/service/sites/${PROJECT_ID}${path}`, {
    headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { message?: string }).message || `Mslahtk responded ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** A page of submissions, newest first. */
export function listStoredLeads(opts: { limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(Math.min(Math.max(opts.limit ?? 50, 1), 100)));
  if (opts.offset) q.set("offset", String(opts.offset));
  return readJson<{ items: StoredLead[]; total: number; limit: number; offset: number }>(
    `/leads?${q.toString()}`,
  );
}

export function getStoredLead(leadId: string) {
  return readJson<StoredLeadDetail>(`/leads/${encodeURIComponent(leadId)}`);
}
