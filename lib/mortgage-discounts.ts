// The insurers' discounts on a new life policy ("הטבות"), from the files each
// company sends the agency, and the rule for using them: one discount per policy
// ("ללא כפל הטבות"), only for a policy that joins inside the promotion's dates,
// only when its conditions hold, and per company the one that gives the
// customer the lowest price.
//
// The files (sent by the owner, 2026-11-06), and what is used from each:
//  - Harel, "הטבות בביטוח חיים משכנתא", new joiners 11.10.2026 to 30.11.2026:
//    the regular tracks, by minimum premium, each needing 15 years of cover. Its
//    "מסלולי הנחה מיוחדים בהפחתת עמלות" are left out: giving up commission is the
//    agency's call per customer (owner, 2026-11-06).
//  - Harel, "הטבות בכיסויי ביטוח חיים", same dates: the מגן 1 table, the tariff
//    Harel is priced with here. Left out: ריסק For Life (another product), the
//    riders (חוסן למחר פלוס, מגן משלים לילד, נכות ומוות מתאונה) and מגן זוגי (two
//    people on one policy).
//  - Migdal, "הנחות נובמבר 2026": the ריסק משכנתא tracks and the ריסק אור 1
//    tables (the base rates Migdal is priced with). Left out: the ACTIVE tracks
//    (they need a private risk policy alongside), הכנסה למשפחה, מוות מתאונה,
//    נקודת אור and ריסק max, which are other products.
//  - Menora, "ההטבות הכי משתלמות לסוף השנה", 15.10.2026 to 31.12.2026: the ריסק
//    פרט packages (Menora is priced with ריסק 1). Left out: the critical illness
//    bundle 101677, which needs a second policy.
// The owner's reading (2026-11-06): all of these are what the agency sells for a
// mortgage, so a quote may use any of them.
//
// Read as the files print them: a minimum premium is the monthly premium BEFORE
// the discount, an age is the insurance age the cards are read at, a sum is the
// sum insured (the mortgage balance), and years of cover are the years left on
// the mortgage, which the form asks. Year 1's discount sets the price; free
// months come on top and are listed for the agency.
//
// New files mean new numbers here and a run of the tests, which pin the tracks
// against the files. Once a promotion's last day passes it stops applying, and
// with none left the prices are the cards' base rates again.
//
// Pure module: no React, no Node-only API, safe on both sides.

import type { CompanyKey } from "./mortgage-quote";
import { isoToDisplay } from "./dates";

export type DiscountTrack = {
  /** Ours, stable: the agreement or package number when the file prints one. */
  id: string;
  /** How the agency finds the row in the file. */
  label: string;
  /** The discount in each policy year, in percent: [year 1, year 2, ...]. */
  years: readonly number[];
  /** What the file promises further on, printed beside the row. */
  later?: string;
  /** Months free at the start of the policy. */
  freeMonths?: number;
  /** The monthly premium before the discount must be at least this many ₪. */
  minPremium?: number;
  /** The cover must run at least this many years. */
  minYears?: number;
  /** Insurance age, inclusive. */
  minAge?: number;
  maxAge?: number;
  /** Sum insured in ₪, inclusive. */
  minSum?: number;
  maxSum?: number;
};

export type Promotion = {
  company: CompanyKey;
  /** The file's title. */
  title: string;
  /** The first and the last day a new policy may join under it, inclusive (Israel), ISO. */
  from: string;
  to: string;
  /** What the agency has to do to get it. */
  note?: string;
  tracks: readonly DiscountTrack[];
};

const HAREL_DATES = { from: "2026-10-11", to: "2026-11-30" } as const;
const HAREL_NOTE = "ההטבה אינה אוטומטית: לסמן את המסלול בדף ההטבות ולצרף אותו לטופס ההצעה";
const MIGDAL_DATES = { from: "2026-11-01", to: "2026-11-30" } as const;
/** Menora's first five ריסק פרט packages share these conditions. */
const MENORA_TOP = { minAge: 30, maxAge: 60, minPremium: 170, maxSum: 4_000_000 } as const;

/** Six years at one discount, and eight. */
const six = (pct: number) => [pct, pct, pct, pct, pct, pct];
const eight = (pct: number) => [...six(pct), pct, pct];

export const PROMOTIONS: readonly Promotion[] = [
  {
    company: "harel",
    title: "הראל, הטבות בביטוח חיים משכנתא",
    ...HAREL_DATES,
    note: HAREL_NOTE,
    tracks: [
      { id: "harel-mortgage-0", label: "משכנתא, ללא פרמיית מינימום", minYears: 15, years: [30, 15, 15, 15, 15, 15] },
      { id: "harel-mortgage-60a", label: "משכנתא, פרמיית מינימום 60 ₪", minPremium: 60, minYears: 15, years: [45, 30, 30, 20, 20, 20] },
      { id: "harel-mortgage-60b", label: "משכנתא, פרמיית מינימום 60 ₪", minPremium: 60, minYears: 15, years: [30, 30, 30, 30, 20, 20] },
      { id: "harel-mortgage-100a", label: "משכנתא, פרמיית מינימום 100 ₪", minPremium: 100, minYears: 15, years: [60, 60, 40, 30, 30, 30] },
      { id: "harel-mortgage-100b", label: "משכנתא, פרמיית מינימום 100 ₪", minPremium: 100, minYears: 15, years: [65, 50, 40, 30, 30, 30] },
      { id: "harel-mortgage-140a", label: "משכנתא, פרמיית מינימום 140 ₪", minPremium: 140, minYears: 15, years: [65, 65, 55, 45, 35, 35] },
      { id: "harel-mortgage-140b", label: "משכנתא, פרמיית מינימום 140 ₪", minPremium: 140, minYears: 15, years: [70, 60, 50, 35, 35, 35] },
      { id: "harel-mortgage-200a", label: "משכנתא, פרמיית מינימום 200 ₪", minPremium: 200, minYears: 15, years: [65, 65, 65, 50, 35, 35] },
      { id: "harel-mortgage-200b", label: "משכנתא, פרמיית מינימום 200 ₪", minPremium: 200, minYears: 15, years: [70, 70, 55, 45, 35, 35] },
    ],
  },
  {
    company: "harel",
    title: "הראל, הטבות בכיסויי ביטוח חיים (מגן 1)",
    ...HAREL_DATES,
    note: HAREL_NOTE,
    tracks: [
      { id: "harel-magen-60a", label: "מגן 1, פרמיית מינימום 60 ₪", minPremium: 60, years: [60, 50, 35, 35, 15, 15] },
      { id: "harel-magen-60b", label: "מגן 1, פרמיית מינימום 60 ₪", minPremium: 60, years: [55, 45, 35, 15, 15, 15] },
      { id: "harel-magen-125a", label: "מגן 1, פרמיית מינימום 125 ₪", minPremium: 125, years: [65, 65, 55, 40, 30, 30] },
      { id: "harel-magen-125b", label: "מגן 1, פרמיית מינימום 125 ₪", minPremium: 125, years: [70, 60, 50, 30, 30, 30] },
      { id: "harel-magen-175a", label: "מגן 1, פרמיית מינימום 175 ₪", minPremium: 175, years: [70, 70, 60, 50, 35, 35, 35] },
      { id: "harel-magen-175b", label: "מגן 1, פרמיית מינימום 175 ₪", minPremium: 175, years: [65, 65, 65, 65, 50, 40] },
      { id: "harel-magen-175c", label: "מגן 1, פרמיית מינימום 175 ₪", minPremium: 175, years: [70, 80, 70, 40, 40, 40] },
      { id: "harel-magen-250a", label: "מגן 1, פרמיית מינימום 250 ₪", minPremium: 250, years: [70, 70, 80, 60, 40, 40] },
      { id: "harel-magen-250b", label: "מגן 1, פרמיית מינימום 250 ₪", minPremium: 250, years: [70, 80, 70, 45, 45, 45] },
      { id: "harel-magen-250c", label: "מגן 1, פרמיית מינימום 250 ₪", minPremium: 250, years: [65, 65, 65, 65, 65, 50, 35] },
    ],
  },
  {
    company: "migdal",
    title: "מגדל, הנחות נובמבר 2026: משכנתא",
    ...MIGDAL_DATES,
    tracks: [
      { id: "migdal-company", label: "ריסק משכנתא, הסכם חברה", years: six(20), later: "25% מהשנה ה-20 ואילך" },
      { id: "18536", label: "הסכם 18536, ריסק משכנתא עד גיל 69", maxAge: 69, years: eight(30) },
      { id: "18538", label: "הסכם 18538, ריסק משכנתא עד גיל 69", maxAge: 69, years: eight(30), freeMonths: 2 },
      { id: "18537", label: "הסכם 18537, ריסק משכנתא עד גיל 69", maxAge: 69, years: eight(30), freeMonths: 3 },
      { id: "19154", label: "הסכם 19154, ריסק משכנתא עד גיל 69", maxAge: 69, years: [50, 35, 20, 20, 20, 20], later: "55% מהשנה ה-15 ואילך" },
      { id: "19155", label: "הסכם 19155, ריסק משכנתא עד גיל 69", maxAge: 69, years: [50, 35, 20, 20, 20, 20], later: "55% מהשנה ה-15 ואילך", freeMonths: 3 },
      { id: "21174", label: "הסכם 21174, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 15 שנים", maxAge: 69, minYears: 15, years: [60, 45, 35, 25, 25, 25], later: "60% לאחר 20 שנות ביטוח" },
      { id: "21175", label: "הסכם 21175, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 15 שנים", maxAge: 69, minYears: 15, years: [60, 45, 35, 25, 25, 25], freeMonths: 1 },
      { id: "21176", label: "הסכם 21176, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 15 שנים", maxAge: 69, minYears: 15, years: [60, 45, 35, 25, 25, 25], freeMonths: 2 },
      { id: "21177", label: "הסכם 21177, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 25 שנים", maxAge: 69, minYears: 25, years: [65, 50, 40, 30, 30, 30], later: "65% לאחר 20 שנות ביטוח" },
      { id: "21178", label: "הסכם 21178, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 25 שנים", maxAge: 69, minYears: 25, years: [65, 50, 40, 30, 30, 30], freeMonths: 1 },
      { id: "21179", label: "הסכם 21179, ריסק משכנתא עד גיל 69, תקופת ביטוח מינימלית 25 שנים", maxAge: 69, minYears: 25, years: [65, 50, 40, 30, 30, 30], freeMonths: 2 },
    ],
  },
  {
    company: "migdal",
    title: "מגדל, הנחות נובמבר 2026: ריסק אור 1",
    ...MIGDAL_DATES,
    tracks: [
      // הנחות מדורגות, by sum insured and age; each with and without a free first month.
      { id: "21527", label: "הסכם 21527, הנחות מדורגות, סכום ביטוח עד מיליון ₪, עד גיל 39", maxSum: 1_000_000, maxAge: 39, years: [45, 35, 30, 15, 15, 15] },
      { id: "21533", label: "הסכם 21533, הנחות מדורגות, סכום ביטוח עד מיליון ₪, עד גיל 39", maxSum: 1_000_000, maxAge: 39, years: [45, 35, 30, 15, 15, 15], freeMonths: 1 },
      { id: "21528", label: "הסכם 21528, הנחות מדורגות, סכום ביטוח עד מיליון ₪, גילאי 40-49", maxSum: 1_000_000, minAge: 40, maxAge: 49, years: [50, 40, 35, 25, 25, 25] },
      { id: "21534", label: "הסכם 21534, הנחות מדורגות, סכום ביטוח עד מיליון ₪, גילאי 40-49", maxSum: 1_000_000, minAge: 40, maxAge: 49, years: [50, 40, 35, 25, 25, 25], freeMonths: 1 },
      { id: "21529", label: "הסכם 21529, הנחות מדורגות, סכום ביטוח עד מיליון ₪, גילאי 50-70", maxSum: 1_000_000, minAge: 50, maxAge: 70, years: [55, 55, 45, 45, 35, 35] },
      { id: "21535", label: "הסכם 21535, הנחות מדורגות, סכום ביטוח עד מיליון ₪, גילאי 50-70", maxSum: 1_000_000, minAge: 50, maxAge: 70, years: [55, 55, 45, 45, 35, 35], freeMonths: 1 },
      { id: "21530", label: "הסכם 21530, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, עד גיל 39", minSum: 1_000_000, maxSum: 3_000_000, maxAge: 39, years: [55, 45, 35, 25, 25, 25] },
      { id: "21536", label: "הסכם 21536, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, עד גיל 39", minSum: 1_000_000, maxSum: 3_000_000, maxAge: 39, years: [55, 45, 35, 25, 25, 25], freeMonths: 1 },
      { id: "21531", label: "הסכם 21531, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, גילאי 40-49", minSum: 1_000_000, maxSum: 3_000_000, minAge: 40, maxAge: 49, years: [55, 50, 45, 35, 35, 35] },
      { id: "21537", label: "הסכם 21537, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, גילאי 40-49", minSum: 1_000_000, maxSum: 3_000_000, minAge: 40, maxAge: 49, years: [55, 50, 45, 35, 35, 35], freeMonths: 1 },
      { id: "21532", label: "הסכם 21532, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, גילאי 50-70", minSum: 1_000_000, maxSum: 3_000_000, minAge: 50, maxAge: 70, years: [60, 60, 50, 50, 40, 40] },
      { id: "21538", label: "הסכם 21538, הנחות מדורגות, סכום ביטוח מיליון עד 3 מיליון ₪, גילאי 50-70", minSum: 1_000_000, maxSum: 3_000_000, minAge: 50, maxAge: 70, years: [60, 60, 50, 50, 40, 40], freeMonths: 1 },
      // הסכמי הזהב: a sum of one to three million and a premium from 180 ₪ before discounts.
      { id: "21721", label: "הסכם זהב 1 (21721), סכום ביטוח מיליון עד 3 מיליון ₪, פרמיה מ-180 ₪", minSum: 1_000_000, maxSum: 3_000_000, minPremium: 180, years: [70, 65, 65, 55, 45, 45] },
      { id: "21722", label: "הסכם זהב 1 (21722), סכום ביטוח מיליון עד 3 מיליון ₪, פרמיה מ-180 ₪", minSum: 1_000_000, maxSum: 3_000_000, minPremium: 180, years: [70, 65, 65, 55, 45, 45], freeMonths: 1 },
      { id: "21723", label: "הסכם זהב 2 (21723), סכום ביטוח מיליון עד 3 מיליון ₪, פרמיה מ-180 ₪", minSum: 1_000_000, maxSum: 3_000_000, minPremium: 180, years: [65, 65, 65, 55, 50, 40] },
      { id: "21724", label: "הסכם זהב 2 (21724), סכום ביטוח מיליון עד 3 מיליון ₪, פרמיה מ-180 ₪", minSum: 1_000_000, maxSum: 3_000_000, minPremium: 180, years: [65, 65, 65, 55, 50, 40], freeMonths: 1 },
      // הנחות קבועות, a sum up to three million.
      { id: "21539", label: "הסכם 21539, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, עד גיל 39", maxSum: 3_000_000, maxAge: 39, years: six(30) },
      { id: "21542", label: "הסכם 21542, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, עד גיל 39", maxSum: 3_000_000, maxAge: 39, years: six(30), freeMonths: 1 },
      { id: "21540", label: "הסכם 21540, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, גילאי 40-49", maxSum: 3_000_000, minAge: 40, maxAge: 49, years: six(35) },
      { id: "21543", label: "הסכם 21543, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, גילאי 40-49", maxSum: 3_000_000, minAge: 40, maxAge: 49, years: six(35), freeMonths: 1 },
      { id: "21541", label: "הסכם 21541, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, גילאי 50-70", maxSum: 3_000_000, minAge: 50, maxAge: 70, years: six(45) },
      { id: "21544", label: "הסכם 21544, הנחות קבועות, סכום ביטוח עד 3 מיליון ₪, גילאי 50-70", maxSum: 3_000_000, minAge: 50, maxAge: 70, years: six(45), freeMonths: 1 },
      // סכום ביטוח מינימלי 50,000 ₪, ages 18 to 70.
      { id: "21550", label: "הסכם 21550, סכום ביטוח מינימלי 50,000 ₪, גילאי 18-70", minSum: 50_000, minAge: 18, maxAge: 70, years: [45, 35, 30, 15, 15, 15] },
      { id: "21551", label: "הסכם 21551, סכום ביטוח מינימלי 50,000 ₪, גילאי 18-70", minSum: 50_000, minAge: 18, maxAge: 70, years: [45, 35, 30, 15, 15, 15], freeMonths: 1 },
    ],
  },
  {
    company: "menora",
    title: "מנורה, ההטבות הכי משתלמות לסוף השנה: ריסק פרט",
    from: "2026-10-15",
    to: "2026-12-31",
    note: "כל החבילות כוללות בחינם את הכיסויים עוד בחיים ו-Extra life: לסמן אותם בטופס ההצעה",
    tracks: [
      // Ages 30 to 60, a premium from 170 ₪ before the discount, a sum up to four million.
      { id: "101678", label: "חבילה 101678, ריסק פרט, גילאי 30-60, פרמיה מ-170 ₪", ...MENORA_TOP, years: [85, 70, 70, 35, 35, 30, 30, 30] },
      { id: "101679", label: "חבילה 101679, ריסק פרט, גילאי 30-60, פרמיה מ-170 ₪", ...MENORA_TOP, years: [85, 75, 65, 30, 30, 30, 30, 30] },
      { id: "101680", label: "חבילה 101680, ריסק פרט, גילאי 30-60, פרמיה מ-170 ₪", ...MENORA_TOP, years: [80, 70, 70, 35, 35, 30, 30, 30] },
      { id: "101681", label: "חבילה 101681, ריסק פרט, גילאי 30-60, פרמיה מ-170 ₪", ...MENORA_TOP, years: [75, 70, 70, 35, 35, 30, 30, 30] },
      { id: "101682", label: "חבילה 101682, ריסק פרט, גילאי 30-60, פרמיה מ-170 ₪", ...MENORA_TOP, years: [70, 70, 70, 35, 35, 30, 30, 30] },
      // Each with its own premium before the discount.
      { id: "101661", label: "חבילה 101661, ריסק פרט, פרמיה מ-120 ₪", minPremium: 120, years: [70, 65, 60, 55, 30, 20] },
      { id: "101662", label: "חבילה 101662, ריסק פרט, פרמיה מ-100 ₪", minPremium: 100, years: [70, 70, 55, 40, 30, 20] },
      { id: "101667", label: "חבילה 101667, ריסק פרט, פרמיה מ-160 ₪", minPremium: 160, years: [70, 65, 65, 50, 40, 20] },
      { id: "101668", label: "חבילה 101668, ריסק פרט, פרמיה מ-140 ₪", minPremium: 140, years: [70, 60, 50, 40, 20, 20, 40, 50, 50] },
    ],
  },
];

// ── Choosing ────────────────────────────────────────────────────────────────

export type DiscountQuery = {
  company: CompanyKey;
  /** The day the policy would join (Israel), ISO. */
  on: string;
  insuranceAge: number;
  sumInsured: number;
  /** The monthly premium before any discount, in ₪. */
  monthly: number;
  /** Years left on the mortgage; null when not known, and then no track that needs a minimum period applies. */
  loanYears: number | null;
};

export type DiscountChoice = { promotion: Promotion; track: DiscountTrack };

function fits(t: DiscountTrack, q: DiscountQuery): boolean {
  if (t.minPremium !== undefined && q.monthly < t.minPremium) return false;
  if (t.minYears !== undefined && (q.loanYears === null || q.loanYears < t.minYears)) return false;
  if (t.minAge !== undefined && q.insuranceAge < t.minAge) return false;
  if (t.maxAge !== undefined && q.insuranceAge > t.maxAge) return false;
  if (t.minSum !== undefined && q.sumInsured < t.minSum) return false;
  if (t.maxSum !== undefined && q.sumInsured > t.maxSum) return false;
  return true;
}

/** Every track this policy could join under today, in the files' order. */
export function eligibleDiscounts(q: DiscountQuery, promotions: readonly Promotion[] = PROMOTIONS): DiscountChoice[] {
  return promotions
    .filter((p) => p.company === q.company && p.from <= q.on && q.on <= p.to)
    .flatMap((promotion) => promotion.tracks.filter((track) => fits(track, q)).map((track) => ({ promotion, track })));
}

/**
 * The one discount this policy gets, or null: the largest year-1 discount (the
 * price the customer is shown); between equals, more free months, then more
 * discount over years 2 to 10; then the files' order.
 */
export function bestDiscount(q: DiscountQuery, promotions: readonly Promotion[] = PROMOTIONS): DiscountChoice | null {
  const later = (t: DiscountTrack) => t.years.slice(1, 10).reduce((sum, pct) => sum + pct, 0);
  let best: DiscountChoice | null = null;
  for (const choice of eligibleDiscounts(q, promotions)) {
    if (!best) {
      best = choice;
      continue;
    }
    const a = choice.track;
    const b = best.track;
    const better =
      a.years[0] !== b.years[0]
        ? a.years[0] > b.years[0]
        : (a.freeMonths ?? 0) !== (b.freeMonths ?? 0)
          ? (a.freeMonths ?? 0) > (b.freeMonths ?? 0)
          : later(a) > later(b);
    if (better) best = choice;
  }
  return best;
}

/** A premium after a discount, worked in whole agorot like the premium itself. */
export function discountedMonthly(monthly: number, percent: number): number {
  return Math.round((Math.round(monthly * 100) * (100 - percent)) / 100) / 100;
}

// ── What the quote keeps ────────────────────────────────────────────────────

/** The discount in a quote's price, stored with it so the agency reads it as it was on the day. */
export type AppliedDiscount = {
  /** The promotion's file. */
  promotion: string;
  /** Its last day, ISO. */
  until: string;
  /** The track's own id (see DiscountTrack.id). */
  id: string;
  /** The row, as the agency finds it in the file. */
  track: string;
  /** Year 1's discount, the one in the price. */
  percent: number;
  /** Every year's, as the file lists them. */
  years: number[];
  freeMonths: number;
  later?: string;
  note?: string;
};

export function appliedDiscount({ promotion, track }: DiscountChoice): AppliedDiscount {
  return {
    promotion: promotion.title,
    until: promotion.to,
    id: track.id,
    track: track.label,
    percent: track.years[0],
    years: [...track.years],
    freeMonths: track.freeMonths ?? 0,
    ...(track.later ? { later: track.later } : {}),
    ...(promotion.note ? { note: promotion.note } : {}),
  };
}

/** ["שנה 1: 65%", "שנה 2: 50%", "שנה 3: 40%", "שנים 4-6: 30%"]: years at the same discount run together. */
export function scheduleParts(years: readonly number[]): string[] {
  const parts: string[] = [];
  for (let i = 0; i < years.length; ) {
    let j = i;
    while (j + 1 < years.length && years[j + 1] === years[i]) j++;
    parts.push(`${i === j ? `שנה ${i + 1}` : `שנים ${i + 1}-${j + 1}`}: ${years[i]}%`);
    i = j + 1;
  }
  return parts;
}

/** "שנה 1: 65% · שנה 2: 50% · שנה 3: 40% · שנים 4-6: 30%" */
export function scheduleText(years: readonly number[]): string {
  return scheduleParts(years).join(" · ");
}

/** "חודשיים ראשונים חינם" */
export function freeMonthsText(n: number): string {
  return n === 1 ? "חודש ראשון חינם" : n === 2 ? "חודשיים ראשונים חינם" : `${n} חודשים ראשונים חינם`;
}

/** "הנחה 65% בשנה הראשונה, חודשיים ראשונים חינם": what the price rests on, in one breath. */
export function discountHeadline(d: AppliedDiscount): string {
  return `הנחה ${d.percent}% בשנה הראשונה${d.freeMonths ? `, ${freeMonthsText(d.freeMonths)}` : ""}`;
}

/** The whole of it, a line each: the headline, the row with every year's discount, the dates, and what to do. */
export function discountLines(d: AppliedDiscount): string[] {
  return [
    discountHeadline(d),
    `${d.track}: ${scheduleText(d.years)}${d.later ? `, ${d.later}` : ""}`,
    `${d.promotion}, למצטרפים עד ${isoToDisplay(d.until)}`,
    ...(d.note ? [d.note] : []),
  ];
}

/** The same in one line, for the lead. */
export function discountDetails(d: AppliedDiscount): string {
  return discountLines(d).join(". ");
}
