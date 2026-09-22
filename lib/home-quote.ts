// Home insurance estimate: a port of Hachshara's "מחולל דירה 14" rating
// workbook (מהדורה 1/05/2026), the generator the agency prices apartment
// policies with. Every rate, table and discount rule below is copied from that
// workbook cell for cell, and tests/home-quote.test.ts replays 45 input sets
// through the original spreadsheet's formulas to prove the two agree.
//
// It is an ESTIMATE. The generator itself says so: the premium is subject to
// underwriting, and the workbook is re-issued a few times a year. When Hachshara
// ships a new edition, update the numbers here and re-run the test.
//
// Pure: no React, no server, no I/O. Runs in the browser (the simulator page)
// and on the server (the request form re-computes the snapshot it stores).

export const APARTMENT_TYPES = [
  "קומת ביניים",
  "קומה אחרונה",
  "דירת גג (פנטאוס)",
  "דירת קרקע",
  "קומה א' על עמודים",
  "בית פרטי",
] as const;
export type ApartmentType = (typeof APARTMENT_TYPES)[number];

/** How the workbook classes each apartment type (sheet 2, C5:E10). */
const HOUSE_KIND: Record<ApartmentType, "בית משותף" | "בית פרטי"> = {
  "קומת ביניים": "בית משותף",
  "קומה אחרונה": "בית משותף",
  "דירת גג (פנטאוס)": "בית משותף",
  "דירת קרקע": "בית פרטי",
  "קומה א' על עמודים": "בית משותף",
  "בית פרטי": "בית פרטי",
};

export const WATER_ROUTES = ["שרברב הסדר", "שרברב פרטי", "ללא"] as const;
export type WaterRoute = (typeof WATER_ROUTES)[number];

export const THIRD_PARTY_LIMITS = [1500000, 2000000, 2500000, 3000000, 3500000, 4000000] as const;
export type ThirdPartyLimit = (typeof THIRD_PARTY_LIMITS)[number];

/** Business activities the generator prices (sheet 2, M5:M39). "אין" is free. */
export const BUSINESS_ACTIVITIES = [
  "אין",
  "אדריכלות",
  "אומן",
  "גניקולוג",
  "גרפיקאי",
  "חוג ביתי למבוגרים",
  "חוג דרמה ביתי",
  "חוג קרמיקה",
  "מורה",
  "מטפלת",
  "מנהלת חשבונות",
  "מספרה",
  "מעצב בגדים",
  "מעצב פנים",
  "מעצב תיקים",
  "מעצב תכשיטים",
  "מרפאה",
  "משרד",
  "מתווך",
  "סוחר בורסה",
  "סוכן ביטוח",
  "סטודיו",
  'עו"ד',
  "ערבי שירה",
  "פדיקוריסטית",
  "פסיגולוג/ית",
  "פסיכיאטר",
  "צלם ביתי",
  "קונדיטור",
  "קוסמטיקאית",
  "קלינאית תקשורת",
  "רב",
  "רואה חשבון",
  "רופא אלטרנטיבי",
  "רופא שיניים",
] as const;
export type BusinessActivity = (typeof BUSINESS_ACTIVITIES)[number];

export type AbroadCover = { days: number; sum: number };

export type HomeQuoteInput = {
  apartmentType: ApartmentType;
  areaM2: number;
  /** סכום ביטוח מבנה. 0 = no building cover. */
  buildingSum: number;
  /** סכום ביטוח תכולה. 0 = no contents cover. */
  contentsSum: number;
  earthquakeBuilding: boolean;
  earthquakeContents: boolean;
  waterRoute: WaterRoute;
  /** דירה מפוצלת: number of units, 0 = not split. */
  splitUnits: number;
  /** דירה מעץ ו/או בחלקו: cancels every discount. */
  wooden: boolean;
  /** Give up jewellery cover altogether (15% off the contents premium). */
  jewelryWaived: boolean;
  /** Total jewellery sum insured; 20% of contents is included free. */
  jewelrySum: number;
  thirdPartyLimit: ThirdPartyLimit;
  airbnb: boolean;
  sublet: boolean;
  parkingStackerSum: number;
  evChargerSum: number;
  poolSum: number;
  poolThirdParty: boolean;
  /** סכום ביטוח נוסף לרעידת אדמה בלבד (אופציה 1). */
  earthquakeExtraSum: number;
  /** סכום ביטוח נוסף לרעידת אדמה + אש (אופציה 3). */
  earthquakeFireExtraSum: number;
  bikesAbove5000Sum: number;
  businessActivity: BusinessActivity;
  fursSum: number;
  stampsSum: number;
  silverSum: number;
  cameraSum: number;
  religiousExtensions: boolean;
  instrumentsSum: number;
  laptopSum: number;
  abroadJewelry: AbroadCover;
  abroadCamera: AbroadCover;
  abroadLaptop: AbroadCover;
  pets: boolean;
  /** אקדח אישי ברישיון, up to 7,500. */
  gunSum: number;
  terror: boolean;
  toiletsSum: number;
  /** דירה שאינה תפוסה: days; the first 60 are free. */
  unoccupiedDays: number;
  /** פוטו-וולטאי, up to 150,000. */
  photovoltaicSum: number;
  solarHeaters: boolean;
};

export const BUILDING_PER_M2 = 7000; // the generator's own default (H12 = D11 * 7000)
export const MIN_BUILDING_PER_M2 = 6500; // below this the generator asks to correct the sum
export const JEWELRY_FREE_SHARE = 0.2;
export const JEWELRY_MAX_SHARE = 0.45;
export const PHOTOVOLTAIC_MAX = 150000;
export const GUN_MAX = 7500;
export const BUILDING_BLOCK = 10000000;

export function defaultBuildingSum(areaM2: number): number {
  return Math.max(0, Math.round(areaM2)) * BUILDING_PER_M2;
}

export const DEFAULT_INPUT: HomeQuoteInput = {
  apartmentType: "קומת ביניים",
  areaM2: 100,
  buildingSum: 700000,
  contentsSum: 250000,
  earthquakeBuilding: true,
  earthquakeContents: true,
  waterRoute: "שרברב הסדר",
  splitUnits: 0,
  wooden: false,
  jewelryWaived: false,
  jewelrySum: 50000,
  thirdPartyLimit: 1500000,
  airbnb: false,
  sublet: false,
  parkingStackerSum: 0,
  evChargerSum: 0,
  poolSum: 0,
  poolThirdParty: false,
  earthquakeExtraSum: 0,
  earthquakeFireExtraSum: 0,
  bikesAbove5000Sum: 0,
  businessActivity: "אין",
  fursSum: 0,
  stampsSum: 0,
  silverSum: 0,
  cameraSum: 0,
  religiousExtensions: false,
  instrumentsSum: 0,
  laptopSum: 0,
  abroadJewelry: { days: 0, sum: 0 },
  abroadCamera: { days: 0, sum: 0 },
  abroadLaptop: { days: 0, sum: 0 },
  pets: false,
  gunSum: 0,
  terror: false,
  toiletsSum: 0,
  unoccupiedDays: 0,
  photovoltaicSum: 0,
  solarHeaters: false,
};

const RATE = {
  building: 0.00029,
  contents: 0.003,
  earthquake: 0.00085,
  jewelryExtra: 0.015,
  parking: 0.00085,
  ev: 0.01,
  earthquakeExtra: 0.00065,
  earthquakeFireExtra: 0.00078,
  bikes: 0.05,
  furs: 0.02,
  stamps: 0.02,
  silver: 0.02,
  camera: 0.025,
  instruments: 0.02,
  laptop: 0.05,
  abroad: 0.05,
  toilets: 0.015,
  unoccupied: 0.0005,
} as const;

const FLAT = {
  businessActivity: 290,
  airbnb: 490,
  sublet: 150,
  poolThirdParty: 300,
  religious: 150,
  pets: 120,
  gun: 80,
  terror: 150,
  solarHeaters: 60,
  policyFee: 7,
  generalDeductible: 465,
  waterFalseCall: 150,
} as const;

/** Third-party liability limit → annual premium (sheet 2, C35:D40). */
const THIRD_PARTY_PREMIUM: Record<ThirdPartyLimit, number> = {
  1500000: 0,
  2000000: 100,
  2500000: 200,
  3000000: 300,
  3500000: 400,
  4000000: 500,
};

/**
 * Minimum annual premium by policy make-up and apartment type (sheet 2,
 * C109:G126). Code 1 = building only, 2 = contents only, 3 = both.
 */
const MIN_PREMIUM: Record<ApartmentType, [number, number, number]> = {
  "קומת ביניים": [200, 300, 200],
  "קומה אחרונה": [460, 390, 550],
  "דירת גג (פנטאוס)": [450, 410, 720],
  "דירת קרקע": [450, 410, 720],
  "קומה א' על עמודים": [200, 300, 200],
  "בית פרטי": [450, 410, 720],
};

/** Excel's approximate VLOOKUP: the row with the largest lower bound ≤ value. */
function tier(value: number, rows: readonly (readonly [number, number])[]): number {
  let out = rows[0][1];
  for (const [from, v] of rows) if (value >= from) out = v;
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** נזקי מים premium (sheet 2, C45:I62). */
function waterPremium(houseKind: "בית משותף" | "בית פרטי", route: WaterRoute, building: number): number {
  if (route === "ללא") return 0;
  if (route === "שרברב הסדר") {
    return houseKind === "בית משותף"
      ? tier(building, [[0, 340], [999999, 340], [1000001, 360]])
      : tier(building, [[0, 400], [1500001, 800]]);
  }
  return houseKind === "בית משותף"
    ? tier(building, [[0, 450], [650001, 650], [1500001, clamp(building * 0.001, 450, 1000)]])
    : clamp(building * 0.001, 650, 2300);
}

/** נזקי מים deductible (sheet 2, C66:F81). */
function waterDeductible(route: WaterRoute, building: number, sharedUnder1_8M: boolean): number | null {
  if (route === "ללא") return null;
  if (route === "שרברב הסדר") {
    return tier(building, [
      [0, 600],
      [500001, 700],
      [750001, 750],
      [1000001, sharedUnder1_8M ? 800 : Math.min(building * 0.001, 3000)],
    ]);
  }
  return tier(building, [[0, 1000], [500001, 1000], [750001, 1000], [1000001, Math.min(building * 0.002, 5000)]]);
}

export type QuoteLine = {
  key: string;
  label: string;
  /** Positive = charged, negative = discount. */
  amount: number;
};

export type HomeQuoteResult = {
  /** Set when the generator refuses to price this at all. Totals are zero then. */
  blocked: string | null;
  /** Charged items and discounts, in the generator's order, zero lines dropped. */
  lines: QuoteLine[];
  /** פרמיה לחישוב: the base the minimum is checked against. */
  premiumBase: number;
  minimumPremium: number;
  /** Top-up to the minimum, when the base falls short. */
  minimumTopUp: number;
  /** השלמת סעיפים: earthquake, third party and the items priced outside the base. */
  completion: number;
  policyFee: number;
  /** סה"כ לשנה, ב-3 תשלומים ללא ריבית והצמדה. */
  total: number;
  deductibles: {
    general: number;
    /** Above this damage amount the general deductible is waived. */
    generalWaivedAbove: number;
    water: number | null;
    waterFalseCall: number;
    earthquakePercent: number;
  };
  /** Covers that ride along at no extra charge. */
  included: string[];
  warnings: string[];
  /** The workbook's intermediate cells, for the tests. */
  cells: Record<string, number>;
};

const nz = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function computeHomeQuote(raw: HomeQuoteInput): HomeQuoteResult {
  const inp: HomeQuoteInput = { ...DEFAULT_INPUT, ...raw };
  const houseKind = HOUSE_KIND[inp.apartmentType] ?? "בית משותף";
  const shared = houseKind === "בית משותף";
  const airbnbCode = shared ? 1 : 0;

  const building = nz(inp.buildingSum);
  const contents = nz(inp.contentsSum);
  const warnings: string[] = [];

  // O1: the generator shuts at ten million of building cover.
  const blocked = building >= BUILDING_BLOCK ? "סכום ביטוח מבנה של 10 מיליון ₪ ומעלה מתומחר על ידי חתם, לא במחשבון." : null;
  const O1 = blocked ? 0 : 1;
  const M2 = building > 0 ? 1 : 0; // building cover in force
  const M3 = contents > 0 ? 1 : 0; // contents cover in force
  const eqB = inp.earthquakeBuilding && building > 0;
  const eqC = inp.earthquakeContents && contents > 0;

  const J12 = building * RATE.building * O1;
  const J17 = (eqB ? building : 0) * RATE.earthquake * O1;
  const J24 = contents * RATE.contents * O1;
  const J25 = (eqC ? contents : 0) * RATE.earthquake * M3 * O1;

  const E62 = waterPremium(houseKind, inp.waterRoute, building);
  const J21 = E62 * M2;
  const split = nz(inp.splitUnits) >= 2 ? Math.round(inp.splitUnits) : 0;
  const J18 = (split ? (inp.waterRoute === "שרברב הסדר" ? (J21 / 2) * (split - 1) : 0) : 0) * M2 * O1;

  // Jewellery: 20% of contents rides free; more is charged; airbnb/sublet excludes it.
  const jewelryIncluded = inp.jewelryWaived ? 0 : contents * JEWELRY_FREE_SHARE; // H26
  const jewelryTotal = inp.jewelryWaived ? 0 : nz(inp.jewelrySum); // H27
  const S41 = Math.max(0, jewelryTotal - contents * JEWELRY_FREE_SHARE);
  const K27 = inp.airbnb || inp.sublet ? 0 : 1;
  const J27 = S41 * RATE.jewelryExtra * M3 * K27;

  const J33 = THIRD_PARTY_PREMIUM[inp.thirdPartyLimit] ?? 0;
  const J36 = inp.airbnb ? FLAT.airbnb * airbnbCode : 0;
  const J37 = inp.sublet ? FLAT.sublet : 0;
  const J38 = nz(inp.parkingStackerSum) * RATE.parking;
  const J39 = nz(inp.evChargerSum) * RATE.ev;
  const J40 = nz(inp.poolSum) * RATE.building;
  const J41 = inp.poolThirdParty ? FLAT.poolThirdParty : 0;
  const J42 = nz(inp.earthquakeExtraSum) * RATE.earthquakeExtra;
  const J44 = nz(inp.earthquakeFireExtraSum) * RATE.earthquakeFireExtra;
  const J46 = nz(inp.bikesAbove5000Sum) * RATE.bikes;

  // Policy make-up code: 1 building only, 2 contents only, 3 both (sheet 2, D130:E132).
  const policyCode = (building > 0 ? 1 : 0) + (contents > 0 ? 2 : 0);
  const J47 = inp.businessActivity !== "אין" && policyCode !== 1 ? FLAT.businessActivity : 0;
  const J48 = nz(inp.fursSum) * RATE.furs;
  const J49 = nz(inp.stampsSum) * RATE.stamps;
  const J50 = nz(inp.silverSum) * RATE.silver;
  const J51 = nz(inp.cameraSum) * RATE.camera;
  const J52 = inp.religiousExtensions ? FLAT.religious : 0;
  const J59 = nz(inp.instrumentsSum) * RATE.instruments;
  const J60 = nz(inp.laptopSum) * RATE.laptop;
  const abroad = (c: AbroadCover) => ((nz(c.sum) * RATE.abroad) / 365) * nz(c.days);
  const J61 = abroad(inp.abroadJewelry);
  const J62 = abroad(inp.abroadCamera);
  const J63 = abroad(inp.abroadLaptop);
  const J64 = inp.pets ? FLAT.pets : 0;
  const J65 = nz(inp.gunSum) > 0 ? FLAT.gun : 0;
  const J66 = inp.terror ? FLAT.terror : 0;
  const J67 = nz(inp.toiletsSum) * RATE.toilets;
  const overDays = nz(inp.unoccupiedDays) - 60;
  const J68 = ((building + contents) * RATE.unoccupied / 365) * (overDays > 1 ? overDays : 0);
  const pv = nz(inp.photovoltaicSum);
  const J69 = pv <= PHOTOVOLTAIC_MAX ? pv * RATE.building : 0;
  const J70 = inp.solarHeaters ? FLAT.solarHeaters : 0;

  // Discounts (sheet 2, rows 83-100).
  const G85 = inp.wooden ? 0 : 1;
  const H99 = J12 > 10 ? 1 : 0;
  const H98 = J24 > 10 ? 1 : 0;
  const H97 = (eqB ? 1 : 0) * H99 + (eqC ? 1 : 0) * H98;
  const baseDiscount = shared ? 0.9 : 0.5;
  const H84 = (H97 > 0 ? baseDiscount : 0) * G85; // building discount
  const H90 = (H97 > 0 ? baseDiscount : 0) * G85; // contents discount
  const G89 = (inp.waterRoute !== "שרברב הסדר" ? 1 : 0) + (split ? 1 : 0) > 1 ? 0 : 1;
  const sharedUnder1_8M = shared && building <= 1800000; // H72 = 2
  const E93 = !shared ? 0.08 : sharedUnder1_8M ? 0.3 : 0.15;
  const E98 = !shared ? 0.08 : sharedUnder1_8M ? 0.5 : 0.35;
  const H91 = (eqB ? E93 : 0) * H99 * G85 * G89;
  // The workbook computes a contents rate (E98) and then does not use it:
  // H92 reads E93, the building rate, for the contents discount as well.
  // Ported as is, because the generator's price is the price.
  const H92 = (eqC ? E93 : 0) * H98 * G85 * G89;

  const J72 = J12 * H84;
  const J73 = J17 * H91;
  const I75 = jewelryIncluded === 0 ? 0.15 : 0;
  const J75 = J24 * I75;
  const J74 = (J24 - J75) * H90;
  const J76 = J25 * H92;

  const J85 =
    J12 + J18 + J21 + J24 + J27 - J72 - J74 - J75 +
    J46 + J47 + J48 + J49 + J50 + J51 + J59 + J60 + J61 + J62 + J63 + J65 + J64 + J66 + J67 + J68 +
    J36 + J37 + J38 + J39 + J40 + J52;
  const D137 = policyCode ? MIN_PREMIUM[inp.apartmentType][policyCode - 1] : 0;
  const J86 = J85 < D137 ? D137 : 0;
  const K86 = J86 === 0 ? 0 : J86 - J85;
  const J87 = J17 + J25 + J42 + J44 + J70 + J69 - J73 - J76 + J33 + J41;
  const J89 = (J85 + K86 + J87 + FLAT.policyFee) * O1;

  // Warnings the generator prints beside the inputs.
  if (building > 0 && inp.areaM2 > 0 && building < inp.areaM2 * MIN_BUILDING_PER_M2) {
    warnings.push(`סכום ביטוח המבנה נמוך מהמינימום של ${MIN_BUILDING_PER_M2.toLocaleString("he-IL")} ₪ למ"ר.`);
  }
  if (contents > 0 && jewelryTotal > contents * JEWELRY_MAX_SHARE) {
    warnings.push("סכום התכשיטים חורג מ-45% מסכום ביטוח התכולה ודורש אישור חתם.");
  }
  if (shared && inp.airbnb && inp.sublet) {
    warnings.push("לא ניתן לבטח AIRBNB וסאבלט יחד, רק אחד מהם.");
  }
  if (pv > PHOTOVOLTAIC_MAX) {
    warnings.push(`פוטו-וולטאי: ניתן לבטח עד ${PHOTOVOLTAIC_MAX.toLocaleString("he-IL")} ₪, הסכום שהוזן לא נכלל.`);
  }
  if (nz(inp.gunSum) > GUN_MAX) {
    warnings.push(`אקדח אישי ברישיון: סכום הביטוח המרבי הוא ${GUN_MAX.toLocaleString("he-IL")} ₪.`);
  }
  if ((J42 > 0 && nz(inp.earthquakeExtraSum) < building) || (J44 > 0 && nz(inp.earthquakeFireExtraSum) < building)) {
    warnings.push("סכום ביטוח נוסף לרעידת אדמה: המינימום הוא 100% מסכום ביטוח המבנה.");
  }
  if (J27 > 0 && !inp.jewelryWaived && K27 === 0) {
    /* jewellery surcharge waived by airbnb/sublet: nothing to say */
  }

  const line = (key: string, label: string, amount: number): QuoteLine => ({ key, label, amount });
  const lines: QuoteLine[] = [
    line("building", "ביטוח מבנה", J12),
    line("buildingDiscount", "הנחת מבנה", -J72),
    line("earthquakeBuilding", "רעידת אדמה למבנה", J17),
    line("earthquakeBuildingDiscount", "הנחת רעידת אדמה למבנה", -J73),
    line("water", "נזקי מים וצנרת", J21),
    line("split", "דירה מפוצלת", J18),
    line("contents", "ביטוח תכולה", J24),
    line("jewelryWaiver", "הנחת ויתור על תכשיטים", -J75),
    line("contentsDiscount", "הנחת תכולה", -J74),
    line("earthquakeContents", "רעידת אדמה לתכולה", J25),
    line("earthquakeContentsDiscount", "הנחת רעידת אדמה לתכולה", -J76),
    line("jewelryExtra", "תכשיטים מעל 20% מהתכולה", J27),
    line("thirdParty", "הרחבת גבול אחריות כלפי צד שלישי", J33),
    line("airbnb", "בסט למשכיר (AIRBNB)", J36),
    line("sublet", "בסט לסאבלט", J37),
    line("parking", "מכפיל חניה", J38),
    line("ev", "מטען לרכב חשמלי", J39),
    line("pool", "בריכה", J40),
    line("poolThirdParty", "צד שלישי לבריכת שחייה", J41),
    line("earthquakeExtra", "סכום נוסף לרעידת אדמה בלבד", J42),
    line("earthquakeFireExtra", "סכום נוסף לרעידת אדמה ואש", J44),
    line("bikes", "אופניים מעל 5,000 ₪", J46),
    line("business", "פעילות עסקית בדירה", J47),
    line("furs", "פרוות", J48),
    line("stamps", "בולים", J49),
    line("silver", "כלי כסף", J50),
    line("camera", "ציוד צילום", J51),
    line("religious", "הרחבות למגזר הדתי", J52),
    line("instruments", "כלי נגינה", J59),
    line("laptop", "מחשב נייד / טאבלט", J60),
    line("abroadJewelry", "תכשיטים בחו\"ל", J61),
    line("abroadCamera", "ציוד צילום בחו\"ל", J62),
    line("abroadLaptop", "מחשב בחו\"ל", J63),
    line("pets", "חיות מחמד", J64),
    line("gun", "אקדח אישי ברישיון", J65),
    line("terror", "טרור", J66),
    line("toilets", "שבר אסלות", J67),
    line("unoccupied", "דירה שאינה תפוסה מעל 60 יום", J68),
    line("photovoltaic", "פוטו-וולטאי", J69),
    line("solarHeaters", "דודי שמש", J70),
  ].filter((l) => Math.abs(l.amount) >= 0.005);

  const included: string[] = [];
  if (building > 0) {
    included.push("כל הסיכונים למבנה עד 30,000 ₪", "שמשות חיצוניות עד 10% מסכום ביטוח המבנה", "דיור חלופי עד 20 חודש");
  }
  if (contents > 0) {
    included.push("כל הסיכונים לתכולה עד 30,000 ₪", "אופניים עד 5,000 ₪");
    if (!inp.jewelryWaived) included.push("תכשיטים עד 20% מסכום ביטוח התכולה");
  }
  included.push(`אחריות כלפי צד שלישי עד ${inp.thirdPartyLimit.toLocaleString("he-IL")} ₪`, "חבות מעבידים לעובדי משק בית");

  return {
    blocked,
    lines: blocked ? [] : lines,
    premiumBase: blocked ? 0 : J85,
    minimumPremium: D137,
    minimumTopUp: blocked ? 0 : K86,
    completion: blocked ? 0 : J87,
    policyFee: blocked ? 0 : FLAT.policyFee,
    total: blocked ? 0 : J89,
    deductibles: {
      general: FLAT.generalDeductible,
      generalWaivedAbove: 2500,
      water: waterDeductible(inp.waterRoute, building, sharedUnder1_8M),
      waterFalseCall: FLAT.waterFalseCall,
      earthquakePercent: 10,
    },
    included,
    warnings,
    cells: {
      J12, J17, J18, J21, J24, J25, J27, J33, J36, J37, J38, J39, J40, J41, J42, J44, J46, J47, J48, J49, J50, J51, J52,
      J59, J60, J61, J62, J63, J64, J65, J66, J67, J68, J69, J70, J72, J73, J74, J75, J76, J85, J86, K86, J87, J89, D137,
      E62, H84, H90, H91, H92, E93, E98,
      E81: waterDeductible(inp.waterRoute, building, sharedUnder1_8M) ?? 0,
    },
  };
}

/** Whole shekels, as the customer will read it. */
export function roundShekel(v: number): number {
  return Math.round(v);
}

/** Type guard for values coming off a URL or a stored snapshot. */
export function isApartmentType(v: unknown): v is ApartmentType {
  return typeof v === "string" && (APARTMENT_TYPES as readonly string[]).includes(v);
}
export function isWaterRoute(v: unknown): v is WaterRoute {
  return typeof v === "string" && (WATER_ROUTES as readonly string[]).includes(v);
}
export function isThirdPartyLimit(v: unknown): v is ThirdPartyLimit {
  return typeof v === "number" && (THIRD_PARTY_LIMITS as readonly number[]).includes(v);
}
export function isBusinessActivity(v: unknown): v is BusinessActivity {
  return typeof v === "string" && (BUSINESS_ACTIVITIES as readonly string[]).includes(v);
}

/**
 * Rebuild a full input from anything: a parsed URL snapshot, a stored JSON
 * blob, a partial object. Unknown or malformed values fall back to the
 * defaults, so a tampered link can only ever produce a different estimate,
 * never a crash.
 */
export function normalizeInput(v: unknown): HomeQuoteInput {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (k: string, max = 1e9) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : (DEFAULT_INPUT as unknown as Record<string, number>)[k] ?? 0;
  };
  const bool = (k: string) => (typeof o[k] === "boolean" ? (o[k] as boolean) : (DEFAULT_INPUT as unknown as Record<string, boolean>)[k]);
  const cover = (k: string): AbroadCover => {
    const c = (o[k] && typeof o[k] === "object" ? o[k] : {}) as Record<string, unknown>;
    const d = Number(c.days);
    const s = Number(c.sum);
    return { days: Number.isFinite(d) ? Math.min(Math.max(Math.round(d), 0), 365) : 0, sum: Number.isFinite(s) ? Math.min(Math.max(s, 0), 1e9) : 0 };
  };
  const apartmentType = isApartmentType(o.apartmentType) ? o.apartmentType : DEFAULT_INPUT.apartmentType;
  const areaM2 = num("areaM2", 5000);
  return {
    apartmentType,
    areaM2,
    buildingSum: "buildingSum" in o ? num("buildingSum") : defaultBuildingSum(areaM2),
    contentsSum: num("contentsSum"),
    earthquakeBuilding: bool("earthquakeBuilding"),
    earthquakeContents: bool("earthquakeContents"),
    waterRoute: isWaterRoute(o.waterRoute) ? o.waterRoute : DEFAULT_INPUT.waterRoute,
    splitUnits: Math.round(num("splitUnits", 11)),
    wooden: bool("wooden"),
    jewelryWaived: bool("jewelryWaived"),
    jewelrySum: "jewelrySum" in o ? num("jewelrySum") : num("contentsSum") * JEWELRY_FREE_SHARE,
    thirdPartyLimit: isThirdPartyLimit(Number(o.thirdPartyLimit)) ? (Number(o.thirdPartyLimit) as ThirdPartyLimit) : DEFAULT_INPUT.thirdPartyLimit,
    airbnb: bool("airbnb"),
    sublet: bool("sublet"),
    parkingStackerSum: num("parkingStackerSum"),
    evChargerSum: num("evChargerSum"),
    poolSum: num("poolSum"),
    poolThirdParty: bool("poolThirdParty"),
    earthquakeExtraSum: num("earthquakeExtraSum"),
    earthquakeFireExtraSum: num("earthquakeFireExtraSum"),
    bikesAbove5000Sum: num("bikesAbove5000Sum"),
    businessActivity: isBusinessActivity(o.businessActivity) ? o.businessActivity : "אין",
    fursSum: num("fursSum"),
    stampsSum: num("stampsSum"),
    silverSum: num("silverSum"),
    cameraSum: num("cameraSum"),
    religiousExtensions: bool("religiousExtensions"),
    instrumentsSum: num("instrumentsSum"),
    laptopSum: num("laptopSum"),
    abroadJewelry: cover("abroadJewelry"),
    abroadCamera: cover("abroadCamera"),
    abroadLaptop: cover("abroadLaptop"),
    pets: bool("pets"),
    gunSum: num("gunSum", 1e6),
    terror: bool("terror"),
    toiletsSum: num("toiletsSum"),
    unoccupiedDays: Math.round(num("unoccupiedDays", 365)),
    photovoltaicSum: num("photovoltaicSum"),
    solarHeaters: bool("solarHeaters"),
  };
}

// ── Snapshot encoding: the simulator hands its state to the request form in
// the URL, and the request stores it beside the answers. base64url of the
// JSON, nothing signed: the estimate is recomputed from the inputs wherever it
// is read, so the only thing a tampered snapshot can change is the estimate,
// which the agency re-prices anyway.

// No Buffer here on purpose: the browser bundle ships a Buffer shim that does
// not know "base64url", and this runs on both sides. TextEncoder + btoa exist
// everywhere this code runs (Node 18+, every current browser).
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeSnapshot(input: HomeQuoteInput): string {
  return toBase64Url(JSON.stringify(input));
}

export function decodeSnapshot(raw: string | null | undefined): HomeQuoteInput | null {
  if (!raw || raw.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const obj = JSON.parse(fromBase64Url(raw));
    if (!obj || typeof obj !== "object") return null;
    return normalizeInput(obj);
  } catch {
    return null;
  }
}
