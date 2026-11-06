// The homepage "call me back" form: its fields, shared by the API route that
// receives it and the back-office that renders what was received.
export const CONTACT_FORM_SLUG = "contact";
export const CONTACT_FORM_TITLE = "פנייה מטופס יצירת קשר";

export const CONTACT_FIELDS: readonly { key: string; label: string; required?: boolean }[] = [
  { key: "name", label: "שם מלא", required: true },
  { key: "phone", label: "טלפון", required: true },
  { key: "email", label: "דוא״ל" },
  { key: "topic", label: "תחום הביטוח" },
  { key: "message", label: "הודעה" },
];

// The areas the topic list offers. Each /insurance/* page preselects its own
// `topic` (lib/insurance-data.ts), so every page's topic must be one of these.
export const CONTACT_TOPICS: readonly string[] = [
  "ביטוח רכב",
  "ביטוח דירה",
  "ביטוח עסקים",
  "ביטוחי חיים ובריאות",
  "ביטוח משכנתאות",
  "תכנון פרישה",
  "פיננסים",
  "תיק ביטוח כולל",
];
