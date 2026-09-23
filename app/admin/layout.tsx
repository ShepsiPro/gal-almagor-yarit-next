import Link from "next/link";
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
        <div className="adm__barstart">
          <Link className="adm__brand" href="/admin">
            ניהול טפסים
          </Link>
          {admin && (
            <nav className="adm__nav" aria-label="ניווט בניהול">
              <Link className="adm__navlink" href="/admin">
                טפסים שהתקבלו
              </Link>
              <Link className="adm__navlink" href="/forms">
                טפסים לשליחה ללקוח
              </Link>
              <a className="adm__navlink" href={dashboardProjectUrl()} target="_blank" rel="noopener">
                פתיחה במסלחתק
              </a>
              <Link className="adm__navlink" href="/">
                לאתר
              </Link>
            </nav>
          )}
        </div>
        {admin && (
          <span className="adm__who" title={admin.sub}>
            {admin.email || admin.sub}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
