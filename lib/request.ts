/**
 * The public origin of this deployment, which is NOT what `req.url` says.
 *
 * Behind Railway's proxy the app binds 0.0.0.0:8080 and that is the authority
 * Next reports, so `new URL(path, req.url)` builds https://0.0.0.0:8080/...,
 * an address no browser can reach. The forwarded headers carry the host the
 * customer actually typed.
 */
export function publicOrigin(h: { get(name: string): string | null }, fallback = ""): string {
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  if (!host) return fallback;
  const proto = (h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}
