import { redirect } from "next/navigation";

// Answered per request, so the redirect is a real HTTP one rather than a baked page.
export const dynamic = "force-dynamic";

/**
 * The old "forms to send" page. Forms are now sent only from the back-office,
 * where the sender is signed in (so the customer's answer alerts them), and the
 * car and accident forms open only from the personal link that send produces.
 * Staff who land here go to the back-office send page, which signs them in
 * through Mslahtk first. The apartment calculator (/simulator/home) stays public.
 */
export default function FormsIndexPage() {
  redirect("/admin/send");
}
