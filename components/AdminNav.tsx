"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon from "@/components/AdminIcon";

/**
 * The back-office menu. Client-side only for one reason: the current page is
 * marked, and a server layout does not know which page it wraps.
 *
 * Tabs are the back-office's own pages; the actions on the far side leave it
 * (Mslahtk in a new tab, the public site) or end the session.
 */
export default function AdminNav({ mslahtkUrl, who }: { mslahtkUrl: string; who: string }) {
  const path = usePathname() || "/admin";
  const onSend = path.startsWith("/admin/send");
  const tabs = [
    { href: "/admin", label: "פניות", icon: "inbox" as const, active: !onSend },
    { href: "/admin/send", label: "שליחת טופס ללקוח", icon: "send" as const, active: onSend },
  ];

  return (
    <>
      <nav className="adm__tabs" aria-label="ניווט בניהול">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={`adm__tab${tab.active ? " is-active" : ""}`} aria-current={tab.active ? "page" : undefined}>
            <AdminIcon name={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>
      <div className="adm__baractions">
        <a className="adm__action adm__action--mslahtk" href={mslahtkUrl} target="_blank" rel="noopener">
          <AdminIcon name="external" size={15} />
          <span>פתיחה במסלחתק</span>
        </a>
        <Link className="adm__action" href="/" aria-label="לאתר">
          <AdminIcon name="home" size={15} />
          <span>לאתר</span>
        </Link>
        <form action="/admin/logout" method="post" className="adm__logout">
          <button type="submit" className="adm__action" aria-label="יציאה" title={who ? `מחובר/ת: ${who}` : undefined}>
            <AdminIcon name="logout" size={15} />
            <span>יציאה</span>
          </button>
        </form>
      </div>
    </>
  );
}
