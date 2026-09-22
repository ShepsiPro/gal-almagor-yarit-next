"use client";

import { useEffect, useRef } from "react";

const INK = "#1E4164";
const LINE_WIDTH = 2.2;

/**
 * A signature drawn by hand, finger or mouse.
 *
 * Pointer Events cover touch, pen and mouse with one set of handlers, and
 * `touch-action: none` on the canvas (see the CSS) keeps the page from
 * scrolling under a finger. The drawing is handed up as a PNG data URL once
 * per stroke, which is what the form posts and what a draft restore draws
 * back. The bitmap is sized to the CSS box times the device pixel ratio, so
 * the export is crisp on a phone.
 */
export default function SignaturePad({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  /** PNG data URL, or "" when blank. */
  value: string;
  onChange: (dataUrl: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  // Set once the person has drawn; a restore never overwrites their strokes.
  const dirty = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  function context(): CanvasRenderingContext2D | null {
    const c = canvasRef.current;
    return c ? c.getContext("2d") : null;
  }

  function paint(dataUrl: string) {
    const c = canvasRef.current;
    const ctx = context();
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = dataUrl;
  }

  // Size the bitmap to the box (and again whenever the box changes), then
  // redraw whatever is on record so a rotation does not wipe a signature.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const rect = c.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      paint(latest.current);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value arriving from outside (a draft restored after mount) is drawn;
  // once the person has drawn themselves, only they change the canvas.
  useEffect(() => {
    if (dirty.current) return;
    paint(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = context();
    if (!ctx) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    dirty.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap leaves a dot rather than nothing.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    e.preventDefault();
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const c = canvasRef.current;
    if (c) onChange(c.toDataURL("image/png"));
  }

  function clear() {
    dirty.current = false;
    paint("");
    onChange("");
  }

  return (
    <div className="fform__sig">
      <canvas
        id={id}
        ref={canvasRef}
        className="fform__sig-canvas"
        role="img"
        aria-label={value ? "חתימה, נחתם" : "משטח חתימה, חתמו כאן באצבע או בעכבר"}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <span className="fform__sig-line" aria-hidden="true" />
      <div className="fform__sig-actions">
        <span>{value ? "נחתם. אפשר לנקות ולחתום שוב." : "חתמו בתוך המסגרת, באצבע או בעכבר."}</span>
        <button type="button" className="fform__sig-clear" onClick={clear} disabled={!value}>
          ניקוי
        </button>
      </div>
    </div>
  );
}
