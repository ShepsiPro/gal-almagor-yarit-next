import { statusLabel } from "@/lib/mslahtk";

/** The Mslahtk pipeline status as mirrored on a submission, or the "not there yet" state. */
export default function StatusChip({ leadId, status }: { leadId: string | null; status: string | null }) {
  if (!leadId) return <span className="adm__status adm__status--pending">טרם הועבר למסלחתק</span>;
  const label = statusLabel(status);
  if (!label) return null;
  const key = (status || "").toLowerCase().replace(/[^a-z_-]/g, "");
  return <span className={`adm__status adm__status--${key}`}>{label}</span>;
}
