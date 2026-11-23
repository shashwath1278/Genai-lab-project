"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Hand-drawn Northgate gate under a jacaranda, in "riso" style: every fill is
// printed a few pixels off its ink outline. Colours come from the theme tokens,
// so the scene redraws itself for dark mode (a chalk-on-night version).

const INK = "var(--ink)";

const GATE =
  "M112 352 L112 196 C112 136 162 100 220 100 C278 100 328 136 328 196 L328 352 L278 352 L278 214 C278 178 252 150 220 150 C188 150 162 178 162 214 L162 352 Z";

const CANOPY: [number, number, number][] = [
  [388, 214, 34],
  [420, 194, 40],
  [458, 212, 34],
  [404, 240, 28],
  [446, 242, 30],
  [430, 166, 28],
  [472, 184, 24],
  [372, 238, 22],
  [478, 236, 20],
];

// Deterministic blossom positions so server and client render identically.
const BLOSSOMS: [number, number][] = [
  [380, 200], [396, 222], [410, 186], [428, 204], [444, 180], [462, 200], [452, 226], [470, 214],
  [418, 236], [434, 252], [398, 248], [386, 232], [430, 160], [474, 176], [482, 230], [460, 246],
  [414, 210], [442, 214], [372, 228], [424, 178],
];

const PETALS: [number, number][] = [
  [368, 250], [392, 262], [414, 258], [440, 266], [462, 256], [480, 248], [404, 238], [452, 240],
  [380, 244], [430, 248], [470, 262], [396, 270],
];

const GROUND_PETALS: [number, number, number][] = [
  [352, 368, 20], [376, 376, -30], [404, 364, 60], [436, 380, 10], [466, 370, -50], [492, 384, 35], [420, 392, -15],
];

function Bricks({ x }: { x: number }) {
  const rows = [232, 262, 292, 322];
  return (
    <g stroke={INK} strokeOpacity={0.35} strokeWidth={1.5} strokeLinecap="round">
      {rows.map((y, i) => (
        <g key={y}>
          <path d={`M${x + 6} ${y} H${x + 44}`} />
          <path d={`M${x + (i % 2 ? 18 : 30)} ${y - 30} V${y}`} />
        </g>
      ))}
    </g>
  );
}

export function GateScene({ className, animated = true }: { className?: string; animated?: boolean }) {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (!animated) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Petals drift down from the canopy on staggered loops.
        gsap.utils.toArray<SVGElement>(".petal").forEach((petal, i) => {
          const fall = gsap.utils.random(5.5, 9);
          gsap
            .timeline({ repeat: -1, delay: i * 0.7, repeatDelay: gsap.utils.random(0.5, 2.5) })
            .fromTo(
              petal,
              { x: 0, y: 0, rotation: gsap.utils.random(0, 180), opacity: 0, transformOrigin: "50% 50%" },
              {
                x: gsap.utils.random(-70, 10),
                y: gsap.utils.random(95, 125),
                rotation: `+=${gsap.utils.random(160, 340)}`,
                duration: fall,
                ease: "sine.inOut",
              },
            )
            .to(petal, { opacity: 1, duration: 0.8 }, 0)
            .to(petal, { opacity: 0, duration: 1 }, fall - 1);
        });
        // The canopy breathes about the top of the trunk; the lamp glows.
        gsap.to(".canopy", { rotation: 1.6, svgOrigin: "420 262", duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(".lamp-glow", { opacity: 0.35, scale: 1.15, transformOrigin: "50% 50%", duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(".bird", { y: -4, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.4 });

        // Arrival: the sky settles in and the jacaranda blooms open.
        gsap.from(".sky-in", { y: 18, opacity: 0, duration: 1.4, ease: "power3.out", stagger: 0.18, delay: 0.35 });
        gsap.from(".bloom", { scale: 0.84, opacity: 0, svgOrigin: "420 262", duration: 1.2, ease: "back.out(1.6)", delay: 0.55 });

        // Depth on scroll: the far layers lag behind, so the sun sinks behind the tree.
        const depth = { trigger: root.current, start: 0, end: "bottom top", scrub: true } as const;
        gsap.to(".sky", { y: 46, ease: "none", scrollTrigger: depth });
        gsap.to(".hill", { y: 12, ease: "none", scrollTrigger: depth });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [animated] },
  );

  return (
    <svg ref={root} viewBox="0 0 520 440" className={className} role="img" aria-label="The Northgate campus gate under a flowering jacaranda tree">
      {/* Sky: sun (a moon in dark mode), a cloud, birds */}
      <g className="sky">
        <g className="sky-in">
          <circle cx={386} cy={92} r={54} fill="var(--marigold-soft)" />
          <circle cx={386} cy={92} r={54} fill="none" stroke="var(--marigold)" strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round" />
        </g>
        <g className="sky-in">
          <path d="M84 96 C84 84 98 78 108 84 C112 72 132 70 138 84 C150 82 158 92 152 100 Z" fill="var(--surface)" transform="translate(4 4)" opacity={0.9} />
          <path d="M84 96 C84 84 98 78 108 84 C112 72 132 70 138 84 C150 82 158 92 152 100 Z" fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        </g>
        <g className="sky-in" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
          <path className="bird" d="M262 64 q8 -8 16 0 q8 -8 16 0" />
          <path className="bird" d="M300 92 q6 -6 12 0 q6 -6 12 0" />
        </g>
      </g>

      {/* Far hill */}
      <path className="hill" d="M0 318 C70 292 150 306 214 300 C300 292 380 278 520 306 L520 360 L0 360 Z" fill="var(--leaf-soft)" />

      {/* Campus building seen through the gate */}
      <g>
        <rect x={172} y={252} width={96} height={100} fill="var(--sky)" stroke={INK} strokeWidth={1.5} />
        <path d="M166 254 L220 222 L274 254 Z" fill="var(--surface-3)" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        {[188, 212, 236].map((x) => (
          <rect key={x} x={x} y={270} width={14} height={20} rx={7} fill="var(--marigold-soft)" stroke={INK} strokeWidth={1.2} />
        ))}
        {[188, 236].map((x) => (
          <rect key={x} x={x} y={304} width={14} height={18} fill="var(--surface)" stroke={INK} strokeWidth={1.2} />
        ))}
        <rect x={210} y={306} width={20} height={46} fill="var(--accent-soft)" stroke={INK} strokeWidth={1.2} />
      </g>

      {/* Jacaranda: trunk, then canopy as printed blobs with blossoms */}
      <path d="M424 352 C426 318 420 292 408 262 L418 258 C432 290 438 318 440 352 Z" fill="var(--ink-2)" />
      <g fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round">
        <path d="M426 300 C440 286 452 270 456 250" />
        <path d="M418 276 C402 266 392 254 386 236" />
      </g>
      <g className="bloom">
      <g className="canopy">
        <g fill="var(--accent)" opacity={0.45} transform="translate(5 6)">
          {CANOPY.map(([cx, cy, r]) => (
            <circle key={`s${cx}${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        <g fill="var(--jacaranda-light)">
          {CANOPY.map(([cx, cy, r]) => (
            <circle key={`f${cx}${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        <g>
          {BLOSSOMS.map(([x, y], i) => (
            <circle key={`b${x}${y}`} cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 3} fill={i % 3 === 0 ? "var(--surface)" : "var(--accent)"} />
          ))}
        </g>
        <path d="M362 222 C370 182 404 150 440 146 C478 144 500 176 498 212" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      </g>
      </g>

      {/* The gate: laterite arch with brick courses, keystone and nameplate */}
      <path d={GATE} fill="var(--laterite)" transform="translate(6 5)" opacity={0.9} />
      <path d={GATE} fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <Bricks x={112} />
      <Bricks x={278} />
      <path d="M210 98 L230 98 L227 116 L213 116 Z" fill="var(--marigold)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <rect x={172} y={121} width={96} height={22} rx={3} fill="var(--surface)" stroke={INK} strokeWidth={2} />
      <text
        x={220}
        y={136}
        textAnchor="middle"
        fontSize={10.5}
        letterSpacing={2.4}
        fill={INK}
        style={{ fontFamily: "var(--font-geist-mono), monospace", fontWeight: 600 }}
      >
        NORTHGATE
      </text>
      <rect x={104} y={336} width={64} height={16} fill="var(--surface-3)" stroke={INK} strokeWidth={2} />
      <rect x={272} y={336} width={64} height={16} fill="var(--surface-3)" stroke={INK} strokeWidth={2} />

      {/* Lamp post */}
      <g>
        <circle className="lamp-glow" cx={64} cy={236} r={22} fill="var(--marigold)" opacity={0.2} />
        <path d="M64 352 V250" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M54 228 H74 L70 248 H58 Z" fill="var(--marigold)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d="M50 228 H78" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </g>

      {/* Ground and the path through the gate */}
      <path d="M0 352 C90 347 180 355 260 351 C340 347 430 349 520 354 L520 440 L0 440 Z" fill="var(--surface-2)" />
      <path d="M0 352 C90 347 180 355 260 351 C340 347 430 349 520 354" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M174 352 L266 352 L320 440 L120 440 Z" fill="var(--marigold-soft)" />
      <path d="M174 352 L120 440 M266 352 L320 440" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M220 362 V436" stroke={INK} strokeWidth={2} strokeDasharray="6 9" strokeLinecap="round" opacity={0.45} />

      {/* Shrubs */}
      <path d="M66 352 C66 324 104 322 108 352 Z" fill="var(--leaf)" transform="translate(4 -2)" />
      <path d="M66 352 C66 324 104 322 108 352" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M336 352 C338 330 368 328 372 352 Z" fill="var(--leaf)" transform="translate(4 -2)" />
      <path d="M336 352 C338 330 368 328 372 352" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />

      {/* Petals on the ground, and falling ones */}
      {GROUND_PETALS.map(([x, y, r]) => (
        <ellipse key={`g${x}`} cx={x} cy={y} rx={4.5} ry={2.6} fill="var(--jacaranda-light)" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {PETALS.map(([x, y]) => (
        <ellipse key={`p${x}${y}`} className="petal" cx={x} cy={y} rx={4.5} ry={2.6} fill="var(--accent)" opacity={animated ? 0 : 0.8} />
      ))}
    </svg>
  );
}
