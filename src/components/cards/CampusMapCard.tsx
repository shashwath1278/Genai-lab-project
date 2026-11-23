"use client";

import { ArrowsIn, ArrowsOut, MapTrifold, PersonSimpleWalk } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { BUILDINGS, type Building, type BuildingKind, getBuilding, MAP_SIZE, type MapResult, NODES, type Pt, ROADS } from "@/lib/campus-map";
import { Button, CardFrame, cx } from "../ui";

// The campus drawn in the same riso style as the landing illustration: every
// fill is printed a few units off its ink outline. Colours are theme tokens.

const INK = "var(--ink)";
const TINT: Record<BuildingKind, [fill: string, shadow: string]> = {
  gate: ["var(--laterite)", "var(--laterite)"],
  academic: ["var(--accent-soft)", "var(--jacaranda-light)"],
  office: ["var(--laterite-soft)", "var(--laterite)"],
  hall: ["var(--sky)", "var(--jacaranda-light)"],
  hostel: ["var(--marigold-soft)", "var(--marigold)"],
  amenity: ["var(--leaf-soft)", "var(--leaf)"],
  sports: ["var(--leaf-soft)", "var(--leaf)"],
  transport: ["var(--surface-2)", "var(--line-strong)"],
};

const LABELS: Record<string, string[]> = { annexe: ["Gate", "Annexe"], "student-centre": ["Student", "Centre"], indoor: ["Indoor", "Sports Hall"] };
const AVENUE_TREES: Pt[] = [
  [460, 160], [500, 160], [460, 205], [500, 250], [460, 250], [500, 355], [460, 365], [500, 420], [460, 430],
];

type Box = [x: number, y: number, w: number, h: number];

/** A view framing the route and the places, at a comfortable minimum size. */
function frame(points: Pt[], buildings: Building[]): Box {
  const xs = [...points.map((p) => p[0]), ...buildings.flatMap((b) => [b.x, b.x + b.w])];
  const ys = [...points.map((p) => p[1]), ...buildings.flatMap((b) => [b.y, b.y + b.h])];
  if (!xs.length) return [0, 0, MAP_SIZE.w, MAP_SIZE.h];
  const [x1, y1] = [Math.max(...xs) + 60, Math.max(...ys) + 60];
  let [x0, y0] = [Math.min(...xs) - 60, Math.min(...ys) - 60];
  const ratio = 1.6;
  let w = Math.max(x1 - x0, 520);
  let h = Math.max(y1 - y0, 325);
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  w = Math.min(w, MAP_SIZE.w);
  h = Math.min(h, MAP_SIZE.h);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  x0 = Math.min(Math.max(cx - w / 2, 0), MAP_SIZE.w - w);
  y0 = Math.min(Math.max(cy - h / 2, 0), MAP_SIZE.h - h);
  return [x0, y0, w, h];
}

const pathD = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");

export function CampusMapCard({ result }: { result: MapResult }) {
  const uid = useId();
  const route = result.route;
  const targets = useMemo(() => (result.to?.buildings ?? []).map(getBuilding).filter(Boolean) as Building[], [result.to]);
  const starts = useMemo(() => (result.from && result.to ? result.from.buildings.map(getBuilding).filter(Boolean) as Building[] : []), [result.from, result.to]);
  const focus = useMemo(() => frame(route?.points ?? [], route ? [...targets, ...starts.slice(0, 1)] : targets), [route, targets, starts]);
  const zoomable = focus[2] < MAP_SIZE.w - 1;
  const [whole, setWhole] = useState(false);
  const view = whole || !zoomable ? ([0, 0, MAP_SIZE.w, MAP_SIZE.h] as Box) : focus;
  const isTarget = (b: Building) => targets.some((t) => t.id === b.id);
  const isStart = (b: Building) => starts.some((s) => s.id === b.id) && !isTarget(b);
  const end = route?.points.at(-1);
  const begin = route?.points[0];

  const title = result.to ? result.to.name : "Campus map";
  const label = route ? `Campus map: walking route from ${result.from?.name} to ${result.to?.name}` : result.to ? `Campus map with ${result.to.name} highlighted` : "Campus map of Northgate";

  return (
    <CardFrame
      icon={MapTrifold}
      eyebrow="Campus map"
      title={title}
      actions={
        zoomable && (
          <Button size="sm" variant="ghost" icon={whole ? ArrowsIn : ArrowsOut} onClick={() => setWhole((w) => !w)}>
            {whole ? "Zoom in" : "Whole campus"}
          </Button>
        )
      }
    >
      {result.unknown && (
        <p className="mb-3 text-[13.5px] text-ink-2">
          There&apos;s no &ldquo;{result.unknown}&rdquo; on the campus map. Here&apos;s the whole campus instead.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <svg viewBox={view.join(" ")} className="block h-auto w-full" role="img" aria-label={label} style={{ fontFamily: "var(--font-sans)" }}>
          <defs>
            <pattern id={`${uid}-grass`} width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M3 9 l2 -4 M9 12 l2 -4" stroke="var(--leaf)" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
            </pattern>
          </defs>

          {/* Grounds and the campus wall, with a gap for the gate */}
          <rect x={0} y={0} width={MAP_SIZE.w} height={MAP_SIZE.h} fill="var(--bg)" />
          <rect x={22} y={30} width={MAP_SIZE.w - 40} height={MAP_SIZE.h - 46} rx={22} fill="var(--surface)" />
          <rect x={22} y={30} width={MAP_SIZE.w - 40} height={MAP_SIZE.h - 46} rx={22} fill={`url(#${uid}-grass)`} />
          <path
            d={`M450 30 H44 Q22 30 22 52 V${MAP_SIZE.h - 38} Q22 ${MAP_SIZE.h - 16} 44 ${MAP_SIZE.h - 16} H${MAP_SIZE.w - 40} Q${MAP_SIZE.w - 18} ${MAP_SIZE.h - 16} ${MAP_SIZE.w - 18} ${MAP_SIZE.h - 38} V52 Q${MAP_SIZE.w - 18} 30 ${MAP_SIZE.w - 40} 30 H510`}
            fill="none"
            stroke={INK}
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Walkways: an ink edge under a paper-coloured surface */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {ROADS.map((r) => (
              <path key={`e-${r.name}`} d={pathD(r.nodes.map((n) => NODES[n].at))} stroke={INK} strokeWidth={23} opacity={0.18} />
            ))}
            {BUILDINGS.map((b) => (
              <path key={`de-${b.id}`} d={pathD([NODES[b.via].at, b.door])} stroke={INK} strokeWidth={11} opacity={0.14} />
            ))}
            {ROADS.map((r) => (
              <path key={`s-${r.name}`} d={pathD(r.nodes.map((n) => NODES[n].at))} stroke="var(--surface-2)" strokeWidth={20} />
            ))}
            {BUILDINGS.map((b) => (
              <path key={`d-${b.id}`} d={pathD([NODES[b.via].at, b.door])} stroke="var(--surface-2)" strokeWidth={8} />
            ))}
          </g>
          <g fill="var(--muted)" fontSize={10} letterSpacing={1.6} style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
            <text x={112} y={124}>NORTH ROAD</text>
            <text x={232} y={304}>CENTRAL WALK</text>
            <text x={540} y={474}>SOUTH WALK</text>
            <text x={484} y={150} transform="rotate(90 484 150)">GATE AVENUE</text>
            <text x={904} y={190} transform="rotate(90 904 190)">EAST LANE</text>
          </g>

          {/* Jacaranda Circle and the avenue trees */}
          <circle cx={480} cy={300} r={36} fill="var(--leaf-soft)" stroke={INK} strokeWidth={1.8} />
          {AVENUE_TREES.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x + 2} cy={y + 2.5} r={7} fill="var(--accent)" opacity={0.35} />
              <circle cx={x} cy={y} r={7} fill="var(--jacaranda-light)" />
            </g>
          ))}
          <circle cx={482} cy={303} r={18} fill="var(--accent)" opacity={0.35} />
          <circle cx={480} cy={300} r={18} fill="var(--jacaranda-light)" stroke={INK} strokeWidth={1.2} />
          {[[474, 294], [486, 298], [478, 306], [488, 290]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={2.2} fill="var(--surface)" />
          ))}

          {/* Buildings */}
          {BUILDINGS.map((b) => {
            const target = isTarget(b);
            const start = isStart(b);
            const [fill, shadow] = target ? ["var(--accent)", "var(--ink)"] : TINT[b.kind];
            const lines = LABELS[b.id] ?? [b.label];
            if (b.kind === "gate") {
              return (
                <g key={b.id} aria-hidden>
                  <path d="M452 44 V22 Q480 2 508 22 V44" fill={target ? "var(--accent)" : "var(--laterite)"} stroke={INK} strokeWidth={2} />
                  <path d="M466 44 V28 Q480 18 494 28 V44" fill="var(--surface)" stroke={INK} strokeWidth={1.6} />
                  <text x={480} y={82} textAnchor="middle" fontSize={10} letterSpacing={1.6} fill={target ? "var(--accent-text)" : "var(--muted)"} style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                    MAIN GATE
                  </text>
                </g>
              );
            }
            return (
              <g key={b.id}>
                <title>{b.label}</title>
                {b.oval ? (
                  <>
                    <ellipse cx={b.x + b.w / 2 + 5} cy={b.y + b.h / 2 + 5} rx={b.w / 2} ry={b.h / 2} fill={shadow} opacity={0.45} />
                    <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill="var(--surface)" />
                    <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} stroke={INK} strokeWidth={start ? 3 : 1.8} />
                    <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2 - 18} ry={b.h / 2 - 20} fill="none" stroke={target ? "var(--accent-ink)" : "var(--leaf)"} strokeWidth={1.4} strokeDasharray="5 5" opacity={0.7} />
                    <rect x={b.x + b.w / 2 - 6} y={b.y + b.h / 2 - 28} width={12} height={56} fill="var(--marigold-soft)" stroke={INK} strokeWidth={1} />
                  </>
                ) : (
                  <>
                    <rect x={b.x + 5} y={b.y + 5} width={b.w} height={b.h} rx={6} fill={shadow} opacity={0.45} />
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="var(--surface)" />
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={fill} stroke={start ? "var(--laterite)" : INK} strokeWidth={start ? 3.5 : 1.8} />
                  </>
                )}
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2 - (lines.length - 1) * 8 + (b.oval ? -46 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={b.w < 100 ? 13 : 15}
                  fontWeight={target ? 600 : 500}
                  fill={target ? "var(--accent-ink)" : INK}
                >
                  {lines.map((l, i) => (
                    <tspan key={l} x={b.x + b.w / 2} dy={i ? 16 : 0}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* The route draws itself from the start to the door */}
          {route && (
            <>
              <motion.path
                d={pathD(route.points)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: "easeInOut", delay: 0.2 }}
              />
              <path d={pathD(route.points)} fill="none" stroke="var(--surface)" strokeWidth={1.6} strokeDasharray="2 9" strokeLinecap="round" opacity={0.9} />
            </>
          )}
          {begin && (
            <g aria-hidden>
              <circle cx={begin[0]} cy={begin[1]} r={10} fill="var(--laterite)" stroke={INK} strokeWidth={2} />
              <circle cx={begin[0]} cy={begin[1]} r={3.5} fill="var(--surface)" />
            </g>
          )}
          {(end ?? (targets[0] && [targets[0].x + targets[0].w / 2, targets[0].y + targets[0].h / 2])) && (
            <Pin at={(end ?? [targets[0].x + targets[0].w / 2, targets[0].y + targets[0].h / 2]) as Pt} />
          )}

          {/* North arrow */}
          <g transform={`translate(${view[0] + view[2] - 34} ${view[1] + 34})`} aria-hidden>
            <circle r={17} fill="var(--surface)" stroke={INK} strokeWidth={1.5} />
            <path d="M0 -11 L5 4 L0 1 L-5 4 Z" fill={INK} />
            <text y={14} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK}>
              N
            </text>
          </g>
        </svg>
      </div>

      {result.sameBuilding && result.to && (
        <p className="mt-3 text-[13.5px] text-ink-2">
          You&apos;re already there: {result.to.detail}
        </p>
      )}

      {result.to && !result.sameBuilding && <p className="mt-3 text-[13.5px] text-ink-2">{result.to.detail}</p>}

      {route && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <PersonSimpleWalk size={15} weight="duotone" className="text-accent-text" aria-hidden />
            About {route.distanceM} m · {route.minutes} min walk from {result.from?.name}
          </p>
          <ol className="mt-2 space-y-1.5">
            {route.steps.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
                <span className={cx("mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px]", i === route.steps.length - 1 ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </CardFrame>
  );
}

function Pin({ at: [x, y] }: { at: Pt }) {
  return (
    <g aria-hidden>
      <motion.circle
        cx={x}
        cy={y}
        r={14}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        initial={{ scale: 0.6, opacity: 0.9 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        style={{ transformOrigin: "50% 50%", transformBox: "fill-box" }}
      />
      <path d={`M${x} ${y} c-9 -12 -13 -17 -13 -24 a13 13 0 0 1 26 0 c0 7 -4 12 -13 24 z`} fill="var(--accent)" stroke={INK} strokeWidth={2} />
      <circle cx={x} cy={y - 24} r={4.5} fill="var(--surface)" />
    </g>
  );
}
