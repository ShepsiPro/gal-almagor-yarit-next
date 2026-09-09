// Definitions for the standalone "fill link" forms served at /forms/<slug>.
//
// MVP contract — nothing is persisted on the server. A submission is validated,
// rendered into an email and sent to the agency mailbox; the mailbox is the
// only record. Drafts live in the visitor's sessionStorage so a refresh
// mid-fill does not wipe typed answers (files cannot be restored that way).
//
// To add a form, append a FormDef to FORMS — no other file needs to change.

export type FieldType =
  | "text"
  | "tel"
  | "email"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox" // with options → multi-select group
  | "id" // Israeli ת.ז., check-digit validated
  | "file"
  | "consent"; // single required opt-in

export type FormField = {
  /** Key used in the email body and in the sessionStorage draft. */
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly string[];
  /** file: allow picking several files for this one field. */
  multiple?: boolean;
  /** Render at half width on desktop. */
  half?: boolean;
};

export type FormSection = {
  title: string;
  description?: string;
  fields: readonly FormField[];
};

export type FormDef = {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  sections: readonly FormSection[];
};

const INSURERS = [
  "איילון",
  "הכשרה ביטוח ופיננסים",
  "הפניקס",
  "הראל",
  "כלל ביטוח ופיננסים",
  "מגדל ביטוח ופיננסים",
  "מנורה מבטחים",
  "שלמה ביטוח",
  "אחר / לא ידוע",
] as const;

const CONSENT_FIELD: FormField = {
  name: "consent",
  label:
    "אני מאשר/ת מסירת הפרטים והמסמכים לסוכנות לצורך טיפול בפנייה, בהתאם למדיניות הפרטיות.",
  type: "consent",
  required: true,
};

export const FORMS: readonly FormDef[] = [
  {
    slug: "car",
    eyebrow: "טופס פרטים",
    title: "ביטוח רכב — איסוף פרטים",
    intro:
      "מילוי הטופס לוקח כשלוש דקות ומאפשר לנו להשוות עבורכם הצעות מכל חברות הביטוח. אפשר לצרף צילומים של הרישיונות והפוליסה הנוכחית — זה מקצר את התהליך משמעותית.",
    submitLabel: "שליחת הפרטים לסוכנות",
    successTitle: "הפרטים התקבלו",
    successBody:
      "קיבלנו את הטופס ונחזור אליכם עם הצעות מסודרות תוך יום עסקים אחד. אם משהו דחוף — אפשר להתקשר אלינו ישירות.",
    sections: [
      {
        title: "פרטי המבוטח",
        fields: [
          { name: "fullName", label: "שם מלא", type: "text", required: true, placeholder: "ישראל ישראלי", half: true },
          { name: "idNumber", label: "תעודת זהות", type: "id", required: true, placeholder: "9 ספרות", half: true },
          { name: "phone", label: "טלפון נייד", type: "tel", required: true, placeholder: "050-0000000", half: true },
          { name: "email", label: "דוא״ל", type: "email", placeholder: "you@example.com", half: true },
          { name: "address", label: "כתובת מגורים", type: "text", placeholder: "רחוב, מספר, עיר" },
        ],
      },
      {
        title: "פרטי הרכב",
        fields: [
          { name: "plate", label: "מספר רישוי", type: "text", required: true, placeholder: "12-345-67", half: true },
          { name: "year", label: "שנת ייצור", type: "number", placeholder: "2019", half: true },
          { name: "model", label: "יצרן ודגם", type: "text", placeholder: "מאזדה 3", half: true },
          {
            name: "ownership",
            label: "סוג הבעלות",
            type: "select",
            options: ["פרטית", "חברה", "ליסינג", "מונית / מסחרי"],
            half: true,
          },
        ],
      },
      {
        title: "נהגים והיסטוריית תביעות",
        description: "הנתונים האלה משפיעים ישירות על הפרמיה, לכן חשוב שיהיו מדויקים.",
        fields: [
          { name: "youngestDriverAge", label: "גיל הנהג הצעיר ביותר", type: "number", placeholder: "24", half: true },
          { name: "licenseSeniority", label: "ותק רישיון (שנים)", type: "number", placeholder: "6", half: true },
          {
            name: "claims",
            label: "תביעות בשלוש השנים האחרונות",
            type: "radio",
            required: true,
            options: ["אין תביעות", "תביעה אחת", "שתיים או יותר"],
          },
          { name: "currentInsurer", label: "חברת הביטוח הנוכחית", type: "select", options: INSURERS, half: true },
          { name: "policyEnd", label: "תאריך סיום הפוליסה", type: "date", half: true },
        ],
      },
      {
        title: "הכיסוי המבוקש",
        fields: [
          {
            name: "coverage",
            label: "סוג הביטוח",
            type: "select",
            required: true,
            options: ["ביטוח מקיף", "צד שלישי", "חובה בלבד", "עדיין לא החלטתי — רוצה ייעוץ"],
          },
          {
            name: "extras",
            label: "הרחבות שמעניינות אתכם",
            type: "checkbox",
            options: ["שירותי דרך וגרירה", "כיסוי שמשות", "רכב חלופי", "כיסוי מערכת שמע", "נהג צעיר / חדש"],
          },
        ],
      },
      {
        title: "מסמכים",
        description:
          "אופציונלי אבל מומלץ. צילום מהטלפון מספיק — התמונות מוקטנות אוטומטית לפני השליחה.",
        fields: [
          { name: "docVehicleLicense", label: "רישיון רכב", type: "file" },
          { name: "docDriverLicense", label: "רישיון נהיגה", type: "file", multiple: true },
          { name: "docCurrentPolicy", label: "הפוליסה הנוכחית", type: "file", multiple: true },
        ],
      },
      {
        title: "הערות ואישור",
        fields: [
          { name: "notes", label: "הערות (אופציונלי)", type: "textarea", placeholder: "כל דבר שחשוב שנדע…" },
          CONSENT_FIELD,
        ],
      },
    ],
  },

  {
    slug: "claim",
    eyebrow: "טופס תביעה",
    title: "דיווח על אירוע ביטוחי",
    intro:
      "מלאו את פרטי האירוע וצרפו את התיעוד שברשותכם. ככל שהדיווח מפורט ומגובה יותר — כך הטיפול מול חברת הביטוח מהיר יותר.",
    submitLabel: "שליחת הדיווח",
    successTitle: "הדיווח נשלח",
    successBody:
      "הדיווח התקבל אצלנו. נבדוק את הפרטים מול חברת הביטוח ונעדכן אתכם בהמשך הטיפול.",
    sections: [
      {
        title: "פרטי המבוטח",
        fields: [
          { name: "fullName", label: "שם מלא", type: "text", required: true, half: true },
          { name: "idNumber", label: "תעודת זהות", type: "id", required: true, half: true },
          { name: "phone", label: "טלפון נייד", type: "tel", required: true, placeholder: "050-0000000", half: true },
          { name: "email", label: "דוא״ל", type: "email", placeholder: "you@example.com", half: true },
        ],
      },
      {
        title: "פרטי הפוליסה",
        fields: [
          { name: "insurer", label: "חברת הביטוח", type: "select", required: true, options: INSURERS, half: true },
          { name: "policyNumber", label: "מספר פוליסה", type: "text", half: true },
          {
            name: "branch",
            label: "ענף הביטוח",
            type: "select",
            required: true,
            options: ["רכב", "דירה", "עסק", "בריאות", "חיים", "אחר"],
          },
        ],
      },
      {
        title: "פרטי האירוע",
        fields: [
          { name: "eventDate", label: "תאריך האירוע", type: "date", required: true, half: true },
          { name: "eventPlace", label: "מקום האירוע", type: "text", placeholder: "עיר / כתובת", half: true },
          {
            name: "description",
            label: "תיאור האירוע",
            type: "textarea",
            required: true,
            placeholder: "מה קרה, מתי, מי היה מעורב ומה הנזק…",
          },
          { name: "police", label: "האם דווח למשטרה?", type: "radio", options: ["כן", "לא"], half: true },
          { name: "policeRef", label: "מספר אסמכתא (אם יש)", type: "text", half: true },
        ],
      },
      {
        title: "תיעוד",
        description: "צילומי נזק, קבלות, הצעות מחיר או אישור משטרה.",
        fields: [
          { name: "docDamage", label: "צילומי הנזק", type: "file", multiple: true },
          { name: "docReceipts", label: "קבלות / הצעות מחיר", type: "file", multiple: true },
          { name: "docOther", label: "מסמכים נוספים", type: "file", multiple: true },
        ],
      },
      { title: "אישור", fields: [CONSENT_FIELD] },
    ],
  },
] as const;

export const FORM_SLUGS = FORMS.map((f) => f.slug);

export function getForm(slug: string): FormDef | undefined {
  return FORMS.find((f) => f.slug === slug);
}

/** Every field of a form, flattened — used by both the renderer and the API. */
export function allFields(form: FormDef): FormField[] {
  return form.sections.flatMap((s) => [...s.fields]);
}

/**
 * Israeli ID check digit (Luhn over 9 digits, right-padded with zeros).
 * Rejects the all-zero string, which otherwise passes the checksum.
 */
export function isValidIsraeliId(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 9) return false;
  const padded = digits.padStart(9, "0");
  if (padded === "000000000") return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(padded[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Upload limits — enforced on the client (before send) and again in the API.
//
// With no storage provider, every file travels inside the email itself, so the
// ceiling is the receiving mailbox's attachment limit (~25MB on most providers)
// minus base64 overhead (~33%). 12MB of raw bytes lands at roughly 16MB on the
// wire, which is comfortably inside that. Images are downscaled in the browser
// before they ever count against this, so the cap is rarely reached in practice.
// ---------------------------------------------------------------------------

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const MAX_FILES_PER_FIELD = 6;

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** `accept` attribute for file inputs — HEIC comes off iPhones by default. */
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
