"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACCEPT_ATTR,
  MAX_FILES_PER_FIELD,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  allFields,
  conflictingOptions,
  formatBytes,
  isFieldVisible,
  isValidIsraeliId,
  type FormDef,
  type FormField,
} from "@/lib/forms";
import { SITE, TEL_HREF, WA_HREF } from "@/lib/site";

type Values = Record<string, string | string[]>;
type FileMap = Record<string, File[]>;
type Status = "idle" | "processing" | "sending" | "done";

const draftKey = (slug: string) => `yaarit:form-draft:${slug}`;

/**
 * Shrink camera photos before they are attached. Phone images run 3–5MB each,
 * and with no object storage every byte travels inside the email — a 4MB shot
 * comes out around 250KB here with no meaningful loss for a document scan.
 * HEIC is left alone: canvas cannot decode it, and iOS already hands over JPEG
 * when the picker is used.
 */
async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  if (file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxEdge = 1800;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // any decode failure just sends the original
  }
}

export default function FormRenderer({
  form,
  prefill = {},
  locked = [],
  prefillToken,
}: {
  form: FormDef;
  prefill?: Record<string, string>;
  /** Field names the agency filled in and the customer may not change. */
  locked?: string[];
  /** The signed token those locks came from, replayed with the submission. */
  prefillToken?: string;
}) {
  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const fields = useMemo(() => allFields(form), [form]);
  const [values, setValues] = useState<Values>({});
  const [files, setFiles] = useState<FileMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Restore the draft after mount (never during render — sessionStorage is not
  // available on the server and would break hydration).
  useEffect(() => {
    let restored: Values = {};
    try {
      const raw = sessionStorage.getItem(draftKey(form.slug));
      if (raw) restored = JSON.parse(raw) as Values;
    } catch {
      /* private mode / quota — fall through to the prefill only */
    }
    setValues({ ...restored, ...prefill });
    // prefill is derived from the URL and stable for the life of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug]);

  // Keep the draft alive across an accidental refresh. Text answers only —
  // File objects cannot be serialised, so uploads are re-picked after a reload.
  useEffect(() => {
    if (status === "done" || !Object.keys(values).length) return;
    try {
      sessionStorage.setItem(draftKey(form.slug), JSON.stringify(values));
    } catch {
      /* quota exceeded — the draft is a convenience, not a requirement */
    }
  }, [values, form.slug, status]);

  const totalBytes = Object.values(files)
    .flat()
    .reduce((sum, f) => sum + f.size, 0);

  function setValue(name: string, value: string | string[]) {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
  }

  function toggleInList(field: FormField, option: string) {
    const name = field.name;
    const current = Array.isArray(values[name]) ? (values[name] as string[]) : [];
    if (current.includes(option)) {
      setValue(name, current.filter((o) => o !== option));
      return;
    }
    // Selecting an option drops anything it cannot be combined with, rather
    // than letting the customer build an invalid pair and only learning at
    // submit (מקיף and צד ג׳ are alternatives, not additions).
    const conflicts = conflictingOptions(field, option);
    setValue(name, [...current.filter((o) => !conflicts.includes(o)), option]);
  }

  async function addFiles(field: FormField, picked: FileList | null) {
    if (!picked?.length) return;
    setStatus("processing");
    const incoming = await Promise.all(Array.from(picked).map(compressImage));
    setStatus("idle");
    setFiles((prev) => {
      const existing = prev[field.name] ?? [];
      const merged = field.multiple ? [...existing, ...incoming] : incoming.slice(0, 1);
      return { ...prev, [field.name]: merged.slice(0, MAX_FILES_PER_FIELD) };
    });
    setErrors((e) => (e[field.name] ? { ...e, [field.name]: "" } : e));
  }

  function removeFile(name: string, index: number) {
    setFiles((prev) => ({ ...prev, [name]: (prev[name] ?? []).filter((_, i) => i !== index) }));
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const f of fields) {
      // A field the customer was never shown can never be required of them.
      if (f.type === "statement" || !isFieldVisible(form, f, values)) continue;
      const raw = values[f.name];
      const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "").trim();

      if (f.type === "file") {
        const picked = files[f.name] ?? [];
        if (f.required && !picked.length) next[f.name] = "יש לצרף קובץ";
        const tooBig = picked.find((p) => p.size > MAX_FILE_BYTES);
        if (tooBig) next[f.name] = `הקובץ "${tooBig.name}" גדול מ־${formatBytes(MAX_FILE_BYTES)}`;
        continue;
      }
      if (f.type === "consent") {
        if (value !== "on") next[f.name] = "יש לאשר כדי לשלוח";
        continue;
      }
      if (f.required && !value) {
        next[f.name] = "שדה חובה";
        continue;
      }
      if (!value) continue;
      if (f.type === "id" && !isValidIsraeliId(value)) next[f.name] = "מספר תעודת זהות אינו תקין";
      if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
        next[f.name] = "כתובת דוא״ל אינה תקינה";
      if (f.type === "tel" && value.replace(/\D/g, "").length < 9)
        next[f.name] = "מספר טלפון אינו תקין";
      if (f.type === "number") {
        const n = Number(value);
        if (!Number.isFinite(n)) next[f.name] = "יש להזין מספר";
        else if (f.min !== undefined && n < f.min) next[f.name] = `יש להזין ערך של ${f.min} ומעלה`;
        else if (f.max !== undefined && n > f.max) next[f.name] = `יש להזין ערך עד ${f.max}`;
      }
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const found = validate();
    setErrors(found);
    const firstBad = Object.keys(found).find((k) => found[k]);
    if (firstBad) {
      formRef.current
        ?.querySelector<HTMLElement>(`[data-field="${firstBad}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      setServerError(
        `סך הקבצים (${formatBytes(totalBytes)}) חורג מהמותר (${formatBytes(MAX_TOTAL_BYTES)}). הסירו קובץ ונסו שוב.`,
      );
      return;
    }

    const body = new FormData();
    body.append("_hp", (values._hp as string) ?? "");
    if (prefillToken) body.append("_prefill", prefillToken);
    for (const f of fields) {
      if (f.type === "statement" || !isFieldVisible(form, f, values)) continue;
      if (f.type === "file") {
        for (const file of files[f.name] ?? []) body.append(f.name, file, file.name);
        continue;
      }
      const raw = values[f.name];
      if (Array.isArray(raw)) raw.forEach((v) => body.append(f.name, v));
      else if (raw) body.append(f.name, raw);
    }

    setStatus("sending");
    try {
      const res = await fetch(`/api/forms/${form.slug}`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setServerError(json.error ?? "השליחה נכשלה. נסו שוב.");
        setStatus("idle");
        return;
      }
      try {
        sessionStorage.removeItem(draftKey(form.slug));
      } catch {
        /* nothing to clean up */
      }
      setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError("אין חיבור לשרת. בדקו את הרשת ונסו שוב.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="fform__done" role="status">
        <div className="fform__done-mark" aria-hidden="true">✓</div>
        <h2 className="fform__done-title">{form.successTitle}</h2>
        <p className="fform__done-body">{form.successBody}</p>
        <div className="fform__done-actions">
          <a className="map-btn map-btn--primary" href={TEL_HREF} dir="ltr">
            {SITE.phoneDisplay}
          </a>
          <a className="map-btn" href={WA_HREF} target="_blank" rel="noopener noreferrer">
            ווטסאפ
          </a>
        </div>
      </div>
    );
  }

  const busy = status === "sending" || status === "processing";

  return (
    <form className="fform" ref={formRef} onSubmit={onSubmit} noValidate>
      {form.sections.map((section, si) => {
        const shown = section.fields.filter((f) => isFieldVisible(form, f, values));
        if (!shown.length) return null;
        return (
        <section className="fform__section" key={section.title}>
          <div className="fform__section-head">
            <span className="fform__section-num">{String(si + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="fform__section-title">{section.title}</h2>
              {section.description && (
                <p className="fform__section-desc">{section.description}</p>
              )}
            </div>
          </div>

          <div className="fform__grid">
            {shown.map((field) => (
              <Field
                key={field.name}
                field={field}
                locked={lockedSet.has(field.name)}
                value={values[field.name]}
                files={files[field.name] ?? []}
                error={errors[field.name]}
                onValue={setValue}
                onToggle={toggleInList}
                onFiles={addFiles}
                onRemoveFile={removeFile}
              />
            ))}
          </div>
        </section>
        );
      })}

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="fform__hp"
        value={(values._hp as string) ?? ""}
        onChange={(e) => setValue("_hp", e.target.value)}
      />

      {totalBytes > 0 && (
        <div className="fform__meter">
          קבצים מצורפים: {formatBytes(totalBytes)} מתוך {formatBytes(MAX_TOTAL_BYTES)}
        </div>
      )}

      {serverError && (
        <div className="fform__alert" role="alert">
          {serverError}
        </div>
      )}

      <button type="submit" className="form__submit fform__submit" disabled={busy}>
        {status === "processing"
          ? "מכין את הקבצים…"
          : status === "sending"
            ? "שולח…"
            : form.submitLabel}
      </button>
      <p className="form__note">
        הפרטים נשלחים ישירות לתיבת הדואר של הסוכנות ואינם נשמרים באתר.
      </p>
    </form>
  );
}

function Field({
  field,
  locked,
  value,
  files,
  error,
  onValue,
  onToggle,
  onFiles,
  onRemoveFile,
}: {
  field: FormField;
  locked: boolean;
  value: string | string[] | undefined;
  files: File[];
  error?: string;
  onValue: (name: string, value: string) => void;
  onToggle: (field: FormField, option: string) => void;
  onFiles: (field: FormField, list: FileList | null) => void;
  onRemoveFile: (name: string, index: number) => void;
}) {
  const id = `f-${field.name}`;
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const describedBy = error ? `${id}-err` : field.help ? `${id}-help` : undefined;

  const cell = `field fform__cell${field.half ? " fform__cell--half" : ""}${
    error ? " fform__cell--error" : ""
  }${locked ? " fform__cell--locked" : ""}`;

  const help = field.help && !error && (
    <p className="fform__help" id={`${id}-help`}>
      {field.help}
    </p>
  );
  const err = error && (
    <p className="fform__error" id={`${id}-err`} role="alert">
      {error}
    </p>
  );

  if (field.type === "statement") {
    return (
      <div className="fform__cell fform__cell--full" data-field={field.name}>
        <div className="fform__statement">
          {(field.body ?? "").split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "consent") {
    return (
      <div className={`${cell} fform__cell--full`} data-field={field.name}>
        <label className="fform__consent">
          <input
            type="checkbox"
            checked={text === "on"}
            onChange={(e) => onValue(field.name, e.target.checked ? "on" : "")}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
          <span>{field.label}</span>
        </label>
        {err}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div className={`${cell} fform__cell--full`} data-field={field.name}>
        <label htmlFor={id}>
          {field.label}
          {!field.required && <span className="fform__optional">אופציונלי</span>}
        </label>
        <label className="fform__drop" htmlFor={id}>
          <span className="fform__drop-icon" aria-hidden="true">＋</span>
          <span className="fform__drop-text">
            {field.multiple ? "בחרו קבצים או צלמו" : "בחרו קובץ או צלמו"}
            <em className="fform__drop-hint">JPG · PNG · PDF · עד {formatBytes(MAX_FILE_BYTES)}</em>
          </span>
        </label>
        <input
          id={id}
          type="file"
          className="fform__file-input"
          accept={ACCEPT_ATTR}
          multiple={field.multiple}
          onChange={(e) => {
            onFiles(field, e.target.files);
            e.target.value = ""; // let the same file be re-picked after removal
          }}
          aria-describedby={describedBy}
        />
        {files.length > 0 && (
          <ul className="fform__files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="fform__file">
                <span className="fform__file-name">{f.name}</span>
                <span className="fform__file-size">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  className="fform__file-remove"
                  onClick={() => onRemoveFile(field.name, i)}
                  aria-label={`הסרת הקובץ ${f.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {help}
        {err}
      </div>
    );
  }

  if (field.type === "radio" || (field.type === "checkbox" && field.options)) {
    const multi = field.type === "checkbox";
    return (
      <div className={`${cell} fform__cell--full`} data-field={field.name} role="group" aria-labelledby={`${id}-lbl`}>
        <span className="fform__group-label" id={`${id}-lbl`}>
          {field.label}
        </span>
        <div className="fform__options">
          {field.options?.map((opt) => {
            const checked = multi ? list.includes(opt) : text === opt;
            return (
              <label key={opt} className={`fform__option${checked ? " is-on" : ""}`}>
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={field.name}
                  disabled={locked}
                  checked={checked}
                  onChange={() => (multi ? onToggle(field, opt) : onValue(field.name, opt))}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
        {help}
        {err}
      </div>
    );
  }

  return (
    <div className={cell} data-field={field.name}>
      <label htmlFor={id}>
        {field.label}
        {field.required && !locked && <span className="fform__req" aria-hidden="true">*</span>}
        {locked && <span className="fform__lock">מולא על ידי הסוכנות</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={text}
          readOnly={locked}
          placeholder={field.placeholder}
          onChange={(e) => onValue(field.name, e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          value={text}
          disabled={locked}
          onChange={(e) => onValue(field.name, e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        >
          <option value="">בחרו…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type === "id" ? "text" : field.type}
          inputMode={
            field.type === "id" || field.type === "number"
              ? "numeric"
              : field.type === "tel"
                ? "tel"
                : undefined
          }
          min={field.min}
          max={field.max}
          readOnly={locked}
          dir={field.type === "email" ? "ltr" : undefined}
          value={text}
          placeholder={field.placeholder}
          autoComplete={autocompleteFor(field)}
          onChange={(e) => onValue(field.name, e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      )}
      {help}
      {err}
    </div>
  );
}

// Lets phone keyboards and browser autofill do the obvious thing. Keyed by
// what the field means where the form says so, and by its own name otherwise.
const AUTOCOMPLETE: Record<string, string> = {
  phone: "tel",
  email: "email",
  address: "street-address",
};

function autocompleteFor(field: FormField): string | undefined {
  if (field.identity === "name") return "name";
  return AUTOCOMPLETE[field.name];
}
