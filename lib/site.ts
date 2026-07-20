// Central business, contact, and legal facts for the site.
// Fill the empty regulatory fields with the agency's official data — components
// degrade gracefully (they simply omit the line) while a value is left empty,
// so the site is safe to deploy before the numbers are filled in.

export const SITE = {
  legalName: "גל אלמגור יערית — סוכנות לביטוח",
  brand: "סוכנות יערית · שלומי",
  group: "קבוצת גל אלמגור",
  tagline:
    "סוכנות ביטוח עצמאית בשלומי, חברה בקבוצת גל אלמגור — ליווי אישי לתיק הביטוח של משפחות ועסקים בגליל המערבי.",
  domain: "www.almagor-yaarit.com",
  url: "https://www.almagor-yaarit.com",

  // Regulatory identifiers — רשות שוק ההון, ביטוח וחיסכון / רשם החברות.
  // Leave empty to hide the line until you have the official number.
  licenseNo: "", // מספר רישיון סוכן/סוכנות ביטוח
  companyId: "", // ח.פ. / ע.מ.

  phoneDisplay: "053-337-7779",
  phoneE164: "+972533377779",
  waNumber: "972533377779",
  email: "office@almagor-yaarit.com",
  address: "קניון שלומי (תצפית), שלומי",
  hours: "ב׳–ה׳ 09:00–16:00 · ו׳ 09:00–13:00",

  // הצהרת נגישות
  a11yCoordinator: "", // שם רכז/ת הנגישות (אופציונלי — יוצג אם ימולא)
  a11yUpdated: "יולי 2026", // תאריך עדכון ההצהרה
} as const;

export const WA_HREF = `https://wa.me/${SITE.waNumber}`;
export const TEL_HREF = `tel:${SITE.phoneE164}`;
export const MAIL_HREF = `mailto:${SITE.email}`;

// Primary site navigation (homepage anchors).
export const NAV_LINKS = [
  { href: "/about", label: "אודות" },
  { href: "/#why", label: "למה אנחנו" },
  { href: "/#partners", label: "חברות הביטוח" },
  { href: "/#quote", label: "הצעת מחיר" },
  { href: "/#contact", label: "צור קשר" },
] as const;

// Legal / informational documents.
export const LEGAL_LINKS = [
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/terms", label: "תקנון ותנאי שימוש" },
  { href: "/accessibility", label: "הצהרת נגישות" },
] as const;

// Insurance areas shown in the footer (order matches the categories section).
export const FOOTER_INSURANCE = [
  { slug: "car", label: "ביטוח רכב" },
  { slug: "home", label: "ביטוח דירה ומשכנתא" },
  { slug: "business", label: "ביטוח עסקים" },
  { slug: "life", label: "ביטוחי חיים ובריאות" },
  { slug: "retirement", label: "תכנון פרישה" },
  { slug: "finance", label: "פיננסים" },
] as const;
