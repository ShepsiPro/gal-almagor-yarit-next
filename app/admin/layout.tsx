import Link from "next/link";
import { currentAdmin } from "./session";

export const metadata = { robots: { index: false, follow: false } };
// Every page here reads a live session and live data; nothing is cacheable.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();

  // The entry route and the denied page render inside this layout too, and both
  // must stay reachable without a session — so the gate lives in each page
  // rather than here. This only draws the chrome.
  return (
    <div className="adm">
      <header className="adm__bar">
        <Link className="adm__brand" href="/admin">
          ניהול טפסים
        </Link>
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
