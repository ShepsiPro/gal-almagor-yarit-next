import { NextRequest, NextResponse } from "next/server";
import { connectionSecret } from "@/lib/admin-auth";
import { mslahtkConfig } from "@/lib/mslahtk";
import { applyDelivery, parseDelivery, verifySignature } from "@/lib/mslahtk-sync";

export const runtime = "nodejs";

/**
 * POST /api/mslahtk/webhook   (also mounted at /mslahtk/webhook, Connect app's default)
 *
 * Mslahtk's deliveries. Verified against the RAW body with the connection
 * secret, applied once per delivery id, and answered 200 once the outcome is
 * settled: a rejected signature says only "rejected", and a delivery this site
 * cannot use is not an error Mslahtk should keep retrying (it disables a
 * subscription after five consecutive failures). A failure is reserved for
 * "try again later": the database was unreachable.
 */
export async function POST(req: NextRequest) {
  const secret = connectionSecret();
  const raw = await req.text();
  if (!secret || !verifySignature(raw, req.headers.get("x-mslahtk-signature"), secret)) {
    return NextResponse.json({ ok: false, reason: "rejected" }, { status: 200 });
  }
  const delivery = parseDelivery(raw);
  const deliveryId = (req.headers.get("x-mslahtk-delivery-id") || "").trim();
  if (!delivery || !deliveryId) return NextResponse.json({ ok: false, reason: "unreadable" }, { status: 200 });

  try {
    const outcome = await applyDelivery(deliveryId, delivery, mslahtkConfig().projectId);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error("[mslahtk webhook] not applied", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, reason: "retry" }, { status: 503 });
  }
}
