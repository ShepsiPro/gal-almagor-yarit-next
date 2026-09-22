// Connect app's default webhook path is /mslahtk/webhook; the template's is
// /api/mslahtk/webhook. Same handler on both, so either configuration works.
export { POST } from "@/app/api/mslahtk/webhook/route";
export const runtime = "nodejs";
