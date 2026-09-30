// Fine-line drawings of the six insurance lines, and the "coverage roof": the
// roof of the agency's shield, drawn as three engraved lines over a sky wash,
// that settles over whatever is being insured. 320 x 200, ground at y = 172.
// Pure SVG, no state, safe in server and client components alike.

export type LineKind = "car" | "home" | "business" | "life" | "retirement" | "finance";

const ground = <path className="art__ground" d="M18 172H302" />;

function coinStack(cx: number, coins: number) {
  const h = 8;
  const top = 168 - coins * h;
  const lines = [];
  for (let i = 1; i <= coins; i++) {
    const y = top + i * h;
    lines.push(`M${cx - 22} ${y}A22 5 0 0 0 ${cx + 22} ${y}`);
  }
  return (
    <g className="art__ink">
      <ellipse cx={cx} cy={top} rx="22" ry="5" />
      <path d={`M${cx - 22} ${top}V${168}M${cx + 22} ${top}V${168}`} />
      <path className="art__thin" d={lines.join("")} />
    </g>
  );
}

const DRAWINGS: Record<LineKind, JSX.Element> = {
  car: (
    <>
      {ground}
      <path className="art__ink" d="M62 154v-15c0-6 4-10 10-11l38-5 22-24c5-5 11-8 18-8h44c8 0 14 3 19 9l19 22 21 3c7 1 11 6 11 12v17" />
      <path className="art__ink" d="M62 154h19m42 0h79m42 0h20" />
      <path className="art__ink" d="M81 154a21 21 0 0 1 42 0M202 154a21 21 0 0 1 42 0" />
      <circle className="art__ink" cx="102" cy="156" r="15" />
      <circle className="art__thin" cx="102" cy="156" r="5" />
      <circle className="art__ink" cx="223" cy="156" r="15" />
      <circle className="art__thin" cx="223" cy="156" r="5" />
      <path className="art__thin" d="M126 122l18-19c4-4 8-6 13-6h17v25zM182 97h19c5 0 9 2 12 6l14 19h-45z" />
      <path className="art__thin" d="M178 125v26M150 131h9" />
      <path className="art__gold" d="M64 134h9" />
    </>
  ),
  home: (
    <>
      {ground}
      <path className="art__ink" d="M98 172v-72M222 172v-72" />
      <path className="art__ink" d="M84 110l76-58 76 58" />
      <path className="art__ink" d="M198 81v-19h13v29" />
      <rect className="art__ink" x="146" y="126" width="28" height="46" rx="1" />
      <circle className="art__dot" cx="168" cy="151" r="1.8" />
      <rect className="art__glow" x="112.5" y="118.5" width="21" height="21" />
      <rect className="art__thin" x="112" y="118" width="22" height="22" />
      <path className="art__thin" d="M123 118v22M112 129h22" />
      <rect className="art__thin" x="186" y="118" width="22" height="22" />
      <path className="art__thin" d="M197 118v22M186 129h22" />
      <path className="art__thin" d="M262 172v-22" />
      <path className="art__ink" d="M262 150c-14 0-20-10-20-18 0-10 9-17 20-17s20 7 20 17c0 8-6 18-20 18z" />
    </>
  ),
  business: (
    <>
      {ground}
      <path className="art__ink" d="M84 172V76h152v96" />
      <rect className="art__ink" x="84" y="76" width="152" height="20" />
      <path className="art__gold" d="M104 86h36M150 86h14" />
      <path
        className="art__ink"
        d="M84 96v10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10c0 6 5 10 10.9 10s10.8-4 10.8-10V96"
      />
      <rect className="art__thin" x="98" y="128" width="66" height="44" />
      <path className="art__thin" d="M131 128v44M106 164h50" />
      <rect className="art__ink" x="180" y="128" width="40" height="44" />
      <circle className="art__dot" cx="186" cy="151" r="1.8" />
    </>
  ),
  life: (
    <>
      {ground}
      <circle className="art__ink" cx="118" cy="84" r="12" />
      <path className="art__ink" d="M98 172v-44c0-13 9-22 20-22s20 9 20 22v44" />
      <circle className="art__ink" cx="202" cy="84" r="12" />
      <path className="art__ink" d="M182 172v-44c0-13 9-22 20-22s20 9 20 22v44" />
      <circle className="art__ink" cx="160" cy="118" r="9" />
      <path className="art__ink" d="M146 172v-26c0-9 6-15 14-15s14 6 14 15v26" />
      <path className="art__thin" d="M138 146h8M174 146h8" />
      <path className="art__gold" d="M160 66c-3-5-11-4-11 2 0 5 7 9 11 13 4-4 11-8 11-13 0-6-8-7-11-2z" />
    </>
  ),
  retirement: (
    <>
      {ground}
      <path className="art__thin" d="M112 128C150 118 190 118 228 124S280 130 302 126" />
      <path className="art__ink" d="M18 172C58 150 104 142 150 152S236 162 302 146" />
      <path className="art__gold" d="M196 122a24 24 0 0 1 48 0" />
      <path className="art__gold" d="M220 88v-8M246 98l6-5M194 98l-6-5" />
      <path className="art__thin" d="M84 157v-25" />
      <path className="art__ink" d="M84 132c-15 0-22-10-22-20 0-11 10-20 22-20s22 9 22 20c0 10-7 20-22 20z" />
      <path className="art__ink" d="M106 142h36M110 142v9M138 142v9" />
      <path className="art__thin" d="M108 134h32" />
    </>
  ),
  finance: (
    <>
      {ground}
      {coinStack(112, 2)}
      {coinStack(160, 4)}
      {coinStack(208, 7)}
      <path className="art__gold" d="M208 107V78" />
      <path className="art__gold" d="M208 92c-10 0-17-6-18-15 10 0 17 6 18 15zM208 86c10 0 17-6 18-15-10 0-17 6-18 15zM208 78c-5-6-5-13 0-19 5 6 5 13 0 19z" />
    </>
  ),
};

/** The coverage layer. Its lines carry pathLength so CSS can draw them in. */
function Cover() {
  return (
    <g className="cover">
      <path className="cover__wash" d="M30 172V94L160 30l130 64v78z" />
      <path className="cover__line cover__line--gold" d="M30 172V94L160 30l130 64v78" pathLength={1000} />
      <path className="cover__line" d="M38 172V98.5L160 38.5 282 98.5V172" pathLength={1000} />
      <path className="cover__line cover__line--fine" d="M46 172V103L160 47l114 56v69" />
    </g>
  );
}

export default function LineArt({
  kind,
  cover = true,
  className = "",
}: {
  kind: LineKind;
  cover?: boolean;
  className?: string;
}) {
  return (
    <svg className={`art ${className}`} viewBox="0 0 320 200" aria-hidden="true" focusable="false">
      {cover && <Cover />}
      {DRAWINGS[kind]}
    </svg>
  );
}

export function isLineKind(v: string): v is LineKind {
  return v in DRAWINGS;
}
