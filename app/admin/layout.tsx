import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { dashboardProjectUrl } from "@/lib/mslahtk";
import { currentAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
// Every page here reads a live session and live data; nothing is cacheable.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();

  // The entry route, the staff entry and the denied page render inside this
  // layout too, and they must stay reachable without a session, so the gate
  // lives in each page rather than here. This only draws the chrome; the menu
  // appears once someone is signed in.
  return (
    <div className="adm">
      <header className="adm__bar">
        <Link className="adm__brand" href="/admin">
          <span className="adm__brandname">ניהול טפסים</span>
          <span className="adm__brandsub">יערית · גל אלמגור</span>
        </Link>
        {admin && <AdminNav mslahtkUrl={dashboardProjectUrl()} who={admin.email || admin.sub} />}
      </header>
      {children}
    </div>
  );
}
