import { dmyHm } from "./dates";

/** A timestamp the way the agency reads it: Israel time, day first, "30/09/2026 13:05". */
export function whenHe(d: Date | string): string {
  return dmyHm(d);
}
