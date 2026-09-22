/** A timestamp the way the agency reads it: Israel time, day first. */
export function whenHe(d: Date | string): string {
  return new Date(d).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
