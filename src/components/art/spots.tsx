// Small spot illustrations in the same riso style as the gate: ink outlines with
// fills printed slightly off-register. All colours are theme tokens.

const INK = "var(--ink)";
const line = { stroke: INK, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

type Props = { className?: string };

/** Open handbook, one highlighted line, a citation chip tied to it. */
export function SourcesSpot({ className }: Props) {
  const left = "M20 36 C44 30 66 32 80 40 L80 100 C66 92 44 90 20 96 Z";
  const right = "M80 40 C94 32 116 30 140 36 L140 96 C116 90 94 92 80 100 Z";
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <g fill="var(--accent-soft)" transform="translate(4 4)">
        <path d={left} />
        <path d={right} />
      </g>
      <g fill="var(--surface)">
        <path d={left} />
        <path d={right} />
      </g>
      <rect x={88} y={59} width={44} height={9} rx={3} fill="var(--mark)" />
      <g {...line} strokeOpacity={0.4}>
        {[50, 58, 66, 74, 82].map((y, i) => (
          <path key={`l${y}`} d={`M30 ${y + (i % 2)} C44 ${y - 2} 58 ${y - 1} ${70 - (i % 3) * 6} ${y + 1}`} />
        ))}
        {[48, 56, 72, 80].map((y) => (
          <path key={`r${y}`} d={`M90 ${y} C104 ${y - 2} 116 ${y - 2} 130 ${y}`} />
        ))}
      </g>
      <path d="M90 63.5 C104 61.5 116 61.5 130 63.5" {...line} />
      <path d={left} {...line} />
      <path d={right} {...line} />
      <path d="M126 30 C128 42 122 50 116 58" {...line} stroke="var(--accent)" strokeDasharray="3 4" />
      <rect x={113} y={12} width={28} height={18} rx={6} fill="var(--accent)" />
      <text x={127} y={25} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--accent-ink)" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        1
      </text>
    </svg>
  );
}

/** A fee receipt with a double-underlined total, and a calculator. */
export function LedgerSpot({ className }: Props) {
  const receipt = "M30 14 H98 V96 L92 102 L86 96 L80 102 L74 96 L68 102 L62 96 L56 102 L50 96 L44 102 L38 96 L30 102 Z";
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d={receipt} fill="var(--marigold-soft)" transform="translate(4 4)" />
      <path d={receipt} fill="var(--surface)" />
      <text x={38} y={32} fontSize={14} fontWeight={700} fill="var(--laterite)" style={{ fontFamily: "var(--font-instrument), serif" }}>
        ₹
      </text>
      <g {...line} strokeOpacity={0.45}>
        {[42, 54, 66].map((y) => (
          <g key={y}>
            <path d={`M40 ${y} H64`} />
            <path d={`M76 ${y} H90`} />
          </g>
        ))}
      </g>
      <path d="M72 80 H92" {...line} stroke="var(--accent)" strokeWidth={4} />
      <path d="M70 86 H94 M70 90 H94" {...line} />
      <path d={receipt} {...line} />
      <rect x={110} y={48} width={38} height={54} rx={7} fill="var(--leaf)" transform="translate(3 3)" opacity={0.55} />
      <rect x={110} y={48} width={38} height={54} rx={7} fill="var(--leaf-soft)" stroke={INK} strokeWidth={2} />
      <rect x={116} y={54} width={26} height={11} rx={2} fill="var(--surface)" stroke={INK} strokeWidth={1.5} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle
            key={`${r}${c}`}
            cx={120 + c * 9}
            cy={74 + r * 9}
            r={2.6}
            fill={r === 2 && c === 2 ? "var(--accent)" : INK}
            opacity={r === 2 && c === 2 ? 1 : 0.55}
          />
        )),
      )}
    </svg>
  );
}

function bubble(x: number, y: number, w: number, h: number, tail: "left" | "right") {
  const r = 12;
  const tx = tail === "left" ? x + 16 : x + w - 16;
  const tip = tail === "left" ? tx - 8 : tx + 8;
  return [
    `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h}`,
    tail === "right" ? `H${tx + 4} L${tip} ${y + h + 10} L${tx - 6} ${y + h}` : "",
    tail === "left" ? `H${tx + 6} L${tip} ${y + h + 10} L${tx - 4} ${y + h}` : "",
    `H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`,
  ].join(" ");
}

/** Three overlapping speech bubbles: Devanagari, Kannada and Latin. */
export function TonguesSpot({ className }: Props) {
  const items = [
    { d: bubble(14, 16, 66, 44, "left"), fill: "var(--accent-soft)", shade: "var(--accent)", glyph: "अ", color: "var(--accent-text)", gx: 47, gy: 47, size: 26 },
    { d: bubble(80, 26, 64, 44, "right"), fill: "var(--laterite-soft)", shade: "var(--laterite)", glyph: "ಕ", color: "var(--laterite)", gx: 112, gy: 57, size: 26 },
    { d: bubble(44, 66, 64, 36, "left"), fill: "var(--leaf-soft)", shade: "var(--leaf)", glyph: "Aa", color: "var(--leaf)", gx: 76, gy: 92, size: 22 },
  ];
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      {items.map((b) => (
        <g key={b.glyph}>
          <path d={b.d} fill={b.shade} opacity={0.4} transform="translate(4 4)" />
          <path d={b.d} fill={b.fill} />
          <path d={b.d} {...line} />
          <text
            x={b.gx}
            y={b.gy}
            textAnchor="middle"
            fontSize={b.size}
            fill={b.color}
            style={{ fontFamily: b.glyph === "Aa" ? "var(--font-instrument), serif" : "'Nirmala UI', 'Noto Sans', sans-serif" }}
          >
            {b.glyph}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A bookshelf with one missing book; a note flies off to staff. */
export function GapSpot({ className }: Props) {
  const books = [
    { x: 20, w: 14, h: 50, fill: "var(--accent)" },
    { x: 36, w: 12, h: 40, fill: "var(--marigold)" },
    { x: 50, w: 16, h: 56, fill: "var(--leaf)" },
    { x: 90, w: 14, h: 44, fill: "var(--laterite)" },
    { x: 106, w: 12, h: 54, fill: "var(--jacaranda-light)" },
    { x: 120, w: 18, h: 36, fill: "var(--marigold-soft)" },
  ];
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      {books.map((b) => (
        <g key={b.x}>
          <rect x={b.x + 3} y={96 - b.h + 3} width={b.w} height={b.h} fill={b.fill} opacity={0.35} />
          <rect x={b.x} y={96 - b.h} width={b.w} height={b.h} fill={b.fill} stroke={INK} strokeWidth={2} />
          <path d={`M${b.x + 3} ${96 - b.h + 8} H${b.x + b.w - 3}`} {...line} strokeWidth={1.5} strokeOpacity={0.5} />
        </g>
      ))}
      <rect x={70} y={48} width={17} height={48} rx={2} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" />
      <text x={78.5} y={78} textAnchor="middle" fontSize={20} fill="var(--accent-text)" style={{ fontFamily: "var(--font-instrument), serif" }}>
        ?
      </text>
      <rect x={14} y={96} width={132} height={7} fill="var(--laterite)" stroke={INK} strokeWidth={2} />
      <path d="M86 46 C96 28 112 22 124 22" {...line} stroke="var(--accent)" strokeDasharray="3 4" />
      <g transform="rotate(-12 134 20)">
        <rect x={122} y={10} width={26} height={20} rx={2} fill="var(--surface)" stroke={INK} strokeWidth={2} />
        <path d="M127 17 H143 M127 23 H138" {...line} strokeWidth={1.5} strokeOpacity={0.6} />
      </g>
    </svg>
  );
}

/** A jacaranda sprig, used to dress empty states. */
export function SprigSpot({ className }: Props) {
  const flowers: [number, number][] = [
    [96, 30], [108, 24], [118, 34], [104, 42], [86, 40], [122, 22], [114, 46], [94, 52], [130, 36],
  ];
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d="M18 104 C46 92 70 74 92 46 C100 36 112 28 126 24" {...line} strokeWidth={2.5} />
      <path d="M52 86 C46 72 48 60 58 52 M70 70 C80 60 92 58 100 62" {...line} />
      {[
        "M58 52 C52 44 54 36 62 32 C66 40 64 48 58 52 Z",
        "M100 62 C108 58 116 60 120 66 C112 70 104 68 100 62 Z",
        "M40 94 C34 88 34 80 40 76 C46 82 46 90 40 94 Z",
      ].map((d) => (
        <g key={d}>
          <path d={d} fill="var(--leaf)" opacity={0.5} transform="translate(3 3)" />
          <path d={d} fill="var(--leaf-soft)" />
          <path d={d} {...line} />
        </g>
      ))}
      {flowers.map(([x, y], i) => (
        <g key={`${x}${y}`}>
          <circle cx={x + 2} cy={y + 3} r={7} fill="var(--accent)" opacity={0.4} />
          <circle cx={x} cy={y} r={7} fill={i % 2 ? "var(--jacaranda-light)" : "var(--accent-soft)"} stroke={INK} strokeWidth={1.5} />
          <circle cx={x} cy={y} r={1.8} fill="var(--marigold)" />
        </g>
      ))}
    </svg>
  );
}

/** A pinned calendar leaf. */
export function PlanSpot({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <rect x={46} y={22} width={70} height={80} rx={8} fill="var(--accent)" opacity={0.35} transform="translate(5 5)" />
      <rect x={46} y={22} width={70} height={80} rx={8} fill="var(--surface)" stroke={INK} strokeWidth={2} />
      <path d="M46 46 H116" {...line} />
      <rect x={46} y={22} width={70} height={24} rx={8} fill="var(--laterite)" opacity={0.85} />
      <rect x={46} y={22} width={70} height={80} rx={8} {...line} />
      <text x={81} y={84} textAnchor="middle" fontSize={34} fill={INK} style={{ fontFamily: "var(--font-instrument), serif" }}>
        14
      </text>
      <path d="M62 16 V30 M100 16 V30" {...line} strokeWidth={3} />
      <circle cx={124} cy={30} r={9} fill="var(--marigold)" stroke={INK} strokeWidth={2} />
      <path d="M124 39 L118 56" {...line} />
    </svg>
  );
}

/** A photographed receipt in a viewfinder, one line flagged, one ticked. */
export function ScanSpot({ className }: Props) {
  const paper = "M46 16 H112 V98 L106 104 L100 98 L94 104 L88 98 L82 104 L76 98 L70 104 L64 98 L58 104 L52 98 L46 104 Z";
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <path d={paper} fill="var(--laterite-soft)" transform="translate(4 4)" />
      <path d={paper} fill="var(--surface)" />
      <g {...line} strokeOpacity={0.45}>
        {[34, 48, 62].map((y) => (
          <g key={y}>
            <path d={`M54 ${y} H78`} />
            <path d={`M88 ${y} H104`} />
          </g>
        ))}
      </g>
      <rect x={51} y={43} width={57} height={10} rx={3} fill="var(--laterite)" opacity={0.25} />
      <path d="M54 80 H104" {...line} />
      <path d="M54 84 H104" {...line} strokeOpacity={0.5} />
      <path d={paper} {...line} />
      {/* viewfinder corners */}
      <g {...line} stroke="var(--accent)" strokeWidth={3}>
        <path d="M32 24 V10 H46" />
        <path d="M114 10 H128 V24" />
        <path d="M128 96 V110 H114" />
        <path d="M46 110 H32 V96" />
      </g>
      <circle cx={126} cy={48} r={11} fill="var(--laterite)" stroke={INK} strokeWidth={2} />
      <path d="M126 42 V49 M126 53 V54" {...line} stroke="var(--surface)" strokeWidth={2.5} />
      <circle cx={126} cy={74} r={11} fill="var(--leaf)" stroke={INK} strokeWidth={2} />
      <path d="M121 74 L125 78 L132 70" {...line} stroke="var(--surface)" strokeWidth={2.5} />
    </svg>
  );
}

/** A folded campus map with a walked route and a pin. */
export function MapSpot({ className }: Props) {
  const panels = ["M22 26 L58 16 L58 96 L22 106 Z", "M58 16 L100 28 L100 108 L58 96 Z", "M100 28 L138 18 L138 98 L100 108 Z"];
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      {panels.map((d) => (
        <path key={`s${d}`} d={d} fill="var(--leaf-soft)" transform="translate(4 4)" />
      ))}
      {panels.map((d, i) => (
        <path key={`f${d}`} d={d} fill={i === 1 ? "var(--surface-2)" : "var(--surface)"} />
      ))}
      <rect x={30} y={40} width={18} height={14} rx={2} fill="var(--accent-soft)" stroke={INK} strokeWidth={1.5} />
      <rect x={108} y={44} width={20} height={16} rx={2} fill="var(--marigold-soft)" stroke={INK} strokeWidth={1.5} />
      <circle cx={78} cy={66} r={8} fill="var(--jacaranda-light)" stroke={INK} strokeWidth={1.5} />
      <path d="M39 86 C50 80 60 76 70 70 M86 62 C96 56 104 54 116 70" {...line} stroke="var(--accent)" strokeWidth={3} strokeDasharray="1 7" />
      {panels.map((d) => (
        <path key={`l${d}`} d={d} {...line} />
      ))}
      <circle cx={39} cy={88} r={5} fill="var(--laterite)" stroke={INK} strokeWidth={1.5} />
      <path d="M118 74 c-7 -9 -10 -13 -10 -18 a10 10 0 0 1 20 0 c0 5 -3 9 -10 18 z" fill="var(--accent)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={118} cy={56} r={3.5} fill="var(--surface)" />
    </svg>
  );
}
