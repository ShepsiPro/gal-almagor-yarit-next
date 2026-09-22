// The CRM side of a submission.
//
// This site's database is the record (lib/submissions.ts). Mslahtk is where
// the agency WORKS the record: the customer card (a lead is linked to a
// Customer by phone, so a returning customer lands on the same card), the
// pipeline, WhatsApp, the owner dashboard and the phone app. So every
// submission is also filed there as a lead, over the TRUSTED server-to-server
// route:
//   POST {api}/service/sites/{projectId}/leads   Authorization: Bearer <token>
// The public route is Origin-checked against *.mslahtk.ai, which a custom
// domain fails, silently; the service route is for a first-party backend.
//
// The lead carries `_submissionId` and this site's row carries the lead id,
// so both directions resolve: Mslahtk's launch button opens the right record
// here, and the back-office links straight to the lead there.
//
// Env, in the names Mslahtk's "Connect app" writes, with this site's older
// names accepted as aliases:
//   MSLAHTK_API              (alias MSLAHTK_API_BASE)
//   MSLAHTK_PROJECT_ID
//   MSLAHTK_SERVICE_TOKEN
//   MSLAHTK_CONNECTION_SECRET (alias ADMIN_LINK_SECRET; launch tokens + webhooks, see lib/admin-auth.ts)
//   MSLAHTK_DASHBOARD_URL     optional, where "open in Mslahtk" links point

export type MslahtkConfig = { api: string; projectId: string; serviceToken: string; dashboardUrl: string };

export function mslahtkConfig(): MslahtkConfig {
  // MSLAHTK_API_BASE is this site's own older name; MSLAHTK_API is the name
  // Connect app writes. The site's own name wins when both exist.
  const api = (process.env.MSLAHTK_API_BASE || process.env.MSLAHTK_API || "https://intake-api.mslahtk.ai").replace(/\/+$/, "");
  return {
    api,
    projectId: (process.env.MSLAHTK_PROJECT_ID || "").trim(),
    serviceToken: (process.env.MSLAHTK_SERVICE_TOKEN || "").trim(),
    dashboardUrl: (process.env.MSLAHTK_DASHBOARD_URL || defaultDashboardUrl(api)).replace(/\/+$/, ""),
  };
}

/**
 * The dashboard that goes with an API host: intake-api.mslahtk.ai is served
 * by intake.mslahtk.ai, intake-api-staging by intake-staging. Derived so a
 * staging connection never emails a production link, unless told otherwise.
 */
function defaultDashboardUrl(api: string): string {
  try {
    const host = new URL(api).hostname;
    if (host.startsWith("intake-api")) return `https://${host.replace(/^intake-api/, "intake")}`;
  } catch {
    /* fall through */
  }
  return "https://intake.mslahtk.ai";
}

export function mslahtkConfigured(): boolean {
  const c = mslahtkConfig();
  return Boolean(c.projectId && c.serviceToken);
}

/** Non-secret summary for the health page. */
export function describeMslahtk() {
  const c = mslahtkConfig();
  return { configured: mslahtkConfigured(), api: c.api, projectId: c.projectId || null, hasServiceToken: Boolean(c.serviceToken) };
}

/** Deep link into the Mslahtk dashboard, straight onto a lead. */
export function dashboardLeadUrl(leadId: string): string {
  return `${mslahtkConfig().dashboardUrl}/dashboard?lead=${encodeURIComponent(leadId)}`;
}

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

/** Drop the largest values until `fields` fits the API cap. */
function fitFields(fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  const size = () => Buffer.byteLength(JSON.stringify(out), "utf8");
  if (size() <= MAX_FIELDS_BYTES) return out;
  const byLength = Object.keys(out).sort((a, b) => out[b].length - out[a].length);
  for (const key of byLength) {
    out[key] = out[key].slice(0, 500) + "... (נחתך)";
    if (size() <= MAX_FIELDS_BYTES) break;
  }
  return out;
}

/**
 * File one lead. Never throws: the submission is already on record here and
 * the email goes out regardless, so a Mslahtk outage degrades to "the card
 * appears later" (the sweep links it) instead of losing a customer's form.
 */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const cfg = mslahtkConfig();
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
    const res = await fetch(`${cfg.api}/service/sites/${encodeURIComponent(cfg.projectId)}/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.serviceToken}`,
      },
      body: JSON.stringify(body),
      // A slow CRM must not hold the customer on a spinner; the record is
      // already written and the sweep links a late-created lead afterwards.
      signal: AbortSignal.timeout(8000),
    });

    const json = (await res.json().catch(() => ({}))) as { leadId?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `Mslahtk responded ${res.status}` };
    }
    if (!json.leadId) {
      // captureLead answers { ok: true, leadId: null } when its honeypot trips:
      // the submission is DROPPED there, not stored. We never send a honeypot
      // field, so this should not happen; reporting it as a plain error would
      // hide the one case where the CRM copy was silently discarded.
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

// ── Working an existing lead ───────────────────────────────────────────────
//
// A case (lib/home-case.ts) is ONE lead: the customer's request creates it, and
// the agency's offer and the customer's signed answer move that same lead along
// and write their summary onto it, rather than opening a new card each time.
// Both helpers never throw: the record is already written here, so a CRM miss
// is a log line and a note in the back-office, not a failed submission.

export type LeadOpResult = { ok: true } | { ok: false; error: string; skipped?: boolean };

/** POST .../leads/:id/stage. `via` is what the Mslahtk timeline shows as the actor. */
export async function setLeadStage(leadId: string, status: string, via: string): Promise<LeadOpResult> {
  const cfg = mslahtkConfig();
  if (!mslahtkConfigured()) return { ok: false, error: "Mslahtk is not configured", skipped: true };
  try {
    const res = await fetch(`${cfg.api}/service/sites/${encodeURIComponent(cfg.projectId)}/leads/${encodeURIComponent(leadId)}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.serviceToken}` },
      body: JSON.stringify({ status, via }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: json.message || `Mslahtk responded ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * PATCH .../leads/:id: merge `fields` onto the lead (keys [A-Za-z0-9_.-], values
 * up to 2000 chars, 50 per call) and optionally replace its note. Needs the
 * `leads:write` scope on the service token.
 */
export async function updateLead(
  leadId: string,
  patch: { fields?: Record<string, string | number | boolean>; notes?: string },
): Promise<LeadOpResult> {
  const cfg = mslahtkConfig();
  if (!mslahtkConfigured()) return { ok: false, error: "Mslahtk is not configured", skipped: true };
  const fields: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(patch.fields ?? {})) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(k)) continue;
    fields[k] = typeof v === "string" ? v.slice(0, 2000) : v;
  }
  try {
    const res = await fetch(`${cfg.api}/service/sites/${encodeURIComponent(cfg.projectId)}/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.serviceToken}` },
      body: JSON.stringify({
        ...(Object.keys(fields).length ? { fields } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 5000) } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: json.message || `Mslahtk responded ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Reading leads back (the status sweep) ──────────────────────────────────
//
// Needs `leads:fields` on the token (preset `site-backend`). Only the status
// and the `_submissionId` marker are used here; the answers themselves are
// this site's own rows.

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  category: string | null;
  ctaId: string | null;
  ctaLabel: string | null;
  fields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
};

export async function listLeads(opts: { limit?: number; offset?: number; timeoutMs?: number } = {}) {
  const cfg = mslahtkConfig();
  const q = new URLSearchParams();
  q.set("limit", String(Math.min(Math.max(opts.limit ?? 50, 1), 100)));
  if (opts.offset) q.set("offset", String(opts.offset));
  const res = await fetch(`${cfg.api}/service/sites/${encodeURIComponent(cfg.projectId)}/leads?${q.toString()}`, {
    headers: { Authorization: `Bearer ${cfg.serviceToken}` },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { items?: LeadRow[]; total?: number; message?: string };
  if (!res.ok) {
    throw new Error(json.message || `Mslahtk responded ${res.status}`);
  }
  return { items: json.items ?? [], total: json.total ?? 0 };
}

/**
 * Mslahtk's standard pipeline statuses in Hebrew. A business can rename its
 * columns in Mslahtk, in which case the raw key is shown as is.
 */
export function statusLabel(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "":
      return "";
    case "new":
      return "חדש";
    case "contacted":
      return "נוצר קשר";
    case "qualified":
      return "בטיפול";
    case "won":
      return "נסגר";
    case "lost":
      return "לא התקדם";
    case "rejected":
      return "לא רלוונטי";
    default:
      return String(status);
  }
}
