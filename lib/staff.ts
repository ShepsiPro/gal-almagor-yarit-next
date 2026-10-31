// Who is who at the agency, and which customer files each of them sees.
//
// Every customer's file has an owner (Submission.ownerId, a Mslahtk user id):
// the employee who sent the customer the form, or who took, worked or was
// given the file. Each employee works their own section: the files they own
// and the ones a colleague shared with them. A request that came in from the
// site by itself has no owner yet, and neither has a file whose owner left the
// team; everyone sees those ("waiting for someone") until one of them takes
// it. The owner of the business, and a Mslahtk operator helping them, see
// every file and can hand any of them to anyone.
//
// Who is the owner and who is an employee comes from Mslahtk, signed into the
// launch token (`role`). Names, and the list of colleagues a file can go to,
// come from Mslahtk's team route, kept here as StaffMember rows so a slow or
// absent Mslahtk never blanks a screen. A session from before Mslahtk sent
// the role sees every file, exactly as before this existed: the sections and
// sharing work for it, nothing is hidden from it.
//
// The rules are plain functions over plain rows (tested in tests/staff.test.ts);
// the database and Mslahtk calls sit below them. Server-only.

import type { Prisma } from "@prisma/client";
import type { AdminIdentity } from "./admin-auth";
import { db } from "./db";
import { fetchTeam, mslahtkConfigured, notifyBusiness, setLeadAssignee, type LeadOpResult } from "./mslahtk";

// ── Who is looking ──────────────────────────────────────────────────────────

export type Viewer = {
  /** Mslahtk user id; "" when the token carried none. */
  id: string;
  email?: string;
  /** Sees every file and can hand any of them over: the business owner, a Mslahtk operator. */
  seesAll: boolean;
};

/** The launch-token roles that see every file. An employee is "member". */
const SEES_ALL_ROLES = new Set(["owner", "admin", "broker"]);

export function viewerOf(admin: Pick<AdminIdentity, "sub" | "email" | "role">): Viewer {
  const id = admin.sub && admin.sub !== "unknown" ? admin.sub : "";
  // No role: a session (or a Mslahtk) from before roles. It sees what everyone saw then: everything.
  return { id, email: admin.email, seesAll: !admin.role || SEES_ALL_ROLES.has(admin.role) };
}

// ── The team ────────────────────────────────────────────────────────────────

export type Person = {
  id: string;
  name: string | null;
  email: string | null;
  /** "owner" | "staff" | "admin" | "unknown" (see StaffMember.role). */
  role: string;
  active: boolean;
  /** Mslahtk's team route has listed them (not only seen signing in). */
  listed: boolean;
};

export type Team = {
  /** Mslahtk has listed the team at least once. Until then nobody counts as gone. */
  known: boolean;
  people: Person[];
  byId: Map<string, Person>;
  /** Who is on the team now (known teams only): an owner outside it has left. */
  activeIds: string[];
};

export function teamFrom(rows: Array<{ id: string; name: string | null; email: string | null; role: string; active: boolean; syncedAt: Date | null }>): Team {
  const people: Person[] = rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, active: r.active, listed: r.syncedAt !== null }));
  const known = people.some((p) => p.listed);
  return {
    known,
    people,
    byId: new Map(people.map((p) => [p.id, p])),
    activeIds: known ? people.filter((p) => p.listed && p.active).map((p) => p.id) : [],
  };
}

/** What to call someone on screen: their name, else their email, else a neutral word. */
export function nameOf(team: Team, id: string | null | undefined): string {
  if (!id) return "";
  const p = team.byId.get(id);
  return p?.name || p?.email || "עובד/ת";
}

/**
 * Who a file can be handed to or shared with: the people Mslahtk lists as on
 * the team (the owner first), or, before it has listed anyone, whoever signed
 * in here. A Mslahtk operator is never one of them.
 */
export function colleagues(team: Team): Person[] {
  const pool = team.known ? team.people.filter((p) => p.listed && p.active) : team.people.filter((p) => p.role !== "admin");
  return [...pool].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || (a.name || a.email || "").localeCompare(b.name || b.email || "", "he"));
}

// ── Which files ─────────────────────────────────────────────────────────────

export type FileRef = { ownerId: string | null; shares?: Array<{ userId: string }> };

/** Nobody has it: never taken, or its owner is no longer on the team. */
export function isUnclaimed(file: FileRef, team: Pick<Team, "known" | "activeIds">): boolean {
  if (!file.ownerId) return true;
  return team.known && !team.activeIds.includes(file.ownerId);
}

export function isSharedWith(file: FileRef, viewer: Viewer): boolean {
  return Boolean(viewer.id) && (file.shares ?? []).some((s) => s.userId === viewer.id);
}

/** May look at it and work it: everything for the owner of the business; for an employee, their own, shared and unclaimed files. */
export function canSee(viewer: Viewer, file: FileRef, team: Pick<Team, "known" | "activeIds">): boolean {
  if (viewer.seesAll) return true;
  if (viewer.id && file.ownerId === viewer.id) return true;
  return isSharedWith(file, viewer) || isUnclaimed(file, team);
}

/** May hand it to someone else and choose who it is shared with: its owner, and whoever sees everything. */
export function canManage(viewer: Viewer, file: FileRef): boolean {
  return viewer.seesAll || (Boolean(viewer.id) && file.ownerId === viewer.id);
}

export type Section = "mine" | "open" | "all";

export const SECTION_LABEL: Record<Section, string> = {
  mine: "שלי",
  open: "ממתינות לשיוך",
  all: "כל הפניות",
};

/** The section a viewer lands on, and the ones they may open. */
export function sectionsFor(viewer: Viewer): { initial: Section; allowed: Section[] } {
  return viewer.seesAll ? { initial: "all", allowed: ["all", "mine", "open"] } : { initial: "mine", allowed: ["mine", "open"] };
}

function unclaimedWhere(team: Pick<Team, "known" | "activeIds">): Prisma.SubmissionWhereInput {
  // SQL's NOT IN never matches a null, so "never taken" needs its own branch.
  return { OR: [{ ownerId: null }, ...(team.known ? [{ ownerId: { notIn: team.activeIds } }] : [])] };
}

/**
 * The list query for a section: always one row per case (top level), and for
 * "all" optionally one person's files (`who`, or "open" for the unclaimed).
 * A section the viewer may not open falls back to their own.
 */
export function sectionWhere(section: Section, viewer: Viewer, team: Pick<Team, "known" | "activeIds">, who?: string): Prisma.SubmissionWhereInput {
  const top: Prisma.SubmissionWhereInput = { parentId: null };
  if (section === "open") return { ...top, ...unclaimedWhere(team) };
  if (section === "all" && viewer.seesAll) {
    if (who === "open") return { ...top, ...unclaimedWhere(team) };
    return who ? { ...top, ownerId: who } : top;
  }
  if (!viewer.id) return { ...top, id: "__nobody__" };
  return { ...top, OR: [{ ownerId: viewer.id }, { shares: { some: { userId: viewer.id } } }] };
}

/** The short line a list row shows about whose file it is, from where the viewer stands. */
export function ownerLine(file: FileRef, viewer: Viewer, team: Team): { text: string; kind: "mine" | "shared" | "open" | "theirs" } {
  if (isUnclaimed(file, team)) return { text: "ממתינה לשיוך", kind: "open" };
  const shares = file.shares ?? [];
  const sharedWith = shares.length === 1 ? nameOf(team, shares[0].userId) : `${shares.length} עמיתים`;
  if (viewer.id && file.ownerId === viewer.id) return { text: shares.length ? `שלך · משותפת עם ${sharedWith}` : "שלך", kind: "mine" };
  if (isSharedWith(file, viewer)) return { text: `משותפת איתך · אצל ${nameOf(team, file.ownerId)}`, kind: "shared" };
  return { text: `אצל ${nameOf(team, file.ownerId)}${shares.length ? ` · משותפת עם ${sharedWith}` : ""}`, kind: "theirs" };
}

// ── Who hears about it ──────────────────────────────────────────────────────

/**
 * Who is told when a customer does something on a file: its owner, the
 * colleagues it is shared with (`withShares`), and `also` (whoever sent the
 * link), each once. An email on record (older rows) is matched to the person.
 * Someone Mslahtk no longer lists is left out: Mslahtk would hand their alert to
 * the owner of the business, a second copy of news they already get.
 */
export function alertRecipients(file: FileRef, opts: { withShares: boolean; also?: Array<string | null | undefined>; team: Team }): string[] {
  const { team } = opts;
  const raw = [file.ownerId, ...(opts.withShares ? (file.shares ?? []).map((s) => s.userId) : []), ...(opts.also ?? [])];
  const out: string[] = [];
  for (const value of raw) {
    let id = (value ?? "").trim();
    if (!id || id === "unknown") continue;
    if (id.includes("@")) id = team.people.find((p) => p.email && p.email.toLowerCase() === id.toLowerCase())?.id ?? id;
    if (team.known && !id.includes("@") && !team.activeIds.includes(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export type FileAlert = { title: string; body: string; to: string; leadId?: string };

/** A file's owner and the colleagues it is shared with (nobody, when it is gone). */
export async function filePeople(fileId: string): Promise<FileRef> {
  const row = await db.submission
    .findUnique({ where: { id: fileId }, select: { ownerId: true, shares: { select: { userId: true } } } })
    .catch(() => null);
  return row ?? { ownerId: null, shares: [] };
}

/**
 * Tell the people on a file, through Mslahtk, on their phones. With nobody on it
 * the owner of the business hears, as before. `ownerCard` puts it on the owner's
 * Live Activity once, when the owner is not among those told. Never throws.
 */
export async function alertFile(
  file: FileRef,
  alert: FileAlert,
  opts: { withShares: boolean; also?: Array<string | null | undefined>; ownerCard?: boolean; team?: Team },
): Promise<{ told: number; failed: number; error?: string; skipped?: boolean }> {
  const team = opts.team ?? (await loadTeam());
  const recipients = alertRecipients(file, { withShares: opts.withShares, also: opts.also, team });
  const out = { told: 0, failed: 0, error: undefined as string | undefined, skipped: undefined as boolean | undefined };
  const record = (res: LeadOpResult) => {
    if (res.ok) out.told += 1;
    else if (res.skipped) out.skipped = true;
    else {
      out.failed += 1;
      out.error ??= res.error;
    }
  };
  if (!recipients.length) {
    record(await notifyBusiness(alert));
    return out;
  }
  const ownerTold = recipients.some((id) => team.byId.get(id)?.role === "owner");
  let card = Boolean(opts.ownerCard) && !ownerTold;
  for (const recipient of recipients) {
    record(await notifyBusiness({ ...alert, recipient, ...(card ? { ownerCard: true } : {}) }));
    card = false;
  }
  return out;
}

/**
 * Tell one colleague something only they need to know ("a file was shared with
 * you"). Only someone Mslahtk lists as on the team: anyone else's alert would
 * land on the owner of the business instead, which is the wrong person.
 */
export async function alertColleague(id: string, alert: FileAlert, team: Team): Promise<void> {
  const p = team.byId.get(id);
  if (!team.known || !p?.listed || !p.active) return;
  const res = await notifyBusiness({ ...alert, recipient: id });
  if (!res.ok && !res.skipped) console.error("[staff] colleague alert failed", { error: res.error });
}

// ── The team, kept in step with Mslahtk ────────────────────────────────────

const SYNC_EVERY_MS = 10 * 60_000;
/** A Mslahtk without the team route (404): ask again an hour later, not on every page. */
const RETRY_MISSING_MS = 60 * 60_000;
/** The first ever list is worth a short wait; after that a stale one never holds a page. */
const FIRST_SYNC_WAIT_MS = 2500;

let lastSyncAt = 0;
let missingUntil = 0;
let inFlight: Promise<boolean> | null = null;

/**
 * Bring StaffMember in line with Mslahtk's team list: everyone listed is
 * upserted as active with their name and role; anyone listed before and not
 * now is marked inactive (their open files return to everyone). An empty or
 * failed answer changes nothing. Throttled, one at a time, never throws.
 */
export async function syncTeam(opts: { force?: boolean } = {}): Promise<boolean> {
  if (!mslahtkConfigured()) return false;
  const now = Date.now();
  if (!opts.force && (now - lastSyncAt < SYNC_EVERY_MS || now < missingUntil)) return false;
  if (inFlight) return inFlight;
  lastSyncAt = now;
  inFlight = (async () => {
    try {
      const res = await fetchTeam();
      if (!res.ok) {
        if (res.status === 404) missingUntil = Date.now() + RETRY_MISSING_MS;
        else if (!res.skipped) console.error("[staff] team sync failed", { error: res.error });
        return false;
      }
      if (!res.people.length) return false;
      const at = new Date();
      const ids = res.people.map((p) => p.userId);
      await db.$transaction([
        ...res.people.map((p) =>
          db.staffMember.upsert({
            where: { id: p.userId },
            create: { id: p.userId, name: p.name, email: p.email, role: p.role, active: true, syncedAt: at },
            update: { name: p.name, email: p.email, role: p.role, active: true, syncedAt: at },
          }),
        ),
        db.staffMember.updateMany({ where: { syncedAt: { not: null }, id: { notIn: ids } }, data: { active: false } }),
      ]);
      // A form sent before the sender's id was kept (only their email is on
      // record) belongs to the person with that email, now that it has a name.
      for (const p of res.people) {
        if (!p.email) continue;
        await db.$executeRaw`UPDATE "Submission" SET "ownerId" = ${p.userId}
          WHERE "ownerId" IS NULL AND "parentId" IS NULL AND jsonb_typeof("source") = 'object'
            AND COALESCE("source"->>'agencyId', '') = '' AND lower("source"->>'agency') = ${p.email.toLowerCase()}`;
      }
      return true;
    } catch (err) {
      console.error("[staff] team sync failed", { error: err instanceof Error ? err.message : String(err) });
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** The team as last known, nudging a sync on the way (waited for only the first time). */
export async function loadTeam(): Promise<Team> {
  const read = () =>
    db.staffMember.findMany({ select: { id: true, name: true, email: true, role: true, active: true, syncedAt: true } }).catch(() => []);
  let rows = await read();
  if (!rows.some((r) => r.syncedAt !== null)) {
    const synced = await Promise.race([syncTeam(), new Promise<boolean>((r) => setTimeout(() => r(false), FIRST_SYNC_WAIT_MS))]);
    if (synced) rows = await read();
  } else {
    void syncTeam();
  }
  return teamFrom(rows);
}

/** The launch-token role, as a StaffMember role. */
function staffRoleOf(role: string | undefined): string {
  if (role === "owner") return "owner";
  if (role === "member" || role === "partner") return "staff";
  if (role === "admin" || role === "broker") return "admin";
  return "unknown";
}

/**
 * Someone came in through Mslahtk: remember them, so a colleague can share a
 * file with them even before Mslahtk's list is here, and refresh that list.
 * Never throws.
 */
export async function noteSignIn(admin: AdminIdentity): Promise<void> {
  const id = admin.sub && admin.sub !== "unknown" ? admin.sub : "";
  if (!id) return;
  try {
    const now = new Date();
    const existing = await db.staffMember.findUnique({ where: { id }, select: { syncedAt: true, email: true } });
    if (!existing) {
      await db.staffMember.create({ data: { id, email: admin.email ?? null, role: staffRoleOf(admin.role), lastSeenAt: now } });
    } else {
      // Mslahtk's list has the last word on someone it lists; the token only fills in the rest.
      await db.staffMember.update({
        where: { id },
        data: { lastSeenAt: now, ...(existing.syncedAt ? {} : { role: staffRoleOf(admin.role), ...(admin.email ? { email: admin.email } : {}) }) },
      });
    }
  } catch (err) {
    console.error("[staff] could not note the sign-in", { error: err instanceof Error ? err.message : String(err) });
  }
  void syncTeam({ force: true });
}

// ── A file and the person looking at it ─────────────────────────────────────

export type FileAccess = {
  viewer: Viewer;
  team: Team;
  /** The case (or the standalone file) that ownership lives on. */
  root: { id: string; ownerId: string | null; shares: Array<{ userId: string; sharedBy: string | null }>; name: string | null; formTitle: string; mslahtkLeadId: string | null };
  see: boolean;
  manage: boolean;
  unclaimed: boolean;
};

/**
 * Where a row's ownership lives (its case, for an offer or an answer) and what
 * this person may do with it. Null when the row does not exist.
 */
export async function accessTo(admin: AdminIdentity, row: { id: string; parentId: string | null }, team?: Team): Promise<FileAccess | null> {
  const t = team ?? (await loadTeam());
  const viewer = viewerOf(admin);
  const root = await db.submission.findUnique({
    where: { id: row.parentId ?? row.id },
    select: { id: true, ownerId: true, name: true, formTitle: true, mslahtkLeadId: true, shares: { select: { userId: true, sharedBy: true } } },
  });
  if (!root) return null;
  return { viewer, team: t, root, see: canSee(viewer, root, t), manage: canManage(viewer, root), unclaimed: isUnclaimed(root, t) };
}

/** accessTo by id, for the server actions: null when there is no such row. */
export async function accessToId(admin: AdminIdentity, id: string, team?: Team): Promise<FileAccess | null> {
  if (!id) return null;
  const row = await db.submission.findUnique({ where: { id }, select: { id: true, parentId: true } }).catch(() => null);
  return row ? accessTo(admin, row, team) : null;
}

/** The words for someone who opened a file that is not theirs. */
export function notYoursMessage(access: FileAccess): string {
  const owner = nameOf(access.team, access.root.ownerId);
  return owner ? `הפנייה הזו אצל ${owner}. אפשר לבקש ממנו/ממנה לשתף אותה איתך.` : "אין לך גישה לפנייה הזו.";
}

// ── Taking, handing over, sharing ───────────────────────────────────────────

/**
 * Someone works a file nobody has (sends the customer a form, saves an offer,
 * sends the answer link): it becomes theirs. Atomic, so two people taking the
 * same file at once leaves it with the first. True when it was taken now.
 */
export async function claimIfUnclaimed(fileId: string, viewer: Viewer, team?: Team): Promise<boolean> {
  if (!viewer.id) return false;
  const t = team ?? (await loadTeam());
  const res = await db.submission
    .updateMany({ where: { id: fileId, parentId: null, ...unclaimedWhere(t) }, data: { ownerId: viewer.id } })
    .catch(() => ({ count: 0 }));
  if (res.count === 1) void pushLeadOwner(fileId);
  return res.count === 1;
}

/** Share a file with these people (its owner and blanks skipped, repeats ignored). Never throws. */
export async function addShares(fileId: string, ids: Array<string | null | undefined>, ownerId: string | null, sharedBy: string | null): Promise<void> {
  const userIds = [...new Set(ids.map((v) => (v ?? "").trim()).filter((v) => v && v !== "unknown" && v !== ownerId))];
  if (!userIds.length) return;
  await db.submissionShare
    .createMany({ data: userIds.map((userId) => ({ submissionId: fileId, userId, sharedBy })), skipDuplicates: true })
    .catch((err) => console.error("[staff] could not share the file", { fileId, error: err instanceof Error ? err.message : String(err) }));
}

/**
 * Someone who is not its owner worked a file (an employee sent the same
 * customer the same form again): it is shared with them, so it stays in their
 * section and its news reaches them. The owner of the business sees it anyway.
 */
export async function joinFile(fileId: string, viewer: Viewer, ownerId: string | null): Promise<void> {
  if (!viewer.id || viewer.seesAll || !ownerId || ownerId === viewer.id) return;
  await db.submissionShare
    .upsert({
      where: { submissionId_userId: { submissionId: fileId, userId: viewer.id } },
      create: { submissionId: fileId, userId: viewer.id, sharedBy: viewer.id },
      update: {},
    })
    .catch((err) => console.error("[staff] could not share the file", { fileId, error: err instanceof Error ? err.message : String(err) }));
}

// ── Whose lead it is in Mslahtk ─────────────────────────────────────────────
//
// Mslahtk can limit an employee to their own leads (and the unassigned ones),
// by each lead's assignee. A file's owner here is sent there as the assignee
// of its lead, so Mslahtk's Leads page shows each employee the files their
// section here shows, and no colleague's. Only CHANGES are sent: a file
// remembers which owner its lead was last brought in line with
// (Submission.mslahtkOwnerSynced, "" for nobody), so an assignment the owner
// of the business makes in Mslahtk stands until the file changes hands here.

export type LeadOwnerChange = { leadId: string; send: false; mark: string } | { leadId: string; send: true; assignee: string | null; mark: string };

/** What a file's lead needs, or null when it already has it (or there is no lead). */
export function leadOwnerChange(row: { ownerId: string | null; mslahtkLeadId: string | null; mslahtkOwnerSynced: string | null }): LeadOwnerChange | null {
  if (!row.mslahtkLeadId) return null;
  const mark = row.ownerId ?? "";
  if (row.mslahtkOwnerSynced === mark) return null;
  // Nobody has it and it was never sent: a lead starts out unassigned, so
  // there is nothing to tell Mslahtk (and nothing of the owner's to undo).
  if (!mark && row.mslahtkOwnerSynced === null) return { leadId: row.mslahtkLeadId, send: false, mark };
  return { leadId: row.mslahtkLeadId, send: true, assignee: row.ownerId, mark };
}

/** A Mslahtk from before the assignee field: ask again an hour later, not on every hand-over. */
const ASSIGN_RETRY_UNSUPPORTED_MS = 60 * 60_000;
let assignUnsupportedUntil = 0;

/**
 * Send a file's owner to its Mslahtk lead as the assignee, when it changed.
 * An owner Mslahtk does not count as on the team (they left, or never had the
 * leads area) is sent as nobody: the lead goes back with the unassigned, the
 * same as the file here. Never throws.
 */
export async function pushLeadOwner(fileId: string): Promise<"sent" | "noted" | "skipped" | "failed"> {
  if (!mslahtkConfigured() || !fileId) return "skipped";
  try {
    const row = await db.submission.findUnique({
      where: { id: fileId },
      select: { id: true, parentId: true, ownerId: true, mslahtkLeadId: true, mslahtkOwnerSynced: true },
    });
    if (!row || row.parentId) return "skipped";
    const change = leadOwnerChange(row);
    if (!change) return "skipped";
    if (change.send) {
      if (Date.now() < assignUnsupportedUntil) return "skipped";
      let res = await setLeadAssignee(change.leadId, change.assignee);
      if (!res.ok && res.code === "assignee_not_on_team" && change.assignee) res = await setLeadAssignee(change.leadId, null);
      if (!res.ok) {
        if (res.unsupported) {
          assignUnsupportedUntil = Date.now() + ASSIGN_RETRY_UNSUPPORTED_MS;
          return "skipped";
        }
        // A lead Mslahtk no longer has is not worth asking about again.
        if (res.status !== 404) {
          if (!res.skipped) console.error("[staff] could not set the lead's assignee in Mslahtk", { fileId, status: res.status, error: res.error });
          return res.skipped ? "skipped" : "failed";
        }
      }
    }
    // Only while the file still has that owner: a hand-over in between is sent next time.
    await db.submission.updateMany({ where: { id: row.id, ownerId: row.ownerId }, data: { mslahtkOwnerSynced: change.mark } });
    return change.send ? "sent" : "noted";
  } catch (err) {
    console.error("[staff] could not set the lead's assignee in Mslahtk", { fileId, error: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
}

const OWNER_SYNC_EVERY_MS = 5 * 60_000;
const OWNER_SYNC_BATCH = 100;
let ownerSyncAt = 0;
let ownerSyncInFlight: Promise<{ sent: number; noted: number; failed: number }> | null = null;

/**
 * Bring the files' leads in line with their owners, a batch at a time: files
 * owned before this existed, a hand-over whose call failed, a lead the sweep
 * linked late, a file the team list gave its owner. Throttled (it runs on
 * back-office visits), one run at a time, never throws.
 */
export async function syncLeadOwners(opts: { force?: boolean } = {}): Promise<{ sent: number; noted: number; failed: number }> {
  const none = { sent: 0, noted: 0, failed: 0 };
  if (!mslahtkConfigured()) return none;
  const now = Date.now();
  if (!opts.force && (now - ownerSyncAt < OWNER_SYNC_EVERY_MS || now < assignUnsupportedUntil)) return none;
  if (ownerSyncInFlight) return ownerSyncInFlight;
  ownerSyncAt = now;
  ownerSyncInFlight = (async () => {
    const out = { ...none };
    try {
      const rows = await db.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Submission"
        WHERE "parentId" IS NULL AND "mslahtkLeadId" IS NOT NULL
          AND ("mslahtkOwnerSynced" IS NULL OR "mslahtkOwnerSynced" <> COALESCE("ownerId", ''))
        ORDER BY "updatedAt" DESC LIMIT ${OWNER_SYNC_BATCH}`;
      for (const r of rows) {
        const res = await pushLeadOwner(r.id);
        if (res === "sent") out.sent += 1;
        else if (res === "noted") out.noted += 1;
        else if (res === "failed") out.failed += 1;
        if (Date.now() < assignUnsupportedUntil) break;
      }
    } catch (err) {
      console.error("[staff] lead owner sync failed", { error: err instanceof Error ? err.message : String(err) });
    } finally {
      ownerSyncInFlight = null;
    }
    return out;
  })();
  return ownerSyncInFlight;
}
