// Mortgage life insurance: what the cover costs at Migdal, Menora and Harel,
// read off the rate cards the agency prices with, and which is the cheapest.
//
// Each card prices death cover by age, sex and smoking, in its own unit: Migdal
// and Menora a MONTHLY premium per 100,000 ₪, Harel a YEARLY premium per
// 1,000 ₪ (a twelfth of it a month). For a mortgage the cover is the loan's
// balance, so the first month costs rate x balance / unit. The balance falls
// and the age rises, so later months move; the price a customer STARTS at is
// what the companies are compared on.
//
// The cards (sent by the owner, 2026-11-05):
//  - Migdal, "תכניות מגדל חיים", ריסק אור 1. Its mortgage plan, "ריסק
//    למשכנתא", starts from the same base rates at the entry age, takes people
//    in up to age 69 and covers them to 85.
//  - Menora Mivtachim, "תעריף ריסק 1", correct for January 2023: one table up
//    to half a million ₪ of cover and a cheaper one above it. The tier is the
//    whole sum's: 600,000 ₪ is priced entirely from the second table.
//  - Harel, "מגן 1" (a PDF made in February 2019): a yearly premium per 1,000 ₪,
//    for a sum insured from 500,000 ₪, ages 18 to 75. There is no table for less
//    cover, so a smaller balance is not priced at Harel.
// All are BASE rates, before any medical or occupational loading, which only
// the insurer's underwriting can add.
//
// On top of the card, each company's current discount for a new policy, one per
// policy, the one that gives the lowest price (lib/mortgage-discounts.ts). The
// companies are compared on the monthly premium of the first year after it.
//
// A new card means new numbers here and a new run of the tests, which read every
// cell back against a copy taken from the photos.
//
// Pure module: no React, no Node-only API, safe on both sides.

import { completedMonths, completedYears, israelDayIso } from "./dates";
import { appliedDiscount, bestDiscount, discountDetails, discountHeadline, discountLines, discountedMonthly, type AppliedDiscount } from "./mortgage-discounts";

// ── The form this prices ────────────────────────────────────────────────────
// The FormDef (lib/forms.ts) and the pricing share these names, so a renamed
// field or option cannot quietly stop the price from being worked out.

export const MORTGAGE_FORM_SLUG = "mortgage-life";

export const MORTGAGE_FIELDS = {
  birthDate: "birth_date",
  sex: "gender",
  smoking: "smoking",
  balance: "mortgage_balance",
  loanYears: "mortgage_years_left",
} as const;

export const SEX_OPTIONS = { male: "זכר", female: "נקבה" } as const;
export const SMOKING_OPTIONS = { smoker: "מעשן/ת", nonSmoker: "לא מעשן/ת" } as const;

/** The youngest and oldest age the form takes (completed years). */
export const MORTGAGE_AGE_LIMITS = [18, 120] as const;

// ── The rate cards ──────────────────────────────────────────────────────────

type Column = "manNonSmoker" | "womanNonSmoker" | "manSmoker" | "womanSmoker";
/** One age's four prices, in the order the card prints them (right to left). */
type Row = readonly [number, number, number, number];

/** What a card's number buys: ₪ per `per` ₪ of cover, for a month or for a year. */
export type RateUnit = { per: number; period: "month" | "year" };

const MONTHLY_PER_100K: RateUnit = { per: 100_000, period: "month" };
const YEARLY_PER_1000: RateUnit = { per: 1_000, period: "year" };

export type RateTable = {
  unit: RateUnit;
  /** Which price sits in which column of this table's rows. */
  columns: readonly [Column, Column, Column, Column];
  rows: Readonly<Record<number, Row>>;
};

/** Migdal, ריסק אור 1: לא מעשן (גבר, אשה), מעשן (גבר, אשה). */
export const MIGDAL_RISK_OR_1: RateTable = {
  unit: MONTHLY_PER_100K,
  columns: ["manNonSmoker", "womanNonSmoker", "manSmoker", "womanSmoker"],
  rows: {
    18: [6.00, 3.10, 8.83, 6.15],
    19: [6.00, 3.10, 8.83, 6.15],
    20: [6.00, 3.10, 8.83, 6.15],
    21: [6.00, 3.10, 8.83, 6.15],
    22: [6.00, 3.10, 8.83, 6.15],
    23: [6.00, 3.10, 8.83, 6.15],
    24: [6.00, 3.10, 8.83, 6.15],
    25: [6.00, 3.10, 8.83, 6.15],
    26: [6.00, 3.10, 8.83, 6.15],
    27: [6.00, 3.10, 8.83, 6.15],
    28: [6.00, 3.10, 8.83, 6.15],
    29: [6.00, 3.10, 8.83, 6.15],
    30: [6.00, 3.10, 8.83, 6.15],
    31: [6.00, 3.10, 9.12, 6.15],
    32: [6.00, 3.10, 9.40, 6.15],
    33: [6.00, 3.42, 9.69, 6.15],
    34: [6.00, 3.83, 9.98, 6.76],
    35: [6.00, 4.23, 10.26, 7.37],
    36: [6.00, 4.58, 11.05, 7.87],
    37: [6.00, 4.78, 11.83, 8.14],
    38: [6.00, 5.08, 12.61, 8.55],
    39: [6.64, 5.49, 13.40, 9.14],
    40: [6.91, 5.57, 14.18, 9.21],
    41: [7.58, 6.22, 15.46, 10.15],
    42: [8.34, 7.21, 16.89, 11.62],
    43: [9.24, 8.30, 18.61, 13.21],
    44: [10.08, 9.53, 20.19, 15.00],
    45: [11.12, 11.08, 22.13, 17.25],
    46: [12.32, 12.77, 24.38, 19.68],
    47: [13.66, 14.55, 26.88, 22.24],
    48: [15.18, 16.41, 29.68, 24.85],
    49: [17.28, 18.17, 33.59, 27.32],
    50: [19.51, 19.01, 37.71, 28.38],
    51: [21.92, 19.75, 42.12, 29.27],
    52: [24.33, 20.78, 46.46, 30.59],
    53: [26.92, 22.60, 51.11, 33.03],
    54: [29.63, 25.18, 55.91, 36.53],
    55: [32.94, 28.36, 61.79, 40.83],
    56: [36.46, 31.87, 68.00, 45.56],
    57: [40.58, 34.81, 75.24, 49.43],
    58: [45.44, 37.61, 83.75, 53.05],
    59: [52.20, 41.64, 95.63, 58.33],
    60: [59.43, 47.05, 108.24, 65.46],
    61: [68.11, 54.31, 123.30, 75.05],
    62: [77.87, 63.09, 140.15, 86.59],
    63: [87.67, 72.63, 156.84, 99.03],
    64: [97.68, 81.79, 173.70, 110.81],
    65: [109.11, 90.59, 192.87, 121.95],
    66: [122.98, 98.81, 216.08, 132.18],
    67: [139.50, 107.78, 243.64, 143.28],
    68: [155.86, 119.32, 270.58, 157.62],
    69: [171.23, 132.14, 295.48, 173.47],
    70: [186.30, 149.07, 319.56, 194.47],
    71: [210.76, 168.42, 362.35, 220.19],
    72: [239.95, 191.28, 413.51, 250.60],
    73: [275.90, 213.61, 476.55, 280.47],
    74: [310.56, 235.14, 537.67, 309.42],
    75: [341.83, 253.83, 593.17, 334.75],
    76: [370.58, 274.92, 644.50, 363.33],
    77: [401.75, 297.25, 700.25, 393.83],
    78: [437.83, 325.25, 765.00, 431.83],
    79: [477.00, 365.25, 835.33, 485.92],
  },
};

/** Menora, ריסק 1, cover up to half a million ₪: גבר (לא מעשן, מעשן), אישה (לא מעשנת, מעשנת). */
export const MENORA_RISK_1_UP_TO_HALF_MILLION: RateTable = {
  unit: MONTHLY_PER_100K,
  columns: ["manNonSmoker", "manSmoker", "womanNonSmoker", "womanSmoker"],
  rows: {
    18: [7.40, 11.34, 4.62, 6.03],
    19: [7.08, 10.90, 4.62, 5.85],
    20: [6.86, 8.85, 4.62, 5.85],
    21: [6.58, 8.68, 4.62, 5.85],
    22: [6.64, 8.69, 4.62, 5.85],
    23: [6.47, 8.53, 4.62, 5.85],
    24: [6.31, 8.46, 4.62, 5.85],
    25: [6.20, 8.42, 4.62, 5.85],
    26: [5.97, 8.35, 4.67, 5.85],
    27: [5.92, 8.27, 4.67, 5.97],
    28: [6.04, 8.24, 4.73, 5.97],
    29: [6.17, 8.19, 4.83, 6.25],
    30: [6.26, 8.10, 5.04, 6.47],
    31: [6.41, 8.30, 5.28, 6.69],
    32: [6.47, 8.46, 5.50, 7.03],
    33: [6.71, 8.74, 5.76, 7.30],
    34: [6.99, 9.18, 6.04, 7.69],
    35: [7.23, 9.63, 6.27, 8.24],
    36: [7.77, 10.29, 6.55, 8.75],
    37: [8.14, 11.06, 6.83, 9.26],
    38: [8.49, 11.88, 7.34, 9.88],
    39: [8.74, 13.11, 7.62, 10.56],
    40: [9.24, 14.38, 8.15, 11.29],
    41: [9.89, 15.82, 8.80, 12.76],
    42: [10.62, 17.25, 9.39, 14.14],
    43: [11.27, 19.25, 10.19, 15.62],
    44: [12.36, 21.41, 10.86, 17.51],
    45: [13.44, 23.56, 11.63, 19.24],
    46: [14.79, 26.14, 12.33, 21.58],
    47: [16.20, 28.95, 13.20, 24.04],
    48: [17.83, 33.02, 14.26, 27.03],
    49: [19.87, 36.54, 15.31, 30.04],
    50: [22.41, 42.20, 16.87, 33.80],
    51: [24.73, 48.07, 18.18, 38.05],
    52: [27.60, 53.52, 19.69, 42.32],
    53: [30.57, 60.89, 21.34, 47.50],
    54: [33.82, 69.13, 23.20, 53.38],
    55: [36.66, 76.44, 24.98, 59.89],
    56: [40.57, 87.26, 27.61, 65.79],
    57: [44.93, 97.04, 30.20, 73.17],
    58: [50.44, 109.21, 33.03, 80.55],
    59: [55.82, 122.06, 36.55, 89.60],
    60: [61.78, 136.25, 39.63, 99.76],
    61: [69.27, 147.66, 43.94, 109.97],
    62: [76.58, 159.87, 48.49, 121.17],
    63: [84.70, 170.50, 53.30, 135.00],
    64: [93.45, 205.21, 58.51, 148.97],
    65: [106.28, 239.02, 64.42, 166.18],
    66: [121.02, 280.78, 72.19, 184.04],
    67: [137.66, 318.64, 82.09, 206.01],
    68: [156.44, 356.81, 92.30, 230.47],
    69: [168.41, 399.45, 104.08, 262.95],
    70: [191.37, 445.22, 117.68, 290.06],
    71: [217.38, 498.65, 133.02, 315.37],
    72: [244.30, 544.29, 153.59, 341.55],
    73: [274.85, 590.83, 181.09, 368.08],
    74: [309.54, 631.09, 211.43, 394.43],
    75: [349.19, 669.45, 247.13, 419.92],
    76: [438.74, 704.53, 307.77, 443.85],
    77: [534.39, 719.57, 338.70, 464.68],
    78: [598.74, 741.16, 381.29, 481.09],
    79: [672.07, 752.09, 430.15, 491.03],
  },
};

/** Menora, ריסק 1, cover above half a million ₪: same columns as the table up to it. */
export const MENORA_RISK_1_ABOVE_HALF_MILLION: RateTable = {
  unit: MONTHLY_PER_100K,
  columns: ["manNonSmoker", "manSmoker", "womanNonSmoker", "womanSmoker"],
  rows: {
    18: [7.03, 10.77, 4.39, 5.73],
    19: [6.72, 10.35, 4.39, 5.56],
    20: [6.52, 8.41, 4.39, 5.56],
    21: [6.25, 8.25, 4.39, 5.56],
    22: [6.31, 8.26, 4.39, 5.56],
    23: [6.15, 8.11, 4.39, 5.56],
    24: [5.99, 8.04, 4.39, 5.56],
    25: [5.89, 8.00, 4.39, 5.56],
    26: [5.68, 7.93, 4.44, 5.56],
    27: [5.62, 7.85, 4.44, 5.67],
    28: [5.74, 7.83, 4.49, 5.67],
    29: [5.86, 7.78, 4.59, 5.94],
    30: [5.94, 7.70, 4.79, 6.15],
    31: [6.08, 7.88, 5.02, 6.36],
    32: [6.14, 8.04, 5.23, 6.67],
    33: [6.37, 8.30, 5.47, 6.94],
    34: [6.64, 8.72, 5.73, 7.30],
    35: [6.87, 9.14, 5.95, 7.83],
    36: [7.38, 9.77, 6.22, 8.31],
    37: [7.73, 10.51, 6.49, 8.79],
    38: [8.07, 11.29, 6.97, 9.38],
    39: [8.30, 12.45, 7.24, 10.03],
    40: [8.78, 13.66, 7.74, 10.73],
    41: [9.39, 15.03, 8.36, 12.12],
    42: [10.09, 16.39, 8.92, 13.44],
    43: [10.71, 18.29, 9.68, 14.84],
    44: [11.75, 20.34, 10.31, 16.63],
    45: [12.77, 22.38, 11.04, 18.28],
    46: [14.05, 24.84, 11.71, 20.50],
    47: [15.39, 27.50, 12.54, 22.84],
    48: [16.94, 31.37, 13.54, 25.68],
    49: [18.88, 34.71, 14.54, 28.54],
    50: [21.29, 40.09, 16.03, 32.11],
    51: [23.49, 45.67, 17.27, 36.15],
    52: [26.22, 50.84, 18.71, 40.20],
    53: [29.04, 57.84, 20.27, 45.13],
    54: [32.13, 65.67, 22.04, 50.71],
    55: [34.83, 72.62, 23.73, 56.90],
    56: [38.54, 82.90, 26.23, 62.50],
    57: [42.69, 92.19, 28.69, 69.51],
    58: [47.91, 103.75, 31.38, 76.52],
    59: [53.03, 115.96, 34.73, 85.12],
    60: [58.69, 129.44, 37.65, 94.77],
    61: [65.80, 140.27, 41.74, 104.47],
    62: [72.75, 151.88, 46.06, 115.11],
    63: [80.46, 161.98, 50.63, 128.25],
    64: [88.78, 194.95, 55.59, 141.52],
    65: [100.96, 227.07, 61.20, 157.87],
    66: [114.97, 266.74, 68.58, 174.83],
    67: [130.78, 302.71, 77.99, 195.71],
    68: [148.62, 338.97, 87.69, 218.95],
    69: [159.99, 379.47, 98.87, 249.80],
    70: [181.81, 422.96, 111.79, 275.55],
    71: [206.51, 473.72, 126.37, 299.60],
    72: [232.09, 517.07, 145.91, 324.48],
    73: [261.11, 561.29, 172.04, 349.68],
    74: [294.07, 599.54, 200.85, 374.71],
    75: [331.73, 635.98, 234.77, 398.93],
    76: [416.80, 669.31, 292.38, 421.66],
    77: [507.67, 683.59, 321.77, 441.44],
    78: [568.80, 704.11, 362.23, 457.04],
    79: [638.47, 714.48, 408.64, 466.48],
  },
};

/** Menora's first table holds cover up to and including this sum. */
export const MENORA_TIER_LIMIT = 500_000;

/** Harel, מגן 1, a YEARLY premium per 1,000 ₪ from 500,000 ₪ of cover: גבר (לא מעשן, מעשן), אישה (לא מעשנת, מעשנת). */
export const HAREL_MAGEN_1: RateTable = {
  unit: YEARLY_PER_1000,
  columns: ["manNonSmoker", "manSmoker", "womanNonSmoker", "womanSmoker"],
  rows: {
    18: [0.80, 1.02, 0.54, 0.67],
    19: [0.80, 1.02, 0.54, 0.67],
    20: [0.80, 1.02, 0.54, 0.67],
    21: [0.78, 1.02, 0.54, 0.67],
    22: [0.77, 1.01, 0.54, 0.67],
    23: [0.75, 0.99, 0.54, 0.67],
    24: [0.74, 0.99, 0.54, 0.67],
    25: [0.72, 0.98, 0.54, 0.67],
    26: [0.71, 0.97, 0.54, 0.68],
    27: [0.70, 0.96, 0.54, 0.69],
    28: [0.71, 0.96, 0.55, 0.70],
    29: [0.73, 0.95, 0.56, 0.71],
    30: [0.74, 0.94, 0.58, 0.75],
    31: [0.77, 0.98, 0.61, 0.79],
    32: [0.79, 1.02, 0.64, 0.83],
    33: [0.81, 1.05, 0.67, 0.87],
    34: [0.84, 1.09, 0.70, 0.92],
    35: [0.87, 1.12, 0.74, 0.97],
    36: [0.90, 1.23, 0.78, 1.03],
    37: [0.95, 1.31, 0.82, 1.09],
    38: [0.99, 1.43, 0.87, 1.16],
    39: [1.04, 1.54, 0.92, 1.23],
    40: [1.09, 1.67, 0.98, 1.33],
    41: [1.16, 1.86, 1.04, 1.48],
    42: [1.24, 2.05, 1.10, 1.64],
    43: [1.32, 2.28, 1.18, 1.82],
    44: [1.44, 2.52, 1.27, 2.03],
    45: [1.58, 2.80, 1.35, 2.26],
    46: [1.75, 3.13, 1.45, 2.52],
    47: [1.93, 3.49, 1.56, 2.82],
    48: [2.13, 3.90, 1.68, 3.15],
    49: [2.36, 4.42, 1.82, 3.52],
    50: [2.61, 5.00, 1.96, 3.94],
    51: [2.89, 5.64, 2.12, 4.42],
    52: [3.22, 6.36, 2.30, 4.95],
    53: [3.58, 7.17, 2.50, 5.55],
    54: [3.97, 8.08, 2.72, 6.24],
    55: [4.40, 9.09, 2.96, 7.00],
    56: [4.89, 10.21, 3.23, 7.78],
    57: [5.42, 11.46, 3.53, 8.62],
    58: [6.01, 12.84, 3.87, 9.55],
    59: [6.66, 14.38, 4.26, 10.57],
    60: [7.38, 16.07, 4.69, 11.71],
    61: [8.21, 17.29, 5.14, 12.95],
    62: [9.13, 18.61, 5.66, 14.31],
    63: [10.17, 20.03, 6.21, 15.82],
    64: [11.31, 24.18, 6.83, 17.49],
    65: [12.59, 28.07, 7.49, 19.33],
    66: [14.27, 32.71, 8.46, 21.62],
    67: [16.13, 37.36, 9.57, 24.16],
    68: [18.23, 42.02, 10.81, 27.04],
    69: [20.62, 47.09, 12.22, 30.34],
    70: [23.28, 52.91, 13.80, 34.07],
    71: [26.29, 59.01, 15.61, 38.21],
    72: [29.62, 65.49, 18.02, 42.89],
    73: [33.34, 72.40, 21.14, 48.14],
    74: [37.62, 79.52, 24.63, 54.02],
    75: [42.89, 87.00, 28.87, 60.62],
  },
};

/** Harel's card starts at this sum insured. */
export const HAREL_MIN_SUM = 500_000;

// ── The companies ───────────────────────────────────────────────────────────

export type CompanyKey = "migdal" | "menora" | "harel";

type Company = {
  key: CompanyKey;
  /** What the customer reads. */
  name: string;
  /** The plan and the card, for the agency. */
  plan: string;
  /** Entry ages it is priced for here. */
  minAge: number;
  maxAge: number;
  /** The smallest sum insured its card covers, when it has one. */
  minSum?: number;
  table: (sumInsured: number) => { table: RateTable; label: string };
};

export const COMPANIES: readonly Company[] = [
  {
    key: "migdal",
    name: "מגדל ביטוח",
    plan: "ריסק למשכנתא (תעריפי הבסיס של ריסק אור 1)",
    minAge: 18,
    // "גיל כניסה מקסימלי לביטוח: 69" (ריסק למשכנתא, on the card).
    maxAge: 69,
    table: () => ({ table: MIGDAL_RISK_OR_1, label: "ריסק אור 1" }),
  },
  {
    key: "menora",
    name: "מנורה מבטחים",
    plan: "ריסק 1 (תעריף ינואר 2023)",
    minAge: 18,
    // The card prints ages 18 to 79 and states no entry limit: priced as far as it goes.
    maxAge: 79,
    table: (sum) =>
      sum > MENORA_TIER_LIMIT
        ? { table: MENORA_RISK_1_ABOVE_HALF_MILLION, label: "סכום ביטוח מעל חצי מיליון ₪" }
        : { table: MENORA_RISK_1_UP_TO_HALF_MILLION, label: "סכום ביטוח עד חצי מיליון ₪" },
  },
  {
    key: "harel",
    name: "הראל ביטוח",
    plan: "מגן 1",
    minAge: 18,
    // The card prints ages 18 to 75.
    maxAge: 75,
    minSum: HAREL_MIN_SUM,
    table: () => ({ table: HAREL_MAGEN_1, label: "סכום ביטוח מ-500,000 ₪" }),
  },
];

// ── Pricing ─────────────────────────────────────────────────────────────────

export type Sex = "male" | "female";

export type MortgageQuoteInput = {
  /** ISO "1988-04-21". */
  birthDate: string;
  sex: Sex;
  smoker: boolean;
  /** The mortgage balance in ₪: the sum insured. */
  balance: number;
  /** Years left on the mortgage: how long the cover runs. Null when not asked (some discounts need a minimum). */
  loanYears?: number | null;
};

export type CompanyQuote = {
  company: CompanyKey;
  name: string;
  plan: string;
  /** Which table of the card the rate came from. */
  table: string;
  /** The rate as the card prints it, in the card's own unit; null when not priced. */
  rate: number | null;
  /** That unit in words: "לחודש לכל 100,000 ₪", "לשנה לכל 1,000 ₪". */
  rateUnit: string;
  /**
   * The monthly premium of the first year in ₪, to the agora, after the
   * company's discount when one applies; null when not priced. What the
   * companies are compared on and what the customer is shown.
   */
  monthly: number | null;
  /** The card's monthly premium before any discount. Absent on quotes made before discounts were applied (2026-11-06). */
  listMonthly?: number | null;
  /** The discount in `monthly`: null when none applies, absent on quotes made before discounts were applied. */
  discount?: AppliedDiscount | null;
  /** Why there is no price, in words the customer and the agency both read. */
  unavailable?: string;
};

export type MortgageQuote = {
  /** The day it was priced (Israel), ISO. */
  on: string;
  /** Completed years on that day. */
  age: number;
  /** The age the cards were read at (see insuranceAge). */
  insuranceAge: number;
  sex: Sex;
  smoker: boolean;
  sumInsured: number;
  /** Years left on the mortgage; null when not asked, absent on quotes made before the form asked it. */
  loanYears?: number | null;
  quotes: CompanyQuote[];
  /** The cheapest company that priced it; null when none did. */
  best: CompanyKey | null;
  /** The next cheapest has the very same price. */
  tie: boolean;
  /** What the cheapest saves a month over the next cheapest, when two or more priced it. */
  saving: number | null;
};

/**
 * The age the rate cards are read at: the age at the NEAREST birthday, so from
 * six months after a birthday a person is priced at the next age. This is how
 * Israeli insurers usually set the insurance age (גיל ביטוחי) at the start of a
 * policy, and it keeps the estimate from promising the younger row's price.
 */
export function insuranceAge(birthIso: string, onIso: string): number {
  return Math.floor((completedMonths(birthIso, onIso) + 6) / 12);
}

/** The card's price for this person, or null when the card has no row for the age. */
export function rateFor(table: RateTable, age: number, sex: Sex, smoker: boolean): number | null {
  const row = table.rows[age];
  if (!row) return null;
  const column: Column = sex === "male" ? (smoker ? "manSmoker" : "manNonSmoker") : smoker ? "womanSmoker" : "womanNonSmoker";
  return row[table.columns.indexOf(column)];
}

/**
 * One month of cover, to the agora: rate x sum / unit, and a twelfth of that
 * when the card prices a year. Worked in whole agorot so a rate like 8.24
 * cannot pick up a binary-fraction error on the way: 824 x 850,000 / 100,000 =
 * 7,004 agorot = 70.04 ₪; Harel's 0.80 a year per 1,000: 80 x 850,000 /
 * (1,000 x 12) = 5,666.7, so 56.67 ₪.
 */
export function monthlyPremium(rate: number, sumInsured: number, unit: RateUnit = MONTHLY_PER_100K): number {
  const divisor = unit.per * (unit.period === "year" ? 12 : 1);
  const agorot = Math.round((Math.round(rate * 100) * Math.round(sumInsured)) / divisor);
  return agorot / 100;
}

/** "לחודש לכל 100,000 ₪" */
export function unitLabel(unit: RateUnit): string {
  return `${unit.period === "year" ? "לשנה" : "לחודש"} לכל ${unit.per.toLocaleString("he-IL")} ₪`;
}

export function computeMortgageQuote(input: MortgageQuoteInput, onIso: string = israelDayIso()): MortgageQuote {
  const age = completedYears(input.birthDate, onIso);
  const priceAge = insuranceAge(input.birthDate, onIso);
  const sumInsured = Math.round(input.balance);
  const loanYears = input.loanYears ?? null;

  const quotes: CompanyQuote[] = COMPANIES.map((c) => {
    const { table, label } = c.table(sumInsured);
    const base = { company: c.key, name: c.name, plan: c.plan, table: label, rateUnit: unitLabel(table.unit) };
    const none = (unavailable: string): CompanyQuote => ({ ...base, rate: null, monthly: null, listMonthly: null, discount: null, unavailable });
    if (priceAge > c.maxAge) return none(`לא מחושב מעל גיל ${c.maxAge}`);
    if (priceAge < c.minAge) return none(`לא מחושב מתחת לגיל ${c.minAge}`);
    if (c.minSum && sumInsured < c.minSum) return none(`לא מחושב לסכום ביטוח מתחת ל-${wholeShekels(c.minSum)}`);
    const rate = rateFor(table, priceAge, input.sex, input.smoker);
    if (rate === null) return none("אין תעריף לגיל זה");
    const listMonthly = monthlyPremium(rate, sumInsured, table.unit);
    // The one discount this company gives a policy joining today, when any applies.
    const choice = bestDiscount({ company: c.key, on: onIso, insuranceAge: priceAge, sumInsured, monthly: listMonthly, loanYears });
    const discount = choice ? appliedDiscount(choice) : null;
    return { ...base, rate, listMonthly, monthly: discount ? discountedMonthly(listMonthly, discount.percent) : listMonthly, discount };
  });

  // Cheapest first; on a tie the order of COMPANIES decides who is named.
  const priced = quotes
    .filter((q): q is CompanyQuote & { monthly: number } => q.monthly !== null)
    .sort((a, b) => a.monthly - b.monthly);
  const best = priced[0] ?? null;
  const next = priced[1] ?? null;
  return {
    on: onIso,
    age,
    insuranceAge: priceAge,
    sex: input.sex,
    smoker: input.smoker,
    sumInsured,
    loanYears,
    quotes,
    best: best?.company ?? null,
    tie: Boolean(best && next && best.monthly === next.monthly),
    saving: best && next ? Math.round((next.monthly - best.monthly) * 100) / 100 : null,
  };
}

/** The form's answers as the quote's input, or null while something it needs is missing or unreadable. */
export function quoteInputFromAnswers(answers: Record<string, string | undefined>): MortgageQuoteInput | null {
  const birthDate = answers[MORTGAGE_FIELDS.birthDate] ?? "";
  const sexRaw = answers[MORTGAGE_FIELDS.sex];
  const smokingRaw = answers[MORTGAGE_FIELDS.smoking];
  const balance = Number(answers[MORTGAGE_FIELDS.balance]);
  const years = Number(answers[MORTGAGE_FIELDS.loanYears]);
  const sex: Sex | null = sexRaw === SEX_OPTIONS.male ? "male" : sexRaw === SEX_OPTIONS.female ? "female" : null;
  const smoker = smokingRaw === SMOKING_OPTIONS.smoker ? true : smokingRaw === SMOKING_OPTIONS.nonSmoker ? false : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !sex || smoker === null || !Number.isFinite(balance) || balance <= 0) return null;
  // Whole years: 24.5 years left does not reach a 25-year minimum.
  return { birthDate, sex, smoker, balance, loanYears: Number.isFinite(years) && years >= 1 ? Math.floor(years) : null };
}

// ── Reading it back ─────────────────────────────────────────────────────────

/** "70.04 ₪" */
export function shekels(n: number): string {
  return `${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪`;
}

/** "850,000 ₪" */
export function wholeShekels(n: number): string {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export function bestQuote(q: MortgageQuote): CompanyQuote | null {
  return q.quotes.find((c) => c.company === q.best) ?? null;
}

/**
 * What the customer's browser is sent and shown: the lowest monthly premium of
 * the first year and what it rests on, with no company named (owner, 2026-11-05:
 * the customer sees the price only). The companies, their prices, their rates
 * and their discounts stay with the agency: the email, the lead and the back-office.
 */
export type CustomerQuote = Pick<MortgageQuote, "insuranceAge" | "sex" | "smoker" | "sumInsured"> & {
  /** The lowest monthly premium of the first year in ₪, after the discount in it; null when no card priced it. */
  monthly: number | null;
  /** The last day a new policy gets the discount in that price, ISO; null when it has none. */
  discountUntil: string | null;
};

export function customerQuote(q: MortgageQuote): CustomerQuote {
  const best = bestQuote(q);
  return {
    monthly: best?.monthly ?? null,
    discountUntil: best?.discount?.until ?? null,
    insuranceAge: q.insuranceAge,
    sex: q.sex,
    smoker: q.smoker,
    sumInsured: q.sumInsured,
  };
}

/** "גבר · לא מעשן", "אישה · מעשנת" */
export function personLabel(q: Pick<MortgageQuote, "sex" | "smoker">): string {
  const who = q.sex === "male" ? "גבר" : "אישה";
  const smoking = q.sex === "male" ? (q.smoker ? "מעשן" : "לא מעשן") : q.smoker ? "מעשנת" : "לא מעשנת";
  return `${who} · ${smoking}`;
}

/** "8.24 ₪ לחודש לכל 100,000 ₪ (ריסק אור 1)", for the agency. */
export function rateLine(c: CompanyQuote): string {
  return c.rate !== null ? `${shekels(c.rate)} ${c.rateUnit} (${c.table})` : (c.unavailable ?? "");
}

/**
 * What a submission stores about the price check: the whole result as JSON
 * under a private key (the back-office reads it back as it was on the day,
 * not re-priced at a later age or a later card), plus plain keys so the Mslahtk
 * card shows the prices without parsing anything.
 */
export function quoteAnswerFields(q: MortgageQuote): Record<string, string> {
  const line = (c: CompanyQuote) =>
    c.monthly === null
      ? (c.unavailable ?? "לא מחושב")
      : `${shekels(c.monthly)} לחודש${c.discount ? ` (לפני הנחה ${shekels(c.listMonthly ?? c.monthly)}; ${discountHeadline(c.discount)})` : c.discount === null ? " (ללא הנחה)" : ""}`;
  const best = bestQuote(q);
  const out: Record<string, string> = {
    _quote: JSON.stringify(q),
    quote_best:
      best?.monthly != null ? `${best.name}: ${shekels(best.monthly)} לחודש${best.discount ? `, ${discountHeadline(best.discount)}` : ""}` : "לא חושב אוטומטית",
    quote_insurance_age: String(q.insuranceAge),
    quote_sum_insured: wholeShekels(q.sumInsured),
  };
  if (q.loanYears != null) out.quote_years_left = String(q.loanYears);
  // Which company's discount the lowest price rests on, and all of it: the row to mark on the proposal.
  if (best?.discount) out.quote_discount = `${best.name}: ${discountDetails(best.discount)}`;
  for (const c of q.quotes) out[`quote_${c.company}`] = line(c);
  return out;
}

/** The stored price check, or null for a submission without one. */
export function quoteFromAnswers(answers: Record<string, string | undefined>): MortgageQuote | null {
  const raw = answers._quote;
  if (!raw) return null;
  try {
    const q = JSON.parse(raw) as MortgageQuote;
    if (!q || !Array.isArray(q.quotes) || typeof q.sumInsured !== "number") return null;
    return q;
  } catch {
    return null;
  }
}

/** The lines the office email leads with. */
export function quoteEmailRows(q: MortgageQuote): Array<{ label: string; value: string }> {
  const best = bestQuote(q);
  const rows = [
    {
      label: "בדיקת מחיר: הזול ביותר",
      value:
        best?.monthly != null
          ? `${best.name}, ${shekels(best.monthly)} לחודש${best.discount ? `, ${discountHeadline(best.discount)}` : ""}${q.tie ? " (מחיר זהה גם בחברה נוספת)" : ""}`
          : "לא חושב אוטומטית",
    },
  ];
  for (const c of q.quotes) {
    rows.push({
      label: `${c.name}: ${c.plan}`,
      // A line each (the email keeps line breaks): the price, the discount it rests on, the rate.
      value:
        c.monthly !== null
          ? [
              `${shekels(c.monthly)} לחודש${c.discount ? ` (לפני הנחה ${shekels(c.listMonthly ?? c.monthly)})` : ""}`,
              ...(c.discount ? discountLines(c.discount) : ["ללא הנחה פעילה"]),
              `תעריף: ${rateLine(c)}`,
            ].join("\n")
          : (c.unavailable ?? "לא מחושב"),
    });
  }
  rows.push({
    label: "נתוני החישוב",
    value: `סכום ביטוח ${wholeShekels(q.sumInsured)}${q.loanYears != null ? ` · ${q.loanYears} שנים שנותרו למשכנתא` : ""} · גיל ${q.age} (גיל ביטוחי ${q.insuranceAge}) · ${personLabel(q)}`,
  });
  return rows;
}
