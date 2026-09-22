"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  APARTMENT_TYPES,
  BUSINESS_ACTIVITIES,
  BUILDING_PER_M2,
  DEFAULT_INPUT,
  JEWELRY_FREE_SHARE,
  THIRD_PARTY_LIMITS,
  computeHomeQuote,
  defaultBuildingSum,
  encodeSnapshot,
  roundShekel,
  type AbroadCover,
  type ApartmentType,
  type BusinessActivity,
  type HomeQuoteInput,
  type ThirdPartyLimit,
  type WaterRoute,
} from "@/lib/home-quote";
import { SITE, TEL_HREF } from "@/lib/site";

type Kind = "both" | "building" | "contents";
type JewelryMode = "included" | "more" | "none";

const shekel = (n: number) => `${roundShekel(n).toLocaleString("he-IL")} ₪`;

function kindOf(i: HomeQuoteInput): Kind {
  if (i.buildingSum > 0 && i.contentsSum > 0) return "both";
  return i.buildingSum > 0 ? "building" : "contents";
}

function jewelryModeOf(i: HomeQuoteInput): JewelryMode {
  if (i.jewelryWaived) return "none";
  return i.jewelrySum > i.contentsSum * JEWELRY_FREE_SHARE + 0.5 ? "more" : "included";
}

/**
 * The customer-facing face of lib/home-quote.ts. Every change re-prices on the
 * spot; the "continue" button carries the whole state into the request form.
 */
export default function HomeQuoteSimulator({ initial }: { initial: HomeQuoteInput | null }) {
  const start = initial ?? DEFAULT_INPUT;
  const [inp, setInp] = useState<HomeQuoteInput>(start);
  const [kind, setKind] = useState<Kind>(() => kindOf(start));
  const [jewelry, setJewelry] = useState<JewelryMode>(() => jewelryModeOf(start));
  // The building sum follows the area (7,000 ₪ per m², the generator's own
  // rule) until the customer types their own number.
  const [buildingAuto, setBuildingAuto] = useState(() => start.buildingSum === defaultBuildingSum(start.areaM2));
  const [remembered, setRemembered] = useState({
    building: start.buildingSum || defaultBuildingSum(start.areaM2),
    contents: start.contentsSum || DEFAULT_INPUT.contentsSum,
  });
  const [showLines, setShowLines] = useState(false);

  const result = useMemo(() => computeHomeQuote(inp), [inp]);
  const continueHref = useMemo(() => `/forms/home-request?sim=${encodeURIComponent(encodeSnapshot(inp))}`, [inp]);

  function set<K extends keyof HomeQuoteInput>(key: K, value: HomeQuoteInput[K]) {
    setInp((s) => ({ ...s, [key]: value }));
  }
  const numberOf = (e: ChangeEvent<HTMLInputElement>) => Math.max(0, Number(e.target.value) || 0);

  function changeArea(e: ChangeEvent<HTMLInputElement>) {
    const area = numberOf(e);
    setInp((s) => ({ ...s, areaM2: area, ...(buildingAuto && kind !== "contents" ? { buildingSum: defaultBuildingSum(area) } : {}) }));
  }
  function changeBuilding(e: ChangeEvent<HTMLInputElement>) {
    const v = numberOf(e);
    setBuildingAuto(false);
    setRemembered((r) => ({ ...r, building: v }));
    set("buildingSum", v);
  }
  function changeContents(e: ChangeEvent<HTMLInputElement>) {
    const v = numberOf(e);
    setRemembered((r) => ({ ...r, contents: v }));
    setInp((s) => ({ ...s, contentsSum: v, ...(jewelry === "included" ? { jewelrySum: v * JEWELRY_FREE_SHARE } : {}) }));
  }
  function changeKind(next: Kind) {
    setKind(next);
    setInp((s) => {
      const building = next === "contents" ? 0 : s.buildingSum || remembered.building || defaultBuildingSum(s.areaM2);
      const contents = next === "building" ? 0 : s.contentsSum || remembered.contents;
      return { ...s, buildingSum: building, contentsSum: contents, ...(jewelry === "included" ? { jewelrySum: contents * JEWELRY_FREE_SHARE } : {}) };
    });
  }
  function changeJewelry(mode: JewelryMode) {
    setJewelry(mode);
    setInp((s) => {
      if (mode === "none") return { ...s, jewelryWaived: true, jewelrySum: 0 };
      const free = s.contentsSum * JEWELRY_FREE_SHARE;
      return { ...s, jewelryWaived: false, jewelrySum: mode === "included" ? free : Math.max(s.jewelrySum, free + 10000) };
    });
  }
  function changeAbroad(key: "abroadJewelry" | "abroadCamera" | "abroadLaptop", patch: Partial<AbroadCover>) {
    setInp((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

  const lines = result.lines;
  const total = result.total;

  return (
    <div className="sim__layout">
      <div className="sim__form">
        <Section num="01" title="הדירה">
          <div className="fform__grid">
            <div className="field fform__cell fform__cell--half">
              <label htmlFor="sim-type">סוג הדירה</label>
              <select id="sim-type" value={inp.apartmentType} onChange={(e) => set("apartmentType", e.target.value as ApartmentType)}>
                {APARTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <NumberField id="sim-area" label='שטח הדירה במ"ר (לפי הארנונה)' value={inp.areaM2} onChange={changeArea} half />
          </div>
        </Section>

        <Section num="02" title="מה לבטח">
          <Chips
            label="סוג הביטוח"
            options={[
              ["both", "מבנה ותכולה"],
              ["building", "מבנה בלבד"],
              ["contents", "תכולה בלבד"],
            ]}
            value={kind}
            onChange={changeKind}
          />
          <div className="fform__grid">
            {kind !== "contents" && (
              <NumberField
                id="sim-building"
                label="סכום ביטוח המבנה (₪)"
                value={inp.buildingSum}
                onChange={changeBuilding}
                hint={`מחושב אוטומטית לפי ${BUILDING_PER_M2.toLocaleString("he-IL")} ₪ למ"ר. אפשר לשנות.`}
                half
              />
            )}
            {kind !== "building" && (
              <NumberField id="sim-contents" label="סכום ביטוח התכולה (₪)" value={inp.contentsSum} onChange={changeContents} hint="שווי הריהוט, מכשירי החשמל, הביגוד וכל מה שבדירה." half />
            )}
          </div>
          {kind !== "building" && (
            <>
              <Chips
                label="תכשיטים וחפצי ערך"
                options={[
                  ["included", `עד 20% מהתכולה (${shekel(inp.contentsSum * JEWELRY_FREE_SHARE)}), כלול`],
                  ["more", "סכום גבוה יותר"],
                  ["none", "ויתור על כיסוי תכשיטים"],
                ]}
                value={jewelry}
                onChange={changeJewelry}
              />
              {jewelry === "more" && (
                <div className="fform__grid">
                  <NumberField
                    id="sim-jewelry"
                    label="סכום ביטוח כולל לתכשיטים (₪)"
                    value={inp.jewelrySum}
                    onChange={(e) => set("jewelrySum", numberOf(e))}
                    hint="מעל 20% מהתכולה נדרשת הערכת שמאי או פירוט, ותוספת פרמיה."
                    half
                  />
                </div>
              )}
            </>
          )}
        </Section>

        <Section num="03" title="כיסויים">
          <div className="sim__toggles">
            {kind !== "contents" && <Toggle label="רעידת אדמה למבנה" on={inp.earthquakeBuilding} onChange={(v) => set("earthquakeBuilding", v)} />}
            {kind !== "building" && <Toggle label="רעידת אדמה לתכולה" on={inp.earthquakeContents} onChange={(v) => set("earthquakeContents", v)} />}
          </div>
          <p className="sim__hint">רעידת אדמה מזכה בהנחה משמעותית על הפרמיה הבסיסית, לכן ויתור עליה לא תמיד מוזיל.</p>
          {kind !== "contents" && (
            <Chips
              label="נזקי מים וצנרת"
              options={[
                ["שרברב הסדר", "שרברב שבהסדר"],
                ["שרברב פרטי", "שרברב פרטי"],
                ["ללא", "ללא כיסוי"],
              ]}
              value={inp.waterRoute}
              onChange={(v) => set("waterRoute", v as WaterRoute)}
            />
          )}
          <div className="fform__grid">
            <div className="field fform__cell fform__cell--half">
              <label htmlFor="sim-tp">גבול אחריות כלפי צד שלישי</label>
              <select id="sim-tp" value={inp.thirdPartyLimit} onChange={(e) => set("thirdPartyLimit", Number(e.target.value) as ThirdPartyLimit)}>
                {THIRD_PARTY_LIMITS.map((l) => (
                  <option key={l} value={l}>
                    {l.toLocaleString("he-IL")} ₪{l === 1500000 ? " (כלול)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <details className="sim__more">
          <summary>הרחבות ומצבים מיוחדים (אופציונלי)</summary>
          <div className="sim__more-body">
            <div>
              <span className="fform__group-label">השכרה ושימוש</span>
              <div className="sim__toggles">
                <Toggle label="השכרה לטווח קצר (AIRBNB)" on={inp.airbnb} onChange={(v) => set("airbnb", v)} />
                <Toggle label="סאבלט" on={inp.sublet} onChange={(v) => set("sublet", v)} />
                <Toggle label="בנייה מעץ (כולה או חלקה)" on={inp.wooden} onChange={(v) => set("wooden", v)} />
              </div>
            </div>
            <div className="sim__row">
              <div className="field">
                <label htmlFor="sim-biz">פעילות עסקית בדירה</label>
                <select id="sim-biz" value={inp.businessActivity} onChange={(e) => set("businessActivity", e.target.value as BusinessActivity)}>
                  {BUSINESS_ACTIVITIES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <NumberField id="sim-split" label="דירה מפוצלת: מספר יחידות (0 = לא מפוצלת)" value={inp.splitUnits} onChange={(e) => set("splitUnits", Math.round(numberOf(e)))} />
            </div>
            <div className="sim__row">
              <NumberField id="sim-parking" label="מכפיל חניה, סכום ביטוח (₪)" value={inp.parkingStackerSum} onChange={(e) => set("parkingStackerSum", numberOf(e))} />
              <NumberField id="sim-ev" label="מטען לרכב חשמלי, סכום ביטוח (₪)" value={inp.evChargerSum} onChange={(e) => set("evChargerSum", numberOf(e))} />
              <NumberField id="sim-pool" label="בריכה, סכום ביטוח (₪)" value={inp.poolSum} onChange={(e) => set("poolSum", numberOf(e))} />
              <NumberField id="sim-pv" label="מערכת פוטו-וולטאית, סכום ביטוח (₪)" value={inp.photovoltaicSum} onChange={(e) => set("photovoltaicSum", numberOf(e))} hint="עד 150,000 ₪" />
            </div>
            <div className="sim__toggles">
              <Toggle label="צד שלישי לבריכת שחייה" on={inp.poolThirdParty} onChange={(v) => set("poolThirdParty", v)} />
              <Toggle label="דודי שמש" on={inp.solarHeaters} onChange={(v) => set("solarHeaters", v)} />
              <Toggle label="חיות מחמד (מוות)" on={inp.pets} onChange={(v) => set("pets", v)} />
              <Toggle label="טרור (עד 500 אלף ₪)" on={inp.terror} onChange={(v) => set("terror", v)} />
              <Toggle label="הרחבות למגזר הדתי" on={inp.religiousExtensions} onChange={(v) => set("religiousExtensions", v)} />
            </div>
            <div>
              <span className="fform__group-label">פריטי ערך בתכולה (סכום ביטוח בש״ח)</span>
              <div className="sim__row">
                <NumberField id="sim-bikes" label="אופניים מעל 5,000 ₪" value={inp.bikesAbove5000Sum} onChange={(e) => set("bikesAbove5000Sum", numberOf(e))} />
                <NumberField id="sim-laptop" label="מחשב נייד / טאבלט" value={inp.laptopSum} onChange={(e) => set("laptopSum", numberOf(e))} />
                <NumberField id="sim-camera" label="ציוד צילום" value={inp.cameraSum} onChange={(e) => set("cameraSum", numberOf(e))} />
                <NumberField id="sim-instruments" label="כלי נגינה" value={inp.instrumentsSum} onChange={(e) => set("instrumentsSum", numberOf(e))} />
                <NumberField id="sim-furs" label="פרוות" value={inp.fursSum} onChange={(e) => set("fursSum", numberOf(e))} />
                <NumberField id="sim-stamps" label="בולים" value={inp.stampsSum} onChange={(e) => set("stampsSum", numberOf(e))} />
                <NumberField id="sim-silver" label="כלי כסף" value={inp.silverSum} onChange={(e) => set("silverSum", numberOf(e))} />
                <NumberField id="sim-gun" label="אקדח אישי ברישיון (עד 7,500 ₪)" value={inp.gunSum} onChange={(e) => set("gunSum", numberOf(e))} />
              </div>
            </div>
            <div>
              <span className="fform__group-label">כיסוי בחו״ל (ימים וסכום ביטוח)</span>
              <div className="sim__row">
                <AbroadRow id="sim-ab-j" label="תכשיטים בחו״ל" value={inp.abroadJewelry} onChange={(p) => changeAbroad("abroadJewelry", p)} />
                <AbroadRow id="sim-ab-c" label="ציוד צילום בחו״ל" value={inp.abroadCamera} onChange={(p) => changeAbroad("abroadCamera", p)} />
                <AbroadRow id="sim-ab-l" label="מחשב בחו״ל" value={inp.abroadLaptop} onChange={(p) => changeAbroad("abroadLaptop", p)} />
              </div>
            </div>
            <div className="sim__row">
              <NumberField id="sim-unocc" label="דירה שאינה תפוסה: מספר ימים (60 הראשונים כלולים)" value={inp.unoccupiedDays} onChange={(e) => set("unoccupiedDays", Math.round(numberOf(e)))} />
              <NumberField id="sim-toilets" label="שבר אסלות, סכום ביטוח (₪)" value={inp.toiletsSum} onChange={(e) => set("toiletsSum", numberOf(e))} />
              {kind !== "contents" && (
                <>
                  <NumberField id="sim-eqx" label="סכום נוסף לרעידת אדמה בלבד (₪)" value={inp.earthquakeExtraSum} onChange={(e) => set("earthquakeExtraSum", numberOf(e))} hint="לפחות 100% מסכום ביטוח המבנה" />
                  <NumberField id="sim-eqfx" label="סכום נוסף לרעידת אדמה ואש (₪)" value={inp.earthquakeFireExtraSum} onChange={(e) => set("earthquakeFireExtraSum", numberOf(e))} hint="לפחות 100% מסכום ביטוח המבנה" />
                </>
              )}
            </div>
          </div>
        </details>
      </div>

      <aside className="sim__result" aria-live="polite">
        <span className="sim__result-label">הערכה ראשונית</span>
        {result.blocked ? (
          <>
            <div className="sim__total">לפי חתם</div>
            <p className="sim__per">{result.blocked}</p>
          </>
        ) : (
          <>
            <div className="sim__total">
              {shekel(total)}
              <small>לשנה</small>
            </div>
            <p className="sim__per">ב-3 תשלומים ללא ריבית והצמדה · כולל דמי פוליסה</p>
          </>
        )}

        <div className="sim__cta">
          <Link className="map-btn map-btn--primary" href={continueHref}>
            מעוניין/ת בהצעה? להמשך לבקשה
          </Link>
          <a className="map-btn" href={TEL_HREF} dir="ltr">
            {SITE.phoneDisplay}
          </a>
        </div>

        {!result.blocked && (
          <>
            <button type="button" className="sim__toggle-lines" onClick={() => setShowLines((v) => !v)} aria-expanded={showLines}>
              {showLines ? "הסתרת הפירוט" : "פירוט החישוב"}
            </button>
            {showLines && (
              <ul className="sim__lines">
                {lines.map((l) => (
                  <li key={l.key} className={`sim__line${l.amount < 0 ? " sim__line--discount" : ""}`}>
                    <span>{l.label}</span>
                    <span dir="ltr">{l.amount < 0 ? `-${shekel(-l.amount)}` : shekel(l.amount)}</span>
                  </li>
                ))}
                {result.minimumTopUp > 0 && (
                  <li className="sim__line">
                    <span>השלמה לפרמיית מינימום ({shekel(result.minimumPremium)})</span>
                    <span dir="ltr">{shekel(result.minimumTopUp)}</span>
                  </li>
                )}
                <li className="sim__line">
                  <span>דמי פוליסה</span>
                  <span dir="ltr">{shekel(result.policyFee)}</span>
                </li>
                <li className="sim__line sim__line--sum">
                  <span>סה״כ לשנה</span>
                  <span dir="ltr">{shekel(total)}</span>
                </li>
              </ul>
            )}

            <div className="sim__sub">השתתפות עצמית</div>
            <ul className="sim__list sim__list--plain">
              <li>
                כל נזק (למעט רעידת אדמה ונזקי מים): {shekel(result.deductibles.general)}. בנזק מעל{" "}
                {result.deductibles.generalWaivedAbove.toLocaleString("he-IL")} ₪: ללא השתתפות עצמית.
              </li>
              {result.deductibles.water != null && (
                <li>
                  נזקי מים: {shekel(result.deductibles.water)} · קריאת סרק: {shekel(result.deductibles.waterFalseCall)}
                </li>
              )}
              {(inp.earthquakeBuilding || inp.earthquakeContents) && <li>רעידת אדמה: {result.deductibles.earthquakePercent}% מסכום הביטוח</li>}
            </ul>

            <div className="sim__sub">כלול בפוליסה</div>
            <ul className="sim__list">
              {result.included.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}

        {result.warnings.length > 0 && (
          <div className="sim__warn" role="status">
            {result.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}

        <p className="sim__disclaimer">
          ההערכה מבוססת על מחולל התעריפים של הכשרה ביטוח (מהדורה 05/2026) ואינה מהווה הצעת ביטוח. המחיר הסופי כפוף
          לחיתום, לתנאי הפוליסה ולאישור חברת הביטוח.
        </p>
      </aside>

      <div className="sim__bar" aria-hidden="true">
        <div className="sim__bar-total">
          {result.blocked ? "לפי חתם" : shekel(total)}
          {!result.blocked && <small>לשנה</small>}
        </div>
        <Link className="map-btn map-btn--primary" href={continueHref}>
          להמשך לבקשה
        </Link>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <section className="fform__section">
      <div className="fform__section-head">
        <span className="fform__section-num">{num}</span>
        <div>
          <h2 className="fform__section-title">{title}</h2>
        </div>
      </div>
      <div className="sim__section-body">{children}</div>
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  half,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  half?: boolean;
}) {
  return (
    <div className={`field fform__cell${half ? " fform__cell--half" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={0} value={value === 0 ? "" : value} placeholder="0" onChange={onChange} />
      {hint && <p className="sim__hint">{hint}</p>}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`fform__option${on ? " is-on" : ""}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="fform__cell fform__cell--full sim__chips" role="group" aria-label={label}>
      <span className="fform__group-label">{label}</span>
      <div className="fform__options">
        {options.map(([v, text]) => (
          <label key={v} className={`fform__option${value === v ? " is-on" : ""}`}>
            <input type="radio" name={label} checked={value === v} onChange={() => onChange(v)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function AbroadRow({ id, label, value, onChange }: { id: string; label: string; value: AbroadCover; onChange: (p: Partial<AbroadCover>) => void }) {
  return (
    <div className="field sim__abroad">
      <label htmlFor={`${id}-days`}>{label}</label>
      <div className="sim__abroad-inputs">
        <input id={`${id}-days`} type="number" inputMode="numeric" min={0} max={365} placeholder="ימים" value={value.days || ""} onChange={(e) => onChange({ days: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
        <input id={`${id}-sum`} type="number" inputMode="numeric" min={0} placeholder="סכום ₪" value={value.sum || ""} onChange={(e) => onChange({ sum: Math.max(0, Number(e.target.value) || 0) })} />
      </div>
    </div>
  );
}
