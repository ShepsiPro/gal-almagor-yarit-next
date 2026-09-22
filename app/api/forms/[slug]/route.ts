// The public door for /forms/<slug>: customer forms only. The pipeline itself
// (validation, the record, storage, the CRM, the email) is lib/form-submit.ts,
// shared with the back-office door at /admin/forms/<slug>.

import { handleFormSubmission } from "@/lib/form-submit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleFormSubmission(req, slug, { page: `/forms/${slug}` });
}
