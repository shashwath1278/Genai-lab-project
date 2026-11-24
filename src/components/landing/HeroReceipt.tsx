"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

// "Get the receipts", literally: a small printed slip for a real answer (B.E.
// CSE via KCET, triple room with mess; figures from the college data), drawn in
// the gate's riso style: ink outline, off-register print, torn bottom edge.

const W = 168;
const H = 196;
const TEETH = 9;

function paperPath(): string {
  const step = (W - 8) / TEETH;
  let d = `M4 4 H${W - 4} V${H - 11}`;
  for (let i = 0; i < TEETH; i++) {
    const x = W - 4 - step * i;
    d += ` L${(x - step / 2).toFixed(1)} ${H - 3} L${(x - step).toFixed(1)} ${H - 11}`;
  }
  return `${d} Z`;
}
const PAPER = paperPath();

const LINES: [string, string][] = [
  ["Year 1", "1.41"],
  ["Years 2-4", "3.78"],
];

export function HeroReceipt({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ delay: 0.9, defaults: { ease: "power3.out" } })
          // Feeds out like a printer, top first.
          .from(".rcpt", { clipPath: "inset(0% 0% 100% 0%)", y: -12, duration: 1, ease: "power2.inOut" })
          .from(".rcpt-line", { opacity: 0, x: -5, duration: 0.25, stagger: 0.1 }, "-=0.45")
          .from(".rcpt-total", { opacity: 0, y: 5, duration: 0.35 })
          .from(".rcpt-stamp", { opacity: 0, scale: 1.9, rotation: 30, duration: 0.4, ease: "back.out(1.6)" })
          .to(".rcpt-wrap", { rotation: 3, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className} aria-hidden>
      <div className="rcpt-wrap relative origin-top rotate-6" style={{ width: W, height: H }}>
        <div className="rcpt absolute inset-0">
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible">
            <path d={PAPER} fill="var(--marigold)" transform="translate(5 5)" opacity={0.85} />
            <path d={PAPER} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
          </svg>

          <div className="relative flex h-full flex-col px-3.5 pb-5 pt-3 font-mono text-[9.5px] text-ink">
            <p className="text-[7.5px] tracking-[0.16em] text-muted">NORTHGATE · RECEIPT</p>
            <p className="mt-1.5 font-display text-[14px] italic leading-tight">&ldquo;CSE, 4 years via KCET?&rdquo;</p>
            <ul className="mt-2 space-y-1 border-t border-dashed border-ink/40 pt-2">
              {LINES.map(([label, lakh]) => (
                <li key={label} className="rcpt-line flex items-baseline gap-1">
                  <span>{label}</span>
                  <span className="mb-[2px] flex-1 border-b border-dotted border-ink/45" />
                  <span className="tabular-nums">{lakh} L</span>
                </li>
              ))}
            </ul>
            <div className="rcpt-total mt-2 flex items-baseline justify-between border-t-[1.5px] border-double border-ink pt-1.5">
              <span className="text-[8.5px] tracking-[0.12em]">TOTAL</span>
              <span className="font-display text-[21px] leading-none">Rs 5.19 L</span>
            </div>
            <p className="mt-auto flex items-center gap-1 text-[7.5px] tracking-[0.12em] text-muted">
              SOURCES
              {[1, 2].map((n) => (
                <span key={n} className="inline-flex size-3.5 items-center justify-center rounded-[4px] bg-accent text-[8px] font-semibold text-accent-ink">
                  {n}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Rubber stamp, off to the side so it never covers a figure */}
        <svg viewBox="0 0 96 96" className="rcpt-stamp absolute -bottom-3 -right-6 size-14 -rotate-12">
          <circle cx={48} cy={48} r={42} fill="var(--surface)" fillOpacity={0.6} stroke="var(--laterite)" strokeWidth={3.5} />
          <circle cx={48} cy={48} r={34} fill="none" stroke="var(--laterite)" strokeWidth={1.5} strokeDasharray="3 3" />
          <path d="M31 50 L43 62 L66 38" fill="none" stroke="var(--laterite)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
