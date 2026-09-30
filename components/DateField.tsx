"use client";

import { useRef, type ChangeEvent } from "react";
import { DATE_PLACEHOLDER, displayToIso, isValidIsoDate, isoToDisplay, typedDate } from "@/lib/dates";

/**
 * A date the customer reads and types DAY FIRST, dd/mm/yyyy, whatever region
 * their browser is set to. A native date input cannot promise that (an English
 * phone prints mm/dd/yyyy), so the visible box is plain text with the format
 * done here, and the browser's own calendar is only offered as a picker beside
 * it.
 *
 * `value` is what the form holds: an ISO date ("2026-09-30") once what was
 * typed is a real day, and the raw text before that, so an unfinished or
 * impossible date (31/02/2026) is still there for the form to refuse instead of
 * being silently dropped.
 */
export default function DateField({
  id,
  value,
  onChange,
  readOnly = false,
  invalid = false,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const valid = isValidIsoDate(value);
  const shown = valid ? isoToDisplay(value) : value;

  function typed(e: ChangeEvent<HTMLInputElement>) {
    const next = typedDate(e.target.value, shown);
    onChange(displayToIso(next) ?? next);
  }

  function openCalendar() {
    const el = nativeRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
        return;
      }
    } catch {
      /* a browser that refuses outside a gesture falls through to click() */
    }
    el.focus();
    el.click();
  }

  return (
    <div className="fform__date">
      <input
        id={id}
        className="fform__date-text"
        type="text"
        inputMode="numeric"
        dir="ltr"
        maxLength={10}
        autoComplete="off"
        placeholder={DATE_PLACEHOLDER}
        value={shown}
        readOnly={readOnly}
        onChange={typed}
        onBlur={() => {
          // "3/9/2026" settles into "03/09/2026" when the person leaves the box.
          const iso = displayToIso(shown);
          if (iso && iso !== value) onChange(iso);
        }}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {!readOnly && (
        <>
          <button type="button" className="fform__date-btn" onClick={openCalendar} aria-label="בחירת תאריך מלוח שנה">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </button>
          <input
            ref={nativeRef}
            className="fform__date-native"
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            min="1900-01-01"
            max="2100-12-31"
            value={valid ? value : ""}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value);
            }}
          />
        </>
      )}
    </div>
  );
}
