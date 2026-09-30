// A phone number in the shapes WhatsApp and Mslahtk want. Israeli numbers are
// typed with a leading zero ("050-123-4567"); everything downstream (a wa.me
// link, Mslahtk's customer identity) wants the country code instead. Mirrors
// the normaliser on the Mslahtk side, so one person is one number in both.

const IL = "972";

/** Any reasonable input -> "+972501234567" style E.164, or "" when it is not a phone number. */
export function toE164(raw: string | null | undefined): string {
  const compact = String(raw ?? "").trim().replace(/[\s()\-.]/g, "");
  if (!compact) return "";
  let digits = compact.replace(/\D/g, "");
  if (!digits) return "";
  if (compact.startsWith("+")) {
    // "+972 050…": the trunk zero left in after the country code.
    if (digits.startsWith(`${IL}0`)) digits = `${IL}${digits.slice(IL.length).replace(/^0+/, "")}`;
    // "+0501234567": a plus pasted onto a local number.
    else if (digits.startsWith("0")) digits = `${IL}${digits.replace(/^0+/, "")}`;
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2).replace(/^0+/, "");
  } else if (digits.startsWith("0")) {
    digits = `${IL}${digits.replace(/^0+/, "")}`;
  } else if (digits.startsWith(`${IL}0`)) {
    digits = `${IL}${digits.slice(IL.length).replace(/^0+/, "")}`;
  } else if (/^5\d{8}$/.test(digits)) {
    digits = `${IL}${digits}`;
  }
  if (digits.length < 9 || digits.length > 15) return "";
  return `+${digits}`;
}

/** The digits a wa.me link wants: "972501234567". */
export function waDigits(raw: string | null | undefined): string {
  return toE164(raw).slice(1);
}

/** Same person's number, however it was typed: the last nine digits. */
export function phoneKey(raw: string | null | undefined): string {
  return toE164(raw).slice(-9);
}
