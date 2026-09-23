import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, readSession } from "@/lib/admin-auth";

/**
 * The signed-in admin, or null.
 *
 * Its own module because a layout.tsx may only export the names Next.js knows
 * (`default`, `metadata`, `dynamic`, …) — anything else fails the build.
 */
export async function currentAdmin() {
  const jar = await cookies();
  return readSession(jar.get(ADMIN_COOKIE)?.value);
}

/**
 * The signed-in admin, or a trip through the staff entry (/admin/login, which
 * signs in through Mslahtk) that lands back on `path`. So a bookmark or an
 * emailed link to a back-office page works in one click instead of a 404.
 */
export async function requireAdmin(path: string) {
  const admin = await currentAdmin();
  if (!admin) redirect(`/admin/login?to=${encodeURIComponent(path)}`);
  return admin;
}
