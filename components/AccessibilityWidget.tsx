"use client";

import { useEffect, useRef, useState } from "react";

type Settings = {
  zoom: number; // 0..4
  contrast: boolean;
  grayscale: boolean;
  links: boolean;
  readable: boolean;
  bigCursor: boolean;
  noAnim: boolean;
};

const DEFAULTS: Settings = {
  zoom: 0,
  contrast: false,
  grayscale: false,
  links: false,
  readable: false,
  bigCursor: false,
  noAnim: false,
};

const KEY = "almagor-a11y";
const MAX_ZOOM = 4;
const ZOOM_PCT = [100, 110, 125, 140, 160];

function apply(s: Settings) {
  const el = document.documentElement;
  el.setAttribute("data-a11y-zoom", String(s.zoom));
  el.classList.toggle("a11y-contrast", s.contrast);
  el.classList.toggle("a11y-grayscale", s.grayscale);
  el.classList.toggle("a11y-links", s.links);
  el.classList.toggle("a11y-readable", s.readable);
  el.classList.toggle("a11y-bigcursor", s.bigCursor);
  el.classList.toggle("a11y-noanim", s.noAnim);
}

const TOGGLES: { key: keyof Settings; label: string; icon: string }[] = [
  { key: "contrast", label: "ניגודיות גבוהה", icon: "◐" },
  { key: "grayscale", label: "גווני אפור", icon: "🌓" },
  { key: "links", label: "הדגשת קישורים", icon: "🔗" },
  { key: "readable", label: "גופן קריא", icon: "Aa" },
  { key: "bigCursor", label: "סמן גדול", icon: "➤" },
  { key: "noAnim", label: "עצירת אנימציות", icon: "⏸" },
];

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Load saved settings on mount and apply them.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: Settings = { ...DEFAULTS, ...JSON.parse(raw) };
        setS(parsed);
        apply(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist + apply whenever settings change.
  useEffect(() => {
    apply(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  // Close on Escape / outside click while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(t) &&
        !btnRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const setZoom = (z: number) =>
    setS((p) => ({ ...p, zoom: Math.min(MAX_ZOOM, Math.max(0, z)) }));
  const toggle = (k: keyof Settings) =>
    setS((p) => ({ ...p, [k]: !p[k] }));

  const dirty =
    JSON.stringify(s) !== JSON.stringify(DEFAULTS);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="a11y-fab"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((v) => !v)}
        title="תפריט נגישות"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="4" r="2" fill="currentColor" />
          <path
            d="M12 7.5c-2.4 0-4.6-.5-6-1M12 7.5c2.4 0 4.6-.5 6-1M12 7.5v6m0 0-2.2 6.5M12 13.5l2.2 6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="a11y-fab__label">נגישות</span>
      </button>

      <div
        id="a11y-panel"
        ref={panelRef}
        className={`a11y-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="הגדרות נגישות"
        hidden={!open}
      >
        <div className="a11y-panel__head">
          <span className="a11y-panel__title">הגדרות נגישות</span>
          <button
            type="button"
            className="a11y-panel__close"
            onClick={() => {
              setOpen(false);
              btnRef.current?.focus();
            }}
            aria-label="סגירת תפריט הנגישות"
          >
            ✕
          </button>
        </div>

        <div className="a11y-panel__body">
          <div className="a11y-zoom">
            <span className="a11y-zoom__label">גודל טקסט ותצוגה</span>
            <div className="a11y-stepper">
              <button
                type="button"
                onClick={() => setZoom(s.zoom - 1)}
                disabled={s.zoom <= 0}
                aria-label="הקטנת טקסט"
              >
                A−
              </button>
              <span className="a11y-stepper__val" aria-live="polite">
                {ZOOM_PCT[s.zoom]}%
              </span>
              <button
                type="button"
                onClick={() => setZoom(s.zoom + 1)}
                disabled={s.zoom >= MAX_ZOOM}
                aria-label="הגדלת טקסט"
              >
                A+
              </button>
            </div>
          </div>

          <div className="a11y-grid">
            {TOGGLES.map((t) => {
              const on = s[t.key] as boolean;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`a11y-toggle${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(t.key)}
                >
                  <span className="a11y-toggle__icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="a11y-toggle__label">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="a11y-panel__foot">
          <button
            type="button"
            className="a11y-reset"
            onClick={() => setS(DEFAULTS)}
            disabled={!dirty}
          >
            איפוס הגדרות נגישות
          </button>
          <a className="a11y-statement-link" href="/accessibility">
            להצהרת הנגישות המלאה
          </a>
        </div>
      </div>
    </>
  );
}
