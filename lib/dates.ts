// Dates the way the agency and its customers read them: day first, "30/09/2026".
//
// A date is STORED and POSTED as ISO ("2026-09-30"): that is what an
// <input type="date"> speaks, what sorts, and what every saved answer, signed
// link and prefill already holds. It is SHOWN as dd/mm/yyyy wherever a person
// reads one (the form itself, the back-office, the emails, the Mslahtk card),
// whatever the language or region of the browser. A native date input cannot
// promise that: it prints mm/dd/yyyy on an English phone.
//
// Pure module: no React, no Node-only API, safe on both sides.

const TZ = "Asia/Jerusalem";
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

export const DATE_PLACEHOLDER = "dd/mm/yyyy";

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A real calendar day (30 February and month 13 are not), in a sane year range. */
export function isValidIsoDate(value: string | undefined | null): boolean {
  const m = ISO.exec(String(value ?? ""));
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < YEAR_MIN || year > YEAR_MAX || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** "2026-09-30" -> "30/09/2026". Anything that is not an ISO date comes back as it was. */
export function isoToDisplay(value: string | undefined | null): string {
  const s = String(value ?? "").trim();
  const m = ISO.exec(s);
  return m && isValidIsoDate(s) ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

const DMY = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/;

/**
 * What a person typed -> ISO, or null when it is not a real date.
 * Accepts 30/09/2026, 3/9/2026, 30.9.2026, 30-09-2026, 30092026 and a pasted
 * 2026-09-30. A two-digit year is refused on purpose: "01/02/45" is 1945 for a
 * birth date and 2045 for a policy, and guessing wrong on an insurance form is
 * worse than asking for the four digits.
 */
export function displayToIso(text: string | undefined | null): string | null {
  const t = String(text ?? "").trim();
  if (ISO.test(t)) return isValidIsoDate(t) ? t : null;
  let day: string;
  let month: string;
  let year: string;
  const m = DMY.exec(t);
  if (m) {
    [, day, month, year] = m;
  } else if (/^\d{8}$/.test(t)) {
    day = t.slice(0, 2);
    month = t.slice(2, 4);
    year = t.slice(4);
  } else {
    return null;
  }
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

/**
 * What the box shows after a keystroke. Keeps digits and separators, turns
 * every separator into "/", and closes the day and the month with a slash by
 * itself once the second digit is typed and the text is growing, so "3009"
 * arrives as "30/09/". Deleting is never fought: shrinking text is left alone.
 */
export function typedDate(next: string, prev: string): string {
  const pasted = ISO.exec(next.trim());
  if (pasted && isValidIsoDate(next.trim())) return `${pasted[3]}/${pasted[2]}/${pasted[1]}`;
  let out = next
    .replace(/[^\d/.\-]/g, "")
    .replace(/[.\-]/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "")
    .slice(0, 10);
  const grew = out.length > prev.length;
  if (grew && (/^\d{2}$/.test(out) || /^\d{1,2}\/\d{2}$/.test(out))) out += "/";
  return out;
}

/** ISO date of `start` plus one year minus one day: the last day of a 12-month policy. */
export function policyEndIso(startIso: string): string {
  const m = ISO.exec(startIso);
  if (!m || !isValidIsoDate(startIso)) return "";
  const end = new Date(Date.UTC(Number(m[1]) + 1, Number(m[2]) - 1, Number(m[3]) - 1));
  return end.toISOString().slice(0, 10);
}

// ── Instants, read in Israel ────────────────────────────────────────────────

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function israelParts(value: Date | string | number) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const out: Record<string, string> = {};
  for (const p of parts.formatToParts(d)) out[p.type] = p.value;
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute };
}

/** The Israeli calendar day of an instant as ISO. `toISOString()` is UTC and is a day behind for the first three hours after midnight here. */
export function israelDayIso(value: Date | string | number = new Date()): string {
  const p = israelParts(value);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

/** "30/09/2026", read in Israel. Empty for something that is not a date. */
export function dmy(value: Date | string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const p = israelParts(value);
  return p ? `${p.day}/${p.month}/${p.year}` : "";
}

/** "30/09/2026 13:05", read in Israel. */
export function dmyHm(value: Date | string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const p = israelParts(value);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : "";
}
