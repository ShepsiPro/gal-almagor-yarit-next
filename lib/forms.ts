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
  | "time"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox" // with options → multi-select group
  | "id" // Israeli ת.ז. / ח.פ., check-digit validated
  | "file"
  | "consent" // single required opt-in
  | "signature" // drawn by hand (finger or mouse); posted as a PNG file
  | "statement"; // static legal text, no input

/**
 * Show this field only while another field holds (or does not hold) a value.
 * A hidden field is never required and never submitted — `isFieldVisible` is
 * the single source of truth and runs on BOTH the client and the API, so the
 * two can never disagree about what was required.
 */
export type ShowWhen = {
  field: string;
  equals?: string;
  notEquals?: string;
  in?: readonly string[];
};

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
  /**
   * What this field MEANS to the CRM, whatever this particular form chose to
   * call it. Each form names its fields to suit its own document — the claim
   * form says `fullName`, the declaration says `insured_name` — so anything
   * outside the form definition must ask for the meaning, never the spelling.
   * Hardcoding a field name is how the declaration form spent its first week
   * filing customer cards with no name on them.
   */
  identity?: "name";
  /** May be pre-filled from a plain ?query= parameter on the form's link. */
  prefillable?: boolean;
  /** number: bounds, validated on both sides. */
  min?: number;
  max?: number;
  /** statement: the text to render. */
  body?: string;
  /** Conditional visibility — see ShowWhen. */
  showWhen?: ShowWhen;
  /**
   * checkbox groups: sets of options that cannot be chosen together. Picking
   * one clears the others in its set (מקיף and צד ג׳ are alternatives, not
   * additions — an insurer will not write both on one vehicle).
   */
  exclusive?: readonly (readonly string[])[];
};

export type FormSection = {
  title: string;
  description?: string;
  fields: readonly FormField[];
};

export type FormAudience = "customer" | "agency";
export type CaseRole = "request" | "offer" | "answer";

export type FormDef = {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  sections: readonly FormSection[];
  /**
   * Who fills it. An "agency" form is filled in the back-office (posted to
   * /admin/forms/<slug> under the admin session): it is never listed on the
   * public index and never accepted from the public API. Default "customer".
   */
  audience?: FormAudience;
  /**
   * Only reachable through a signed link the agency sends: the page shows a
   * "link expired" notice without a valid token and the API refuses the post.
   */
  requiresToken?: boolean;
  /** The multi-form case this form is a stage of (see CASES). */
  caseKey?: string;
  caseRole?: CaseRole;
};

/**
 * A case is one file made of three forms: the customer's request opens it,
 * the agency's offer is filed against it, and the customer's signed answer
 * closes it. lib/home-case.ts does the work; this is just the wiring.
 */
export type CaseDef = {
  key: string;
  title: string;
  request: string;
  offer: string;
  answer: string;
  /** Where the customer starts, if the case has a calculator. */
  simulatorPath?: string;
};

export const CASES: readonly CaseDef[] = [
  { key: "home", title: "תיק ביטוח דירה", request: "home-request", offer: "home-offer", answer: "home-answer", simulatorPath: "/simulator/home" },
];

export function getCase(key: string | undefined | null): CaseDef | undefined {
  return CASES.find((c) => c.key === key);
}

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

const YES_NO = ["כן", "לא"] as const;
const YES_NO_NEG = ["לא", "כן"] as const;

const HISTORY_TYPES = ["יש מקיף", "יש צד ג'", "אין"] as const;

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
    eyebrow: "הצהרת מבוטח",
    title: "הצהרת מבוטח — ביטוח חדש או חידוש",
    intro:
      "הטופס נשלח אליכם על ידי הסוכנות, וייתכן שחלק מהפרטים כבר מולאו מראש. ניתן לעבור עליו בקצב שלכם — התשובות נשמרות בדפדפן, כך שאפשר לעצור ולחזור. לשליחה יש להשלים את כל שדות החובה ולאשר את ההצהרות.",
    submitLabel: "אישור ושליחת הטופס",
    successTitle: "הטופס התקבל",
    successBody:
      "ההצהרה התקבלה אצלנו. נבדוק את הפרטים מול חברת הביטוח ונחזור אליכם עם המשך הטיפול. אם משהו דחוף — אפשר להתקשר אלינו ישירות.",
    sections: [
      {
        title: "פרטי המבוטח והרכב",
        fields: [
          { name: "insured_name", label: "שם המבוטח", type: "text", required: true, half: true, identity: "name", prefillable: true },
          { name: "insured_id", label: "תעודת זהות / ח.פ.", type: "id", required: true, half: true },
          { name: "phone", label: "טלפון", type: "tel", required: true, placeholder: "050-0000000", half: true, prefillable: true },
          { name: "email", label: "דוא״ל", type: "email", placeholder: "you@example.com", half: true, prefillable: true },
          { name: "plate", label: "מספר רישוי", type: "text", required: true, placeholder: "12-345-67", half: true, prefillable: true },
          { name: "vehicle_type", label: "סוג הרכב", type: "text", required: true, placeholder: "יצרן ודגם", half: true },
          { name: "year", label: "שנת ייצור", type: "number", required: true, min: 1900, max: 2100, placeholder: "2019", half: true },
          { name: "model_code", label: "קוד דגם", type: "text", required: true, half: true },
          { name: "insurer", label: "חברת ביטוח", type: "select", options: INSURERS, half: true },
          { name: "policy_no", label: "מספר פוליסה / הצעה", type: "text", half: true, prefillable: true },
          { name: "from_date", label: "תקופת הביטוח — מיום", type: "date", required: true, half: true },
          { name: "to_date", label: "עד יום", type: "date", required: true, half: true },
        ],
      },
      {
        title: "סוג העסקה",
        fields: [
          {
            name: "transaction_type",
            label: "סוג העסקה",
            type: "radio",
            required: true,
            options: ["ביטוח חדש", "חידוש ביטוח"],
          },
        ],
      },
      {
        title: "התאמת צרכים וסוג הכיסוי",
        fields: [
          {
            name: "coverage",
            label: "סוג הכיסוי המבוקש",
            type: "checkbox",
            required: true,
            options: ["ביטוח מקיף", "ביטוח צד ג'", "ביטוח חובה"],
            exclusive: [["ביטוח מקיף", "ביטוח צד ג'"]],
            help: "יש לבחור לפחות כיסוי אחד. אפשר מקיף בלבד, צד ג' בלבד, חובה בלבד, מקיף + חובה או צד ג' + חובה. לא ניתן לבחור מקיף וצד ג' יחד.",
          },
          {
            name: "needs_notes",
            label: "הערות התאמת צרכים",
            type: "textarea",
            placeholder: "פרטים נוספים שנמסרו לצורך התאמת צרכי המבוטח",
          },
        ],
      },
      {
        title: "נהגים מורשים",
        fields: [
          {
            name: "driver_scope",
            label: "מסגרת הנהגים המורשים",
            type: "radio",
            required: true,
            options: ["כל נהג מעל גיל", "נהגים נקובים בשם"],
          },
          {
            name: "all_drivers_age",
            label: "כל נהג מעל גיל",
            type: "number",
            required: true,
            min: 17,
            placeholder: "לדוגמה: 24",
            half: true,
            showWhen: { field: "driver_scope", equals: "כל נהג מעל גיל" },
          },
          {
            name: "license_tenure",
            label: "ותק רישיון נהיגה",
            type: "select",
            required: true,
            options: ["מעל שנה", "מעל שנתיים", "מעל מספר שנים אחר"],
            half: true,
            showWhen: { field: "driver_scope", equals: "כל נהג מעל גיל" },
          },
          {
            name: "custom_license_years",
            label: "מעל כמה שנים",
            type: "number",
            required: true,
            min: 1,
            placeholder: "מספר שנים",
            half: true,
            showWhen: { field: "license_tenure", equals: "מעל מספר שנים אחר" },
          },
          {
            name: "youngest_name",
            label: "הנהג הצעיר ביותר — שם מלא",
            type: "text",
            required: true,
            help: "הנהג הצעיר ביותר הצפוי לנהוג ברכב בדרך כלל.",
            showWhen: { field: "driver_scope", equals: "כל נהג מעל גיל" },
          },
          {
            name: "youngest_id",
            label: "הנהג הצעיר ביותר — תעודת זהות",
            type: "id",
            required: true,
            half: true,
            showWhen: { field: "driver_scope", equals: "כל נהג מעל גיל" },
          },
          {
            name: "youngest_birth",
            label: "הנהג הצעיר ביותר — תאריך לידה",
            type: "date",
            required: true,
            half: true,
            showWhen: { field: "driver_scope", equals: "כל נהג מעל גיל" },
          },
          {
            name: "named1_name",
            label: "נהג 1 — שם מלא",
            type: "text",
            required: true,
            showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" },
          },
          {
            name: "named1_id",
            label: "נהג 1 — תעודת זהות",
            type: "id",
            required: true,
            half: true,
            showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" },
          },
          {
            name: "named1_birth",
            label: "נהג 1 — תאריך לידה",
            type: "date",
            required: true,
            half: true,
            showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" },
          },
          { name: "named2_name", label: "נהג 2 — שם מלא", type: "text", showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
          { name: "named2_id", label: "נהג 2 — תעודת זהות", type: "id", half: true, showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
          { name: "named2_birth", label: "נהג 2 — תאריך לידה", type: "date", half: true, showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
          { name: "named3_name", label: "נהג 3 — שם מלא", type: "text", showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
          { name: "named3_id", label: "נהג 3 — תעודת זהות", type: "id", half: true, showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
          { name: "named3_birth", label: "נהג 3 — תאריך לידה", type: "date", half: true, showWhen: { field: "driver_scope", equals: "נהגים נקובים בשם" } },
        ],
      },
      {
        title: "כיסויים והרחבות",
        fields: [
          { name: "roadside", label: "גרירה ושירותי דרך", type: "select", required: true, options: YES_NO, half: true },
          { name: "glass", label: "שמשות תחליפיים", type: "select", required: true, options: YES_NO, half: true },
          { name: "replacement_car", label: "רכב חלופי", type: "select", required: true, options: YES_NO, half: true },
          { name: "lights_mirrors", label: "פנסים ומראות", type: "select", required: true, options: YES_NO, half: true },
          { name: "deductible_waiver", label: "ביטול השתתפות עצמית", type: "select", required: true, options: YES_NO, half: true },
          { name: "other_coverages_yesno", label: "כיסויים נוספים", type: "select", required: true, options: YES_NO, half: true },
          {
            name: "other_coverages",
            label: "פירוט הכיסויים הנוספים",
            type: "text",
            required: true,
            placeholder: "פירוט הכיסוי הנוסף והעלות, אם רלוונטי",
            showWhen: { field: "other_coverages_yesno", equals: "כן" },
          },
        ],
      },
      {
        title: "דרישות מיגון",
        fields: [
          {
            name: "security_ack",
            label:
              "הוסבר לי מהן דרישות המיגון שנקבעו על ידי חברת הביטוח, וכי קיום דרישות המיגון והמצאת אישור על קיומן ותקינותן הם תנאי מוקדם לכיסוי הביטוחי כנגד סיכוני גניבה ופריצה.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "השתתפות עצמית, גבולות אחריות ותנאים מהותיים",
        fields: [
          { name: "deductible", label: "השתתפות עצמית", type: "text", required: true, half: true },
          { name: "third_party_limit", label: "גבול אחריות לצד ג'", type: "text", required: true, half: true },
          { name: "key_terms", label: "פרטים נוספים", type: "textarea", placeholder: "פרטים נוספים, אם נדרש" },
          {
            name: "terms_ack",
            label:
              "אני מאשר/ת כי קיבלתי הסבר אודות ההשתתפות העצמית, סכומי הביטוח, גבולות האחריות והתנאים המהותיים של הביטוח.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "נוהל טיפול במקרה תאונה או נזק לרכב",
        fields: [
          {
            name: "accident_text",
            label: "",
            type: "statement",
            body:
              "הוסבר לי והבנתי כי במקרה של תאונה או נזק לרכב עליי לפנות בהקדם לסוכנות ו/או לחברת הביטוח, לקבל הנחיות בדבר אופן הטיפול בתביעה, ולהימנע ככל האפשר מביצוע תיקון ברכב לפני השלמת הליך בדיקת הנזק, השמאות וקבלת האישורים הנדרשים בהתאם להוראות חברת הביטוח והפוליסה.\n\nהוסבר לי כי במקרה שאבחר לתקן את הרכב במוסך שאינו מוסך שבהסדר/מוסך מוסכם של חברת הביטוח, עליי לפעול בהתאם לנוהל חברת הביטוח, לרבות ביצוע שמאות והעברת הצעת התיקון או האומדן כנדרש לפני תחילת התיקון.\n\nהוסבר לי כי בחירת מוסך שאינו בהסדר/מוסך מוסכם, או ביצוע תיקון שלא בהתאם להליך הנדרש, עלולים להשפיע על אופן חישוב תגמולי הביטוח, ההטבות הנלוות ו/או הסכום שישולם בגין התיקון, הכול בהתאם לתנאי הפוליסה, להוראות חברת הביטוח ולהוראות הדין החלות במועד האירוע. עוד הוסבר לי כי בחירה במוסך הסדר/מוסך מוסכם עשויה להקנות הטבות מיוחדות והנחה בהשתתפות העצמית, בהתאם לתנאי הפוליסה וחברת הביטוח.\n\nהוסבר לי כי באפשרותי לקבל מהסוכנות ו/או מחברת הביטוח מידע בדבר המוסכים שבהסדר/המוסכים המוסכמים ואופן הטיפול בתביעה לפני מסירת הרכב לתיקון.",
          },
          {
            name: "accident_ack",
            label: "אני מאשר/ת כי נוהל הטיפול במקרה תאונה או נזק לרכב הוסבר לי וכי הבנתי אותו.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "עבר ביטוחי ותביעות — שלוש השנים האחרונות",
        fields: [
          { name: "history1_type", label: "שנה אחרונה — סוג ביטוח", type: "select", required: true, options: HISTORY_TYPES },
          { name: "history1_months", label: "שנה אחרונה — מספר חודשים", type: "number", required: true, min: 1, max: 12, half: true, showWhen: { field: "history1_type", notEquals: "אין" } },
          { name: "history1_claims", label: "שנה אחרונה — מספר תביעות", type: "number", required: true, min: 0, half: true, showWhen: { field: "history1_type", notEquals: "אין" } },
          { name: "history1_company", label: "שנה אחרונה — חברת הביטוח", type: "select", required: true, options: INSURERS, showWhen: { field: "history1_type", notEquals: "אין" } },

          { name: "history2_type", label: "שנה שנייה — סוג ביטוח", type: "select", required: true, options: HISTORY_TYPES },
          { name: "history2_months", label: "שנה שנייה — מספר חודשים", type: "number", required: true, min: 1, max: 12, half: true, showWhen: { field: "history2_type", notEquals: "אין" } },
          { name: "history2_claims", label: "שנה שנייה — מספר תביעות", type: "number", required: true, min: 0, half: true, showWhen: { field: "history2_type", notEquals: "אין" } },
          { name: "history2_company", label: "שנה שנייה — חברת הביטוח", type: "select", required: true, options: INSURERS, showWhen: { field: "history2_type", notEquals: "אין" } },

          { name: "history3_type", label: "שנה שלישית — סוג ביטוח", type: "select", required: true, options: HISTORY_TYPES },
          { name: "history3_months", label: "שנה שלישית — מספר חודשים", type: "number", required: true, min: 1, max: 12, half: true, showWhen: { field: "history3_type", notEquals: "אין" } },
          { name: "history3_claims", label: "שנה שלישית — מספר תביעות", type: "number", required: true, min: 0, half: true, showWhen: { field: "history3_type", notEquals: "אין" } },
          { name: "history3_company", label: "שנה שלישית — חברת הביטוח", type: "select", required: true, options: INSURERS, showWhen: { field: "history3_type", notEquals: "אין" } },

          {
            name: "history_text",
            label: "",
            type: "statement",
            body:
              "הוסבר לי כי העבר הביטוחי מהווה בסיס לבחינת הכיסוי הביטוחי ולקביעת עלות הביטוח. אני מתחייב/ת למסור מידע מלא ונכון ולהמציא את האישורים הנדרשים לצורך אימות העבר הביטוחי. שינוי, אי-דיוק או אי-התאמה בנתוני העבר הביטוחי עלולים להשפיע על הכיסוי הביטוחי ועל הפרמיה, הכול בהתאם לתנאי הפוליסה ולהוראות הדין.",
          },
          {
            name: "history_ack",
            label: "אני מאשר/ת כי פרטי העבר הביטוחי שמסרתי נכונים ומלאים וכי הבנתי את משמעותם.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "פרמיה ואופן תשלום",
        fields: [
          { name: "premium", label: "פרמיה שנתית", type: "text", required: true, half: true },
          {
            name: "payment_method",
            label: "אופן התשלום",
            type: "select",
            required: true,
            options: ["כרטיס אשראי", "הוראת קבע בבנק", "העברה בנקאית"],
            half: true,
          },
          { name: "payments_count", label: "מספר תשלומים", type: "number", required: true, min: 1, half: true },
          {
            name: "card_last4",
            label: "4 ספרות אחרונות של הכרטיס",
            type: "text",
            help: "אם רלוונטי. אין למסור כאן את מספר הכרטיס המלא.",
            half: true,
          },
          {
            name: "payment_notes",
            label: "פרטים נוספים",
            type: "textarea",
            placeholder: "לדוגמה: להמשיך חיוב בהוראת קבע קיימת בפוליסה, כרטיס אשראי קיים או פרטים אחרים",
          },
        ],
      },
      {
        title: "כריתת חוזה הביטוח",
        fields: [
          {
            name: "contract_text",
            label: "",
            type: "statement",
            body:
              "הוסבר לי כי כריתת חוזה הביטוח והפקת הפוליסה כפופות לקבלת הסכמת חברת הביטוח בהתאם לנתונים שנמסרו ולהליכי החיתום שלה.",
          },
          {
            name: "contract_ack",
            label:
              "אני מאשר/ת את הנתונים והבחירות המפורטים בטופס ומבקש/ת מהסוכנות לפעול לצירופי לביטוח בהתאם להם.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "מסירת הפוליסה ותנאיה",
        fields: [
          {
            name: "delivery_text",
            label: "",
            type: "statement",
            body:
              "הוסבר לי על ידי הסוכנות כי פוליסת הביטוח ותנאיה (הז'קט) יישלחו אליי בדואר רגיל או בדואר אלקטרוני תוך 3 ימים מיום ביצוע פוליסת הביטוח, או לחלופין אני מודיע/ה לסוכנות כי אני בוחר/ת באחת מהאפשרויות שלהלן:",
          },
          {
            name: "policy_delivery",
            label: "בחירת אופן מסירת הפוליסה",
            type: "radio",
            required: true,
            options: [
              "אני מבקש/ת לא לשלוח בדואר; אבוא לקבל את הפוליסה ביד לאחר הוצאתה",
              "אני מאשר/ת קבלת הפוליסה ביד ללא תנאי הפוליסה (הז'קט), מאחר שהם זמינים באתר חברת הביטוח",
            ],
          },
        ],
      },
      {
        title: "הצהרות ואישור המבוטח",
        fields: [
          {
            name: "final_ack1",
            label: "אני מצהיר/ה כי כל הפרטים שמסרתי בטופס זה נכונים, מלאים ומדויקים למיטב ידיעתי.",
            type: "consent",
            required: true,
          },
          {
            name: "final_ack2",
            label:
              "אני מאשר/ת כי קיבלתי הסבר בדבר סוג הביטוח, הכיסויים, ההרחבות, הסייגים המהותיים, ההשתתפות העצמית, הפרמיה ואופן התשלום.",
            type: "consent",
            required: true,
          },
          {
            name: "final_ack3",
            label:
              "אני מאשר/ת כי הנתונים והבחירות המפורטים בטופס משקפים את צרכיי ואת הביטוח שביקשתי לרכוש או לחדש.",
            type: "consent",
            required: true,
          },
        ],
      },
      {
        title: "צירוף מסמכים (לא חובה)",
        description:
          "ניתן לצרף רישיון רכב מעודכן וצילום תעודת זהות של בעל הרכב. הצירוף אינו חובה לשליחת הטופס. בנייד אפשר לצלם את המסמך ישירות דרך המצלמה — התמונות מוקטנות אוטומטית לפני השליחה.",
        fields: [
          { name: "doc_vehicle_license", label: "רישיון רכב מעודכן", type: "file", multiple: true },
          { name: "doc_owner_id", label: "צילום תעודת זהות של בעל הרכב", type: "file", multiple: true },
        ],
      },
      {
        title: "חתימת המבוטח",
        fields: [
          { name: "sign_name", label: "שם מלא", type: "text", required: true, half: true },
          { name: "sign_id", label: "תעודת זהות", type: "id", required: true, half: true },
          { name: "sign_date", label: "תאריך", type: "date", required: true, half: true },
          { name: "sign_time", label: "שעה", type: "time", half: true },
          {
            name: "signature_text",
            label: "חתימת המבוטח",
            type: "signature",
            required: true,
            help: "החתימה מהווה אישור על ההצהרות שבטופס.",
          },
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
          { name: "fullName", label: "שם מלא", type: "text", required: true, half: true, identity: "name", prefillable: true },
          { name: "idNumber", label: "תעודת זהות", type: "id", required: true, half: true },
          { name: "phone", label: "טלפון נייד", type: "tel", required: true, placeholder: "050-0000000", half: true, prefillable: true },
          { name: "email", label: "דוא״ל", type: "email", placeholder: "you@example.com", half: true, prefillable: true },
        ],
      },
      {
        title: "פרטי הפוליסה",
        fields: [
          { name: "insurer", label: "חברת הביטוח", type: "select", required: true, options: INSURERS, half: true },
          { name: "policyNumber", label: "מספר פוליסה", type: "text", half: true, prefillable: true },
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
  // ── ביטוח דירה: a three-form case (lib/home-case.ts) ──────────────────────
  //
  // The customer starts at the simulator (/simulator/home), then files form 1
  // below. The agency answers with form 2 from the back-office, beside the
  // customer's answers, and sends form 3 as a signed link with the offer's
  // numbers locked in. The three share `caseKey: "home"`.

  {
    slug: "home-request",
    eyebrow: "ביטוח דירה",
    title: "פנייה להצעת ביטוח לדירת מגורים",
    intro:
      "מלאו את פרטי הדירה והכיסויים שמעניינים אתכם. על סמך הפרטים נבדוק ביטוחים קיימים (בהרשאתכם), נקבל הצעות מחברות הביטוח ונחזור אליכם עם הצעה מסודרת. התשובות נשמרות בדפדפן, כך שאפשר לעצור ולחזור.",
    submitLabel: "שליחת הבקשה",
    successTitle: "הבקשה נשלחה",
    successBody:
      "קיבלנו את הפרטים. נבדוק את הביטוחים הקיימים ואת האפשרויות מול חברות הביטוח, ונשלח לכם הצעת ביטוח מסודרת. אם משהו דחוף, אפשר להתקשר אלינו ישירות.",
    caseKey: "home",
    caseRole: "request",
    sections: [
      {
        title: "פרטי המועמד לביטוח",
        fields: [
          { name: "full_name", label: "שם מלא", type: "text", required: true, half: true, identity: "name", prefillable: true },
          { name: "id_number", label: "מספר תעודת זהות", type: "id", required: true, half: true },
          { name: "birth_date", label: "תאריך לידה", type: "date", half: true },
          { name: "id_issue_date", label: "תאריך הנפקת תעודת הזהות", type: "date", half: true },
          { name: "phone", label: "טלפון נייד", type: "tel", required: true, placeholder: "050-0000000", half: true, prefillable: true },
          { name: "email", label: "דוא״ל", type: "email", placeholder: "you@example.com", half: true, prefillable: true },
          { name: "household_size", label: "מספר נפשות המתגוררות בדירה", type: "number", min: 1, max: 30, half: true },
          { name: "residence_status", label: "מעמד בדירה", type: "radio", required: true, options: ["בעלים", "שוכר", "אחר"] },
        ],
      },
      {
        title: "כתובת הדירה לביטוח",
        fields: [
          { name: "street", label: "רחוב", type: "text", required: true, half: true },
          { name: "house_no", label: "מספר", type: "text", required: true, half: true },
          { name: "apartment_no", label: "דירה", type: "text", half: true },
          { name: "city", label: "יישוב", type: "text", required: true, half: true },
          { name: "zip", label: "מיקוד", type: "text", half: true },
        ],
      },
      {
        title: "פרטי הדירה",
        fields: [
          {
            name: "property_type",
            label: "סוג הנכס",
            type: "radio",
            required: true,
            options: ["דירה בבית משותף", "בית פרטי", "דו-משפחתי / קוטג'", "אחר"],
          },
          { name: "area_m2", label: 'שטח הדירה במ"ר', type: "number", required: true, min: 10, max: 5000, half: true },
          { name: "floor", label: "קומה", type: "text", half: true },
          { name: "building_floors", label: "מספר קומות בבניין", type: "text", half: true },
          { name: "build_year", label: "שנת בנייה משוערת", type: "number", min: 1900, max: 2100, half: true },
          {
            name: "apartment_use",
            label: "השימוש בדירה",
            type: "radio",
            required: true,
            options: ["מגורי המבוטח", "מושכרת למגורים", "דירה שאינה מאוכלסת דרך קבע", "אחר"],
          },
          { name: "business_activity", label: "האם מתנהלת בדירה פעילות עסקית?", type: "radio", required: true, options: YES_NO_NEG },
          {
            name: "business_activity_details",
            label: "פירוט הפעילות העסקית",
            type: "text",
            required: true,
            placeholder: "לדוגמה: משרד, קליניקה, סטודיו",
            showWhen: { field: "business_activity", equals: "כן" },
          },
          {
            name: "protection",
            label: "אמצעי מיגון",
            type: "checkbox",
            options: ["דלת כניסה ממוגנת / פלדלת", "אזעקה", "סורגים", "אחר", "אין"],
            exclusive: [
              ["אין", "דלת כניסה ממוגנת / פלדלת"],
              ["אין", "אזעקה"],
              ["אין", "סורגים"],
              ["אין", "אחר"],
            ],
          },
        ],
      },
      {
        title: "הביטוח המבוקש",
        fields: [
          {
            name: "insurance_kind",
            label: "אני מבקש/ת לקבל הצעה עבור",
            type: "radio",
            required: true,
            options: ["ביטוח מבנה בלבד", "ביטוח תכולה בלבד", "ביטוח מבנה ותכולה"],
          },
          {
            name: "building_sum",
            label: "סכום ביטוח המבנה המבוקש (₪)",
            type: "number",
            min: 0,
            half: true,
            help: 'נתון עזר בלבד: עלות בנייה למ"ר למבנה סטנדרטי, נכון להיום, כ-7,000 ₪ למ"ר.',
            showWhen: { field: "insurance_kind", notEquals: "ביטוח תכולה בלבד" },
          },
          {
            name: "contents_sum",
            label: "סכום ביטוח התכולה המבוקש (₪)",
            type: "number",
            min: 0,
            half: true,
            showWhen: { field: "insurance_kind", notEquals: "ביטוח מבנה בלבד" },
          },
          {
            name: "contents_help",
            label: "אם איני יודע/ת את סכום התכולה",
            type: "checkbox",
            options: ["אבקש סיוע בקביעת סכום הביטוח"],
            showWhen: { field: "insurance_kind", notEquals: "ביטוח מבנה בלבד" },
          },
          { name: "mortgage", label: "האם קיימת משכנתה על הדירה?", type: "radio", required: true, options: YES_NO_NEG },
          {
            name: "mortgage_bank",
            label: "שם הבנק / הגוף המלווה",
            type: "text",
            required: true,
            half: true,
            showWhen: { field: "mortgage", equals: "כן" },
          },
          { name: "mortgage_branch", label: "סניף, אם ידוע", type: "text", half: true, showWhen: { field: "mortgage", equals: "כן" } },
        ],
      },
      {
        title: "עבר ביטוחי ותביעות",
        fields: [
          {
            name: "currently_insured",
            label: "האם הדירה מבוטחת כיום?",
            type: "radio",
            required: true,
            options: ["לא", "כן", "איני יודע/ת"],
          },
          { name: "current_insurer", label: "חברת הביטוח", type: "text", half: true, showWhen: { field: "currently_insured", equals: "כן" } },
          {
            name: "current_end_date",
            label: "מועד סיום הביטוח הקיים, אם ידוע",
            type: "date",
            half: true,
            showWhen: { field: "currently_insured", equals: "כן" },
          },
          {
            name: "claims_3y",
            label: "האם היו במהלך 3 השנים האחרונות תביעות או נזקים הקשורים לדירה או לתכולתה?",
            type: "radio",
            required: true,
            options: YES_NO_NEG,
          },
          {
            name: "claims_details",
            label: "נא לפרט בקצרה",
            type: "textarea",
            required: true,
            showWhen: { field: "claims_3y", equals: "כן" },
          },
          {
            name: "refused_before",
            label: "האם חברת ביטוח סירבה בעבר לבטח את הדירה, ביטלה ביטוח או דרשה תנאים מיוחדים?",
            type: "radio",
            required: true,
            options: YES_NO_NEG,
          },
          {
            name: "refused_details",
            label: "נא לפרט",
            type: "textarea",
            required: true,
            showWhen: { field: "refused_before", equals: "כן" },
          },
        ],
      },
      {
        title: 'הרשאה לבדיקת ביטוחים באתר "הר הביטוח"',
        fields: [
          {
            name: "har_statement",
            label: "",
            type: "statement",
            body:
              'לצורך בירור צרכיי הביטוחיים, בדיקת ביטוחים קיימים ומניעת כפל ביטוחי, אני מאשר/ת ומייפה את כוחו של סוכן הביטוח / סוכנות הביטוח לבצע עבורי חיפוש באתר "הר הביטוח", בהתאם להוראות הדין והוראות רשות שוק ההון, ביטוח וחיסכון.\n\nהרשאה זו תקפה למשך חמישה ימי עבודה ממועד חתימתה.',
          },
          {
            name: "har_consent",
            label: "הרשאה",
            type: "checkbox",
            options: ['אני מאשר/ת ביצוע בדיקה באתר "הר הביטוח"'],
            help: "ההרשאה אינה חובה, אך בלעדיה לא נוכל לבדוק ביטוחים קיימים ולמנוע כפל ביטוח.",
          },
        ],
      },
      {
        title: "בירור והתאמת צרכים",
        fields: [
          {
            name: "earthquake",
            label: "רעידת אדמה",
            type: "radio",
            required: true,
            options: ["מעוניין/ת בכיסוי", "מבקש/ת לבחון אפשרות לוותר על הכיסוי ולקבל הסבר לפני קבלת החלטה"],
          },
          { name: "water", label: "נזקי מים וצנרת", type: "checkbox", options: ["מעוניין/ת בכיסוי"] },
          {
            name: "water_route",
            label: "מסלול נזקי מים",
            type: "radio",
            required: true,
            options: ["מסלול שרברב שבהסדר", "מסלול שרברב פרטי", "מבקש/ת לקבל הסבר לפני הבחירה"],
            showWhen: { field: "water", equals: "מעוניין/ת בכיסוי" },
          },
          {
            name: "third_party_statement",
            label: "",
            type: "statement",
            body:
              "אחריות כלפי צד שלישי: הפוליסה המוצעת על ידי הסוכנות תכלול כיסוי אחריות כלפי צד שלישי לנזק גוף ו/או רכוש, בכפוף לכך שהכיסוי יצוין במפרט הפוליסה ובכפוף לתנאיה.",
          },
          { name: "jewelry", label: "תכשיטים וחפצי ערך", type: "radio", required: true, options: ["מעוניין/ת בכיסוי", "לא מעוניין/ת"] },
          {
            name: "jewelry_sum",
            label: "סכום הביטוח המבוקש לתכשיטים וחפצי ערך (₪)",
            type: "number",
            min: 0,
            half: true,
            showWhen: { field: "jewelry", equals: "מעוניין/ת בכיסוי" },
          },
          {
            name: "jewelry_statement",
            label: "",
            type: "statement",
            body:
              "ביטוח תכשיטים וחפצי ערך ניתן לרכוש אך ורק בצירוף פירוט מדויק ו/או הערכת סוקר מטעם חברת הביטוח, ובכפוף לתנאי הפוליסה.",
            showWhen: { field: "jewelry", equals: "מעוניין/ת בכיסוי" },
          },
          {
            name: "extras",
            label: "הרחבות נוספות",
            type: "checkbox",
            options: ["אופניים / אופניים חשמליים (בכפוף לתנאי הפוליסה)", "פעילות עסקית בדירה (בכפוף לתנאי הפוליסה)", "אין הרחבות נוספות"],
            exclusive: [
              ["אין הרחבות נוספות", "אופניים / אופניים חשמליים (בכפוף לתנאי הפוליסה)"],
              ["אין הרחבות נוספות", "פעילות עסקית בדירה (בכפוף לתנאי הפוליסה)"],
            ],
          },
          { name: "extras_other", label: "הרחבה אחרת", type: "text" },
        ],
      },
      {
        title: "מידע נוסף",
        fields: [
          {
            name: "more_info",
            label: "מידע נוסף שחשוב שנדע לצורך התאמת הביטוח וקבלת ההצעה",
            type: "textarea",
          },
        ],
      },
      {
        title: "המשך הטיפול בבקשה",
        fields: [
          {
            name: "process_statement",
            label: "",
            type: "statement",
            body:
              "הפרטים שמסרתי בטופס זה ישמשו את הסוכנות לצורך בירור והתאמת צרכיי הביטוחיים, בדיקת ביטוחים קיימים בהתאם להרשאתי, קבלת הצעות מחברות ביטוח ובדיקת אפשרויות הביטוח בהתאם לנתונים שמסרתי.\n\nידוע לי כי תנאי הביטוח, הכיסויים, ההרחבות, סכומי הביטוח, ההשתתפויות העצמיות והפרמיה עשויים להשתנות בין חברות הביטוח והכול בכפוף לתנאי הפוליסה, לתנאי החיתום ולאישור החברה המבטחת.",
          },
        ],
      },
      {
        title: "אמצעי תשלום, חשוב",
        fields: [
          {
            name: "payment_statement",
            label: "",
            type: "statement",
            body:
              "אין להזין בטופס זה מספר כרטיס אשראי, תוקף, קוד אבטחה או פרטי אמצעי תשלום אחרים.\n\nפרטי אמצעי התשלום יימסרו בנפרד לסוכנות באמצעות ערוץ מאובטח או בדרך אחרת שתתואם עם המועמד לביטוח.",
          },
        ],
      },
      {
        title: "הצהרת המועמד לביטוח",
        fields: [
          {
            name: "declaration_statement",
            label: "",
            type: "statement",
            body:
              "אני מצהיר/ה כי הפרטים והמידע שמסרתי בטופס זה נכונים ומלאים למיטב ידיעתי. אני מאשר/ת כי סימנתי את צרכיי ואת הכיסויים המבוקשים וכי ניתנה לי האפשרות לבקש מידע והסבר נוסף. ידוע לי כי ייתכן שאדרש למסור מידע או מסמכים נוספים בהתאם לדרישות החברה המבטחת ולתנאי החיתום. ידוע לי כי מילוי וחתימה על טופס זה אינם מהווים כשלעצמם אישור של חברת הביטוח לקבלת ההצעה או לקיומו של כיסוי ביטוחי.",
          },
          { name: "declaration_ack", label: "קראתי את ההצהרה ואני מאשר/ת אותה.", type: "consent", required: true },
          { name: "sign_name", label: "שם המועמד לביטוח", type: "text", required: true, half: true },
          { name: "sign_id", label: 'מספר ת"ז', type: "id", required: true, half: true },
          { name: "sign_date", label: "תאריך", type: "date", required: true, half: true },
          {
            name: "signature_text",
            label: "חתימת המועמד לביטוח",
            type: "signature",
            required: true,
            help: "החתימה מהווה אישור על ההצהרה שבטופס.",
          },
        ],
      },
    ],
  },

  {
    slug: "home-offer",
    eyebrow: "טופס 2",
    title: "הצעת ביטוח לדירת מגורים בהתאם לפנייתך",
    intro:
      "ההצעה נבנית על סמך הבקשה של הלקוח (טופס 1). הפרטים שמולאו מראש נלקחו מהבקשה ומהמחשבון, וניתן לשנות כל אחד מהם לפני השמירה.",
    submitLabel: "שמירת ההצעה",
    successTitle: "ההצעה נשמרה",
    successBody: "ההצעה נשמרה בתיק. מעמוד התיק אפשר לשלוח ללקוח את טופס התשובה (טופס 3).",
    audience: "agency",
    caseKey: "home",
    caseRole: "offer",
    sections: [
      {
        title: "פרטי המבוטח",
        fields: [
          { name: "insured_name", label: "שם המבוטח", type: "text", required: true, half: true, identity: "name" },
          { name: "insured_id", label: 'מספר ת"ז', type: "id", required: true, half: true },
          { name: "insured_phone", label: "טלפון", type: "tel", required: true, half: true },
          { name: "insured_address", label: "כתובת דירת המגורים לביטוח", type: "text", required: true, half: true },
        ],
      },
      {
        title: 'תוצאות בדיקת "הר הביטוח"',
        fields: [
          { name: "har_check_date", label: "תאריך הבדיקה", type: "date", half: true },
          {
            name: "har_result",
            label: "תוצאות הבדיקה",
            type: "radio",
            required: true,
            options: ["נמצא ביטוח דירה קיים", "לא נמצא ביטוח דירה קיים", "לא בוצעה בדיקה"],
          },
          {
            name: "har_found_statement",
            label: "",
            type: "statement",
            body:
              "נמצא ביטוח דירה קיים: הצעת הביטוח נעצרת בשלב זה. לצורך בדיקת הביטוח הקיים ומתן הצעת ביטוח נכונה ומותאמת, יש לבקש מהלקוח העתק מלא ועדכני של פוליסת ביטוח הדירה הקיימת. לאחר קבלתה ובדיקתה ניתן להמשיך בטיפול.",
            showWhen: { field: "har_result", equals: "נמצא ביטוח דירה קיים" },
          },
        ],
      },
      {
        title: "הצעת הביטוח",
        fields: [
          { name: "insurer", label: "חברת הביטוח", type: "select", required: true, options: INSURERS, half: true },
          { name: "period_start", label: "תחילת תקופת הביטוח", type: "date", required: true, half: true },
          { name: "period_end", label: "סיום תקופת הביטוח", type: "date", required: true, half: true },
          { name: "offered_kind", label: "הביטוח המוצע", type: "radio", required: true, options: ["מבנה בלבד", "תכולה בלבד", "מבנה ותכולה"] },
          {
            name: "building_sum",
            label: "סכום ביטוח מבנה (₪)",
            type: "number",
            required: true,
            min: 0,
            half: true,
            showWhen: { field: "offered_kind", notEquals: "תכולה בלבד" },
          },
          {
            name: "contents_sum",
            label: "סכום ביטוח תכולה (₪)",
            type: "number",
            required: true,
            min: 0,
            half: true,
            showWhen: { field: "offered_kind", notEquals: "מבנה בלבד" },
          },
        ],
      },
      {
        title: "הכיסויים הביטוחיים",
        fields: [
          { name: "earthquake", label: "רעידת אדמה", type: "radio", required: true, options: ["כלול", "לא כלול"] },
          {
            name: "water",
            label: "נזקי מים וצנרת",
            type: "radio",
            required: true,
            options: ["כלול: שרברב שבהסדר", "כלול: שרברב פרטי", "לא כלול"],
          },
          {
            name: "third_party_statement",
            label: "",
            type: "statement",
            body: "אחריות כלפי צד שלישי: הכיסוי כלול בהצעה, בכפוף לכך שיצוין במפרט הפוליסה ובכפוף לתנאיה.",
          },
          {
            name: "jewelry_statement",
            label: "",
            type: "statement",
            body:
              "תכשיטים וחפצי ערך: לא כלול. במידה והמבוטח מעוניין לרכוש כיסוי, יש להמציא הערכה מפורטת מחנות תכשיטים/זהב ו/או הערכת סוקר מטעם חברת הביטוח. רק לאחר המצאת ההערכה ובכפוף לאישורה ולתנאי חברת הביטוח ניתן יהיה לבחון את הכללת הכיסוי.",
          },
          { name: "extras_included", label: "הרחבות נוספות הכלולות בהצעה", type: "text" },
          { name: "extras_none", label: "הרחבות נוספות", type: "checkbox", options: ["אין הרחבות נוספות"] },
        ],
      },
      {
        title: "פרמיה והשתתפויות עצמיות",
        fields: [
          { name: "premium", label: "פרמיה שנתית כוללת (₪)", type: "number", required: true, min: 0, half: true },
          { name: "payments", label: "מספר תשלומים", type: "number", required: true, min: 1, max: 12, half: true },
          { name: "deductible_general", label: "השתתפות עצמית כללית", type: "text", required: true, half: true },
          { name: "deductible_water", label: "השתתפות עצמית, נזקי מים וצנרת", type: "text", half: true },
          { name: "deductible_earthquake", label: "השתתפות עצמית, רעידת אדמה", type: "text", half: true },
          { name: "deductible_other", label: "השתתפות עצמית אחרת, ככל שקיימת", type: "text", half: true },
        ],
      },
      {
        title: "הערות הסוכנות",
        fields: [
          { name: "notes", label: "הערות", type: "textarea", placeholder: "הערות ללקוח על ההצעה, תנאים מיוחדים, מסמכים נדרשים" },
          { name: "notes_none", label: "", type: "checkbox", options: ["אין הערות מיוחדות"] },
        ],
      },
      {
        title: "סיכום ההצעה",
        fields: [
          {
            name: "summary_statement",
            label: "",
            type: "statement",
            body:
              "הצעת ביטוח זו נערכה בהתאם לפרטים, לנתונים ולצרכים שנמסרו בטופס 1. ההצעה כפופה לאישור חברת הביטוח, לתנאי החיתום ולתנאי הפוליסה. לאחר עיון בהצעה יש להשיב באמצעות טופס 3.",
          },
          { name: "agency_name", label: "שם הסוכנות", type: "text", required: true, half: true },
          { name: "agent_name", label: "שם הסוכן/ת", type: "text", required: true, half: true },
          { name: "offer_date", label: "תאריך ההצעה", type: "date", required: true, half: true },
        ],
      },
    ],
  },

  {
    slug: "home-answer",
    eyebrow: "טופס 3",
    title: "תשובת המבוטח להצעת ביטוח דירת מגורים",
    intro:
      "בהמשך להצעת ביטוח דירת המגורים (טופס 2) שנשלחה אליכם, ולאחר שעיינתם בהצעה ובפרטים שנמסרו לכם, סמנו את החלטתכם וחתמו. פרטי ההצעה מולאו מראש על ידי הסוכנות.",
    submitLabel: "שליחת התשובה",
    successTitle: "תשובתך התקבלה",
    successBody:
      "תודה. הסוכנות קיבלה את החלטתך ותמשיך בטיפול בהתאם. אם אישרת את ביצוע הביטוח, ניצור קשר לתיאום אמצעי התשלום בערוץ מאובטח. זכרו: אין כיסוי ביטוחי לפני אישור חברת הביטוח והפקת הפוליסה.",
    requiresToken: true,
    caseKey: "home",
    caseRole: "answer",
    sections: [
      {
        title: "פרטי המבוטח",
        fields: [
          { name: "insured_name", label: "שם המבוטח", type: "text", required: true, half: true, identity: "name" },
          { name: "insured_id", label: 'מספר ת"ז', type: "id", required: true, half: true },
          { name: "insured_address", label: "כתובת דירת המגורים לביטוח", type: "text", required: true },
        ],
      },
      {
        title: "פרטי ההצעה",
        fields: [
          { name: "insurer", label: "חברת הביטוח", type: "text", required: true, half: true },
          { name: "premium", label: "פרמיה שנתית (₪)", type: "number", required: true, min: 0, half: true },
          { name: "period_start", label: "מועד תחילת הביטוח המוצע", type: "date", required: true, half: true },
        ],
      },
      {
        title: "החלטת המבוטח",
        fields: [
          {
            name: "decision",
            label: "נא לסמן אפשרות אחת בלבד",
            type: "radio",
            required: true,
            options: ["אני מאשר/ת את ביצוע הביטוח", "אני מבקש/ת שינוי או הבהרה לפני ביצוע הביטוח", "איני מעוניין/ת בביצוע הביטוח"],
          },
          {
            name: "requested_start",
            label: "מועד תחילת הביטוח המבוקש",
            type: "date",
            half: true,
            help: "אם שונה מהמועד שבהצעה.",
            showWhen: { field: "decision", equals: "אני מאשר/ת את ביצוע הביטוח" },
          },
          {
            name: "change_details",
            label: "נא לפרט את השינוי או ההבהרה המבוקשים",
            type: "textarea",
            required: true,
            showWhen: { field: "decision", equals: "אני מבקש/ת שינוי או הבהרה לפני ביצוע הביטוח" },
          },
        ],
      },
      {
        title: "אמצעי תשלום",
        fields: [
          {
            name: "payment_statement",
            label: "",
            type: "statement",
            body:
              "במקרה שאישרתי את ביצוע הביטוח, ידוע לי כי אין למסור בטופס זה פרטי כרטיס אשראי או אמצעי תשלום. פרטי אמצעי התשלום יימסרו בנפרד לסוכנות באמצעות ערוץ מאובטח או בדרך אחרת שתתואם עמי.",
          },
        ],
      },
      {
        title: "אישור וחתימת המבוטח",
        fields: [
          {
            name: "confirm_statement",
            label: "",
            type: "statement",
            body:
              "אני מאשר/ת כי קיבלתי את טופס 2, הצעת ביטוח דירת מגורים, עיינתי בפרטי ההצעה וסימנתי לעיל את החלטתי. ככל שאישרתי את ביצוע הביטוח, אני מבקש/ת מהסוכנות לפעול לביצוע הביטוח בהתאם להצעה שאושרה על ידי ובכפוף לאישור חברת הביטוח ולתנאיה.\n\nידוע לי כי אין כיסוי ביטוחי כלשהו לפני אישור וביצוע הביטוח על ידי חברת הביטוח, לרבות הפקת פוליסת הביטוח בהתאם.",
          },
          { name: "confirm_ack", label: "קראתי את האישור ואני מאשר/ת אותו.", type: "consent", required: true },
          { name: "sign_name", label: "שם המבוטח", type: "text", required: true, half: true },
          { name: "sign_id", label: 'מספר ת"ז', type: "id", required: true, half: true },
          { name: "sign_date", label: "תאריך", type: "date", required: true, half: true },
          {
            name: "signature_text",
            label: "חתימת המבוטח",
            type: "signature",
            required: true,
            help: "החתימה מהווה אישור על ההחלטה שבטופס.",
          },
        ],
      },
    ],
  },
] as const;

export const FORM_SLUGS = FORMS.map((f) => f.slug);

export function getForm(slug: string): FormDef | undefined {
  return FORMS.find((f) => f.slug === slug);
}

export function formAudience(form: FormDef): FormAudience {
  return form.audience ?? "customer";
}

/** Forms a customer can open from a plain link: not agency-only, not token-only. */
export function publicForms(): FormDef[] {
  return FORMS.filter((f) => formAudience(f) === "customer" && !f.requiresToken);
}

/** Every field of a form, flattened — used by both the renderer and the API. */
export function allFields(form: FormDef): FormField[] {
  return form.sections.flatMap((s) => [...s.fields]);
}

/** The field holding the customer's own name, by meaning rather than spelling. */
export function identityField(form: FormDef, of: "name"): FormField | undefined {
  return allFields(form).find((f) => f.identity === of);
}

/** The field names a plain `?name=value` link is allowed to pre-fill. */
export function prefillableFields(form: FormDef): string[] {
  return allFields(form)
    .filter((f) => f.prefillable)
    .map((f) => f.name);
}

/**
 * Is this field currently shown, given the answers so far?
 *
 * Both the browser and the API call this. If they ever disagreed, a customer
 * could be blocked by a required field they were never shown, or a hidden
 * field's stale answer could be filed as if they had given it.
 */
export function isFieldVisible(
  form: FormDef,
  field: FormField,
  values: Record<string, string | string[] | undefined>,
  seen: Set<string> = new Set(),
): boolean {
  const rule = field.showWhen;
  if (!rule) return true;
  if (seen.has(field.name)) return true; // guard a malformed showWhen cycle
  seen.add(field.name);

  // Visibility CASCADES. Hiding a field does not erase what was typed into it,
  // so without this a dependent stays visible on the strength of an answer its
  // own controller no longer shows: pick "מעל מספר שנים אחר", switch to named
  // drivers, and "מעל כמה שנים" would linger — and the API would then demand a
  // field belonging to the path the customer did not choose.
  const controller = allFields(form).find((f) => f.name === rule.field);
  if (controller && !isFieldVisible(form, controller, values, seen)) return false;

  const raw = values[rule.field];
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  if (rule.equals !== undefined) return value === rule.equals;
  if (rule.notEquals !== undefined) return value !== rule.notEquals;
  if (rule.in) return rule.in.includes(value);
  return true;
}

/** Fields currently shown — the set the answers are validated against. */
export function visibleFields(
  form: FormDef,
  values: Record<string, string | string[] | undefined>,
): FormField[] {
  return allFields(form).filter((f) => isFieldVisible(form, f, values));
}

/** Options that may not be selected alongside `option` in the same group. */
export function conflictingOptions(field: FormField, option: string): string[] {
  if (!field.exclusive) return [];
  return field.exclusive
    .filter((set) => set.includes(option))
    .flatMap((set) => set.filter((o) => o !== option));
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
/** A drawn signature is a small PNG; anything bigger is not a signature. */
export const SIGNATURE_MAX_BYTES = 300 * 1024;

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
