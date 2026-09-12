import { cookies } from "next/headers";
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
