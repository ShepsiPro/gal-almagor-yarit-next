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
