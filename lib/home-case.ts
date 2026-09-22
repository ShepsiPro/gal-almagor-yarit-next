// A case: one file made of three forms, opened by the customer, priced by the
// agency, closed by the customer's signature.
//
//   1. The customer runs the simulator (/simulator/home) and files the request
//      form (home-request). The simulator snapshot travels with the request
//      and is stored beside its answers, so the agency sees what the customer
//      saw. The request creates the Mslahtk lead: ONE lead per case.
//   2. The agency prepares the offer (home-offer) from the back-office, with
//      the request open beside it. Saved as a child of the request; the lead
//      moves to "qualified" and carries the offer's summary.
//   3. The agency sends form 3 (home-answer) as a signed link with the offer's
//      numbers locked. The customer's decision is filed as another child; the
//      lead moves to won / qualified / lost and carries the decision.
//
// Server-only: this module reads the database. The pure mappings live here too
// so the three forms' field names are spelled in one place.

import type { Prisma, Submission } from "@prisma/client";
import { db } from "./db";
import { getCase, getForm, type CaseDef, type FormDef } from "./forms";
import { computeHomeQuote, normalizeInput, roundShekel, type HomeQuoteInput, type HomeQuoteResult } from "./home-quote";
import { answersOf } from "./submissions";
import { SITE } from "./site";

export type Decision = "approved" | "change" | "declined";
export type CaseStage = "request" | "offer" | "sent" | "answered";

export type SimulatorSnapshot = { input: HomeQuoteInput; result: HomeQuoteResult; at: string | null };

export type SubmissionWithChildren = Prisma.SubmissionGetPayload<{ include: { children: true; files: true } }>;

export type CaseFile = {
  def: CaseDef;
  request: SubmissionWithChildren;
  offers: Submission[];
  latestOffer: Submission | null;
  answers: Submission[];
  latestAnswer: Submission | null;
  stage: CaseStage;
  decision: Decision | null;
  simulator: SimulatorSnapshot | null;
};

// ── Which form is what ──────────────────────────────────────────────────────

/** The case a request form opens, if this form opens one. */
export function caseOpenedBy(form: FormDef | null | undefined): CaseDef | undefined {
  if (!form || form.caseRole !== "request") return undefined;
  return getCase(form.caseKey);
}

/** The case a child form (offer / answer) belongs to. */
export function caseOfChildForm(form: FormDef | null | undefined): CaseDef | undefined {
  if (!form || !form.caseRole || form.caseRole === "request") return undefined;
  return getCase(form.caseKey);
}

// ── The simulator snapshot stored with a request ────────────────────────────

/**
 * What the request stores about the estimate: the INPUTS as JSON under a
 * private key (recomputed wherever it is read, never trusted as a price), plus
 * a few plain keys so the estimate is readable on the Mslahtk card and in the
 * back-office without parsing anything.
 */
export function simulatorAnswerFields(input: HomeQuoteInput, result: HomeQuoteResult): Record<string, string> {
  return {
    _simulator: JSON.stringify({ input, at: new Date().toISOString() }),
    sim_total: String(roundShekel(result.total)),
    sim_apartment_type: input.apartmentType,
    sim_building_sum: String(Math.round(input.buildingSum)),
    sim_contents_sum: String(Math.round(input.contentsSum)),
  };
}

export function simulatorFromAnswers(answers: Record<string, string>): SimulatorSnapshot | null {
  const raw = answers._simulator;
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as { input?: unknown; at?: unknown };
    if (!obj || typeof obj !== "object" || !obj.input) return null;
    const input = normalizeInput(obj.input);
    return { input, result: computeHomeQuote(input), at: typeof obj.at === "string" ? obj.at : null };
  } catch {
    return null;
  }
}

// ── The customer's decision ─────────────────────────────────────────────────

export const DECISION_OPTIONS: Record<Decision, string> = {
  approved: "אני מאשר/ת את ביצוע הביטוח",
  change: "אני מבקש/ת שינוי או הבהרה לפני ביצוע הביטוח",
  declined: "איני מעוניין/ת בביצוע הביטוח",
};

export function decisionOf(answers: Record<string, string>): Decision | null {
  const d = (answers.decision ?? "").trim();
  for (const [key, label] of Object.entries(DECISION_OPTIONS) as [Decision, string][]) {
    if (d === label) return key;
  }
  return null;
}

export function decisionLabel(d: Decision | null): string {
  switch (d) {
    case "approved":
      return "אישר/ה את ביצוע הביטוח";
    case "change":
      return "מבקש/ת שינוי או הבהרה";
    case "declined":
      return "לא מעוניין/ת";
    default:
      return "טרם השיב/ה";
  }
}

/** Where the lead goes on Mslahtk's pipeline when the answer lands. */
export function leadStatusForDecision(d: Decision | null): string {
  switch (d) {
    case "approved":
      return "won";
    case "declined":
      return "lost";
    default:
      return "qualified";
  }
}

// ── Stage ───────────────────────────────────────────────────────────────────

export function answerLinkSentAt(offer: Pick<Submission, "answers"> | null): string | null {
  if (!offer) return null;
  const at = answersOf(offer)._answerLinkAt;
  return at || null;
}

export function caseStageOf(
  def: CaseDef,
  children: Pick<Submission, "formSlug" | "answers" | "createdAt">[],
): { stage: CaseStage; decision: Decision | null } {
  const answers = children.filter((c) => c.formSlug === def.answer);
  const offers = children.filter((c) => c.formSlug === def.offer);
  const latestAnswer = answers[answers.length - 1] ?? null;
  const latestOffer = offers[offers.length - 1] ?? null;
  if (latestAnswer) return { stage: "answered", decision: decisionOf(answersOf(latestAnswer)) };
  if (latestOffer) return { stage: answerLinkSentAt(latestOffer) ? "sent" : "offer", decision: null };
  return { stage: "request", decision: null };
}

export function stageLabel(stage: CaseStage, decision: Decision | null): string {
  switch (stage) {
    case "request":
      return "התקבלה בקשה";
    case "offer":
      return "הוכנה הצעה";
    case "sent":
      return "נשלח טופס תשובה";
    case "answered":
      return decisionLabel(decision);
  }
}

// ── Loading ─────────────────────────────────────────────────────────────────

/** The whole file by the REQUEST's id. Null when the id is not a case request. */
export async function loadCase(requestId: string): Promise<CaseFile | null> {
  if (!requestId) return null;
  const request = await db.submission.findUnique({
    where: { id: requestId },
    include: { children: { orderBy: { createdAt: "asc" } }, files: { orderBy: { createdAt: "asc" } } },
  });
  if (!request) return null;
  const def = caseOpenedBy(getForm(request.formSlug));
  if (!def) return null;

  const offers = request.children.filter((c) => c.formSlug === def.offer);
  const answers = request.children.filter((c) => c.formSlug === def.answer);
  const { stage, decision } = caseStageOf(def, request.children);
  return {
    def,
    request,
    offers,
    latestOffer: offers[offers.length - 1] ?? null,
    answers,
    latestAnswer: answers[answers.length - 1] ?? null,
    stage,
    decision,
    simulator: simulatorFromAnswers(answersOf(request)),
  };
}

/** The request a child (offer / answer) hangs off, for "back to the case" links. */
export async function parentCaseId(sub: Pick<Submission, "parentId" | "formSlug">): Promise<string | null> {
  if (!sub.parentId) return null;
  const def = caseOfChildForm(getForm(sub.formSlug));
  if (!def) return null;
  const parent = await db.submission.findUnique({ where: { id: sub.parentId }, select: { id: true, formSlug: true } });
  return parent && parent.formSlug === def.request ? parent.id : null;
}

/**
 * Note on the offer that form 3 was handed out, so the case reads "sent"
 * rather than "prepared" and the agent can see when.
 */
export async function markAnswerLinkSent(offerId: string): Promise<void> {
  const offer = await db.submission.findUnique({ where: { id: offerId }, select: { answers: true } });
  if (!offer) return;
  const answers = { ...answersOf(offer), _answerLinkAt: new Date().toISOString() };
  await db.submission.update({ where: { id: offerId }, data: { answers: answers as Prisma.InputJsonObject } });
}

// ── Mappings between the three forms ────────────────────────────────────────

const REQUEST_KIND: Record<string, string> = {
  "ביטוח מבנה בלבד": "מבנה בלבד",
  "ביטוח תכולה בלבד": "תכולה בלבד",
  "ביטוח מבנה ותכולה": "מבנה ותכולה",
};

const BIKES_OPTION = "אופניים / אופניים חשמליים (בכפוף לתנאי הפוליסה)";
const BUSINESS_OPTION = "פעילות עסקית בדירה (בכפוף לתנאי הפוליסה)";

function num(v: string | undefined): number {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** What the request form opens with when the customer arrives from the simulator. */
export function requestPrefillFromSimulator(input: HomeQuoteInput): Record<string, string> {
  const building = input.buildingSum > 0;
  const contents = input.contentsSum > 0;
  const out: Record<string, string> = {
    property_type: input.apartmentType === "בית פרטי" ? "בית פרטי" : "דירה בבית משותף",
    floor: input.apartmentType === "בית פרטי" ? "" : input.apartmentType,
    area_m2: String(Math.round(input.areaM2)),
    insurance_kind: building && contents ? "ביטוח מבנה ותכולה" : building ? "ביטוח מבנה בלבד" : "ביטוח תכולה בלבד",
    building_sum: building ? String(Math.round(input.buildingSum)) : "",
    contents_sum: contents ? String(Math.round(input.contentsSum)) : "",
    earthquake:
      input.earthquakeBuilding || input.earthquakeContents
        ? "מעוניין/ת בכיסוי"
        : "מבקש/ת לבחון אפשרות לוותר על הכיסוי ולקבל הסבר לפני קבלת החלטה",
    water: input.waterRoute !== "ללא" ? "מעוניין/ת בכיסוי" : "",
    water_route: input.waterRoute === "שרברב הסדר" ? "מסלול שרברב שבהסדר" : input.waterRoute === "שרברב פרטי" ? "מסלול שרברב פרטי" : "",
    jewelry: contents && !input.jewelryWaived ? "מעוניין/ת בכיסוי" : "לא מעוניין/ת",
    jewelry_sum: contents && !input.jewelryWaived && input.jewelrySum > 0 ? String(Math.round(input.jewelrySum)) : "",
    business_activity: input.businessActivity !== "אין" ? "כן" : "לא",
    business_activity_details: input.businessActivity !== "אין" ? input.businessActivity : "",
  };
  const extras: string[] = [];
  if (input.bikesAbove5000Sum > 0) extras.push(BIKES_OPTION);
  if (input.businessActivity !== "אין") extras.push(BUSINESS_OPTION);
  if (extras.length) out.extras = extras.join(", ");
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/** The offer form, opened beside the request: everything the request already said, plus the estimate. */
export function offerPrefill(file: CaseFile, previous?: Record<string, string>): Record<string, string> {
  // Editing an existing offer: start from what was saved, not from the request.
  if (previous && Object.keys(previous).length) {
    const copy: Record<string, string> = {};
    for (const [k, v] of Object.entries(previous)) if (!k.startsWith("_") && v) copy[k] = v;
    return copy;
  }

  const a = answersOf(file.request);
  const sim = file.simulator;
  const today = new Date();
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);

  const address = [
    [a.street, a.house_no].filter(Boolean).join(" "),
    a.apartment_no ? `דירה ${a.apartment_no}` : "",
    a.city,
    a.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const out: Record<string, string> = {
    insured_name: a.full_name ?? "",
    insured_id: a.id_number ?? "",
    insured_phone: a.phone ?? "",
    insured_address: address,
    offered_kind: REQUEST_KIND[a.insurance_kind ?? ""] ?? "",
    building_sum: sim ? String(Math.round(sim.input.buildingSum)) : a.building_sum ?? "",
    contents_sum: sim ? String(Math.round(sim.input.contentsSum)) : a.contents_sum ?? "",
    period_start: isoDate(today),
    period_end: isoDate(end),
    agency_name: SITE.legalName,
    offer_date: isoDate(today),
    har_result: a.har_consent ? "" : "לא בוצעה בדיקה",
  };

  if (sim) {
    const r = sim.result;
    out.insurer = "הכשרה ביטוח ופיננסים";
    out.earthquake = sim.input.earthquakeBuilding || sim.input.earthquakeContents ? "כלול" : "לא כלול";
    out.water =
      sim.input.waterRoute === "שרברב הסדר" ? "כלול: שרברב שבהסדר" : sim.input.waterRoute === "שרברב פרטי" ? "כלול: שרברב פרטי" : "לא כלול";
    out.premium = String(roundShekel(r.total));
    out.payments = "3";
    out.deductible_general = `${r.deductibles.general} ₪ (בנזק מעל ${r.deductibles.generalWaivedAbove.toLocaleString("he-IL")} ₪ ללא השתתפות עצמית)`;
    out.deductible_water = r.deductibles.water != null ? `${Math.round(r.deductibles.water).toLocaleString("he-IL")} ₪` : "";
    out.deductible_earthquake = `${r.deductibles.earthquakePercent}% מסכום הביטוח`;
    const extras = r.lines
      .filter((l) => l.amount > 0)
      .filter((l) => !["building", "contents", "earthquakeBuilding", "earthquakeContents", "water", "thirdParty", "jewelryExtra"].includes(l.key))
      .map((l) => l.label);
    if (extras.length) out.extras_included = extras.join(" · ");
    else out.extras_none = "אין הרחבות נוספות";
  } else {
    out.earthquake = a.earthquake === "מעוניין/ת בכיסוי" ? "כלול" : "";
    out.water =
      a.water_route === "מסלול שרברב שבהסדר" ? "כלול: שרברב שבהסדר" : a.water_route === "מסלול שרברב פרטי" ? "כלול: שרברב פרטי" : a.water ? "" : "לא כלול";
  }

  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/** Form 3: the offer's numbers, locked, so the customer answers THIS offer. */
export function answerPrefill(file: CaseFile): { values: Record<string, string>; locked: string[] } | null {
  const offer = file.latestOffer;
  if (!offer) return null;
  const o = answersOf(offer);
  const values: Record<string, string> = {
    insured_name: o.insured_name ?? "",
    insured_id: o.insured_id ?? "",
    insured_address: o.insured_address ?? "",
    insurer: o.insurer ?? "",
    premium: o.premium ?? "",
    period_start: o.period_start ?? "",
    sign_name: o.insured_name ?? "",
  };
  for (const k of Object.keys(values)) if (!values[k]) delete values[k];
  const locked = ["insured_name", "insured_id", "insured_address", "insurer", "premium", "period_start"].filter((k) => values[k]);
  return { values, locked };
}

// ── What the Mslahtk lead learns ────────────────────────────────────────────

export function leadFieldsForOffer(a: Record<string, string>): Record<string, string> {
  const sums = [a.building_sum ? `מבנה ${num(a.building_sum).toLocaleString("he-IL")} ₪` : "", a.contents_sum ? `תכולה ${num(a.contents_sum).toLocaleString("he-IL")} ₪` : ""]
    .filter(Boolean)
    .join(" / ");
  return {
    home_offer_insurer: a.insurer ?? "",
    home_offer_kind: a.offered_kind ?? "",
    home_offer_sums: sums,
    home_offer_premium: a.premium ? `${num(a.premium).toLocaleString("he-IL")} ₪` : "",
    home_offer_payments: a.payments ?? "",
    home_offer_period: [a.period_start, a.period_end].filter(Boolean).join(" עד "),
    home_offer_har: a.har_result ?? "",
    home_offer_savedAt: new Date().toISOString(),
  };
}

export function leadFieldsForAnswer(a: Record<string, string>): Record<string, string> {
  return {
    home_answer_decision: a.decision ?? "",
    home_answer_details: a.change_details ?? "",
    home_answer_requestedStart: a.requested_start ?? "",
    home_answer_at: new Date().toISOString(),
  };
}
