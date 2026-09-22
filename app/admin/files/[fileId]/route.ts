import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentDisposition, readObject, signedReadUrl } from "@/lib/storage";
import { currentAdmin } from "../../session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /admin/files/<fileId>[?download=1]
 *
 * The only way a document leaves storage. The session cookie is scoped to
 * /admin, so this route sees it; an unauthenticated request gets the same 404
 * as the rest of the back-office. For R2 the answer is a redirect to a URL
 * signed for five minutes; for the local disk driver the bytes are streamed.
 * Either way the browser never learns a bucket name or a key.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new NextResponse(null, { status: 404 });

  const { fileId } = await params;
  const file = await db.submissionFile.findUnique({ where: { id: fileId } });
  if (!file) return new NextResponse(null, { status: 404 });

  const download = req.nextUrl.searchParams.get("download") === "1";
  const noStore = { "Cache-Control": "private, no-store" };

  if (file.storage === "r2") {
    const url = await signedReadUrl(file.storageKey, { filename: file.filename, contentType: file.mimeType, download });
    return NextResponse.redirect(url, { status: 302, headers: noStore });
  }

  const bytes = await readObject("disk", file.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...noStore,
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": contentDisposition(file.filename, download),
    },
  });
}
