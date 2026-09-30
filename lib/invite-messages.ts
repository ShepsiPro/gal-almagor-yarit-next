// The words that carry a form to the customer, in one place so the WhatsApp
// text, the email and the manual wa.me / mailto fallback can never say
// different things. Plain Hebrew, no emoji: it is the agency writing.

import { SITE } from "./site";

export type OutgoingMessage = {
  /** The WhatsApp text, link included. */
  whatsapp: string;
  /** The email subject. */
  subject: string;
  /** Email heading, greeting, body lines and button label. */
  heading: string;
  greeting: string;
  lines: string[];
  ctaLabel: string;
  link: string;
};

function hello(name?: string): string {
  const n = (name ?? "").trim();
  return n ? `שלום ${n},` : "שלום,";
}

/** A form (or the calculator that leads to one) the agency sends to open a file. */
export function inviteMessage(opts: { title: string; link: string; name?: string; calculator?: boolean }): OutgoingMessage {
  const { title, link, name, calculator } = opts;
  const ask = calculator
    ? "מחשבון להערכה ראשונית של ביטוח הדירה, ובסופו טופס בקשה קצר להצעה מסודרת"
    : `הטופס "${title}"`;
  return {
    whatsapp: `${hello(name)}\nכאן ${SITE.brand}.\n${calculator ? `${ask}:` : `למילוי ${ask}:`}\n${link}`,
    subject: `${calculator ? "מחשבון ביטוח דירה" : title} · ${SITE.brand}`,
    heading: calculator ? "מחשבון ביטוח דירה" : title,
    greeting: hello(name),
    lines: [
      calculator ? `שלחנו לכם ${ask}.` : `שלחנו לכם ${ask} למילוי.`,
      "אפשר למלא מהנייד. אם משהו לא ברור, התקשרו אלינו ונשלים יחד.",
    ],
    ctaLabel: calculator ? "למחשבון" : "למילוי הטופס",
    link,
  };
}

/** Form 3: the offer is ready, here is the link to answer it and sign. */
export function answerMessage(opts: { link: string; name?: string }): OutgoingMessage {
  const { link, name } = opts;
  return {
    whatsapp: `${hello(name)}\nכאן ${SITE.brand}.\nהצעת ביטוח הדירה מוכנה. לאישור, לבקשת שינוי או לדחייה, מלאו וחתמו כאן:\n${link}`,
    subject: `הצעת ביטוח הדירה שלכם מוכנה · ${SITE.brand}`,
    heading: "הצעת ביטוח הדירה שלכם מוכנה",
    greeting: hello(name),
    lines: [
      "הכנו עבורכם הצעת ביטוח לדירה, בהתאם לפנייה שלכם.",
      "לאישור, לבקשת שינוי או הבהרה, או לדחייה, יש למלא ולחתום בטופס התשובה. כל פרטי ההצעה מולאו מראש.",
    ],
    ctaLabel: "לטופס התשובה",
    link,
  };
}
