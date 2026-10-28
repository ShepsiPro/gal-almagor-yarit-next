"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminIcon from "@/components/AdminIcon";

type Person = { id: string; name: string };
type Result = { ok: true } | { ok: false; error: string };

/**
 * Whose customer this is, and who else works the file (lib/staff.ts).
 *
 * Everyone sees who has it. A file nobody has can be taken by anyone; its
 * owner, and the owner of the business, can hand it to a colleague and choose
 * who it is shared with. Each move tells the colleague on their phone.
 */
export default function FilePeople({
  fileId,
  viewerId,
  owner,
  unclaimed,
  ownerLeft,
  shares,
  sharedBy,
  canManage,
  team,
  take,
  assign,
  share,
}: {
  fileId: string;
  viewerId: string;
  owner: Person | null;
  unclaimed: boolean;
  /** Unclaimed because whoever had it is no longer on the team. */
  ownerLeft: boolean;
  shares: Person[];
  /** Who shared it with the viewer, when it is shared with them. */
  sharedBy: string | null;
  canManage: boolean;
  /** The colleagues it can go to (the viewer included). */
  team: Person[];
  take: (fileId: string) => Promise<Result>;
  assign: (fileId: string, userId: string) => Promise<Result>;
  share: (fileId: string, userIds: string[]) => Promise<Result>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "assign" | "share">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(shares.map((s) => s.id)));

  const mine = Boolean(owner && owner.id === viewerId && !unclaimed);
  const others = team.filter((p) => p.id !== owner?.id || unclaimed);
  const shareable = team.filter((p) => p.id !== owner?.id);

  async function run(fn: () => Promise<Result>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMode(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function open(next: "assign" | "share") {
    setError(null);
    setTarget("");
    setPicked(new Set(shares.map((s) => s.id)));
    setMode(mode === next ? null : next);
  }

  return (
    <section className="adm__section adm__people-card" aria-label="אחראי ושיתוף">
      <div className="adm__people-head">
        <div className="adm__people-who">
          <AdminIcon name="user" size={16} />
          {unclaimed ? (
            <span>
              <strong>ממתינה לשיוך.</strong> {ownerLeft ? "מי שטיפל/ה בה כבר לא בצוות." : "הפנייה עוד לא אצל אף אחד."}
            </span>
          ) : (
            <span>
              אחראי/ת: <strong>{mine ? `${owner?.name} (את/ה)` : owner?.name}</strong>
            </span>
          )}
        </div>
        <div className="adm__linkbar">
          {unclaimed && (
            <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={() => run(() => take(fileId))} disabled={busy}>
              לקחת לטיפול
            </button>
          )}
          {canManage && others.length > 0 && (
            <button className="adm__btn adm__btn--sm" onClick={() => open("assign")} disabled={busy} aria-expanded={mode === "assign"}>
              {unclaimed ? "שיוך לעובד/ת" : "העברה לעובד/ת אחר/ת"}
            </button>
          )}
          {canManage && !unclaimed && shareable.length > 0 && (
            <button className="adm__btn adm__btn--sm" onClick={() => open("share")} disabled={busy} aria-expanded={mode === "share"}>
              שיתוף
            </button>
          )}
        </div>
      </div>

      {shares.length > 0 ? (
        <p className="adm__muted adm__people-line">
          <AdminIcon name="users" size={14} />
          משותפת עם: {shares.map((s) => (s.id === viewerId ? `${s.name} (את/ה)` : s.name)).join(", ")}
        </p>
      ) : (
        !unclaimed && <p className="adm__muted adm__people-line">הפנייה לא שותפה עם אף אחד.</p>
      )}
      {sharedBy && <p className="adm__muted adm__people-line">{sharedBy} שיתף/ה איתך את הפנייה.</p>}

      {mode === "assign" && (
        <div className="adm__people-edit">
          <p className="adm__muted">הפנייה תעבור לרשימה של מי שתבחרו, עם התראה בטלפון.</p>
          <ul className="adm__picklist">
            {others.map((p) => (
              <li key={p.id}>
                <label className="adm__pick adm__pick--person">
                  <input type="radio" name={`assign-${fileId}`} value={p.id} checked={target === p.id} onChange={() => setTarget(p.id)} disabled={busy} />
                  <span className="adm__picklabel">{p.id === viewerId ? `${p.name} (את/ה)` : p.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="adm__linkbar">
            <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={() => run(() => assign(fileId, target))} disabled={busy || !target}>
              {busy ? "מעביר…" : unclaimed ? "שיוך" : "העברה"}
            </button>
            <button className="adm__btn adm__btn--sm" onClick={() => setMode(null)} disabled={busy}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {mode === "share" && (
        <div className="adm__people-edit">
          <p className="adm__muted">מי שתסמנו יראו את הפנייה ברשימה שלהם ויקבלו את ההתראות עליה, ומי שנוסף עכשיו יקבל על כך התראה בטלפון.</p>
          <ul className="adm__picklist">
            {shareable.map((p) => (
              <li key={p.id}>
                <label className="adm__pick adm__pick--person">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      setPicked(next);
                    }}
                    disabled={busy}
                  />
                  <span className="adm__picklabel">{p.id === viewerId ? `${p.name} (את/ה)` : p.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="adm__linkbar">
            <button className="adm__btn adm__btn--primary adm__btn--sm" onClick={() => run(() => share(fileId, [...picked]))} disabled={busy}>
              {busy ? "שומר…" : "שמירה"}
            </button>
            <button className="adm__btn adm__btn--sm" onClick={() => setMode(null)} disabled={busy}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {error && <p className="adm__err">{error}</p>}
    </section>
  );
}
