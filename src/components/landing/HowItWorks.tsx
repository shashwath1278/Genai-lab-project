"use client";

import { useGSAP } from "@gsap/react";
import { ChatCircleText, MagnifyingGlass, SealCheck, Tray, type Icon } from "@phosphor-icons/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS: { icon: Icon; title: string; text: string; tint: string }[] = [
  { icon: ChatCircleText, title: "You ask", text: "In any of five languages, typed or spoken.", tint: "var(--accent-soft)" },
  { icon: MagnifyingGlass, title: "It searches twice", text: "By keywords and by meaning, then merges the two.", tint: "var(--marigold-soft)" },
  { icon: SealCheck, title: "It answers with sources", text: "Figures are calculated; every line links to a passage.", tint: "var(--leaf-soft)" },
  { icon: Tray, title: "Gaps reach staff", text: "When the handbook is silent, staff are told to fill it.", tint: "var(--laterite-soft)" },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The hand-drawn connector draws itself as the section scrolls past.
        gsap.fromTo(
          ".connector",
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: root.current, start: "top 75%", end: "bottom 65%", scrub: 0.6 } },
        );
        gsap.from(".step", {
          y: 24,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.14,
          scrollTrigger: { trigger: root.current, start: "top 70%" },
        });
        // Each step's icon lands like a rubber stamp, just behind its text.
        gsap.from(".step-icon", {
          scale: 1.4,
          rotation: -14,
          opacity: 0,
          duration: 0.55,
          ease: "back.out(2.2)",
          stagger: 0.14,
          delay: 0.12,
          scrollTrigger: { trigger: root.current, start: "top 70%" },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <p className="eyebrow">How it works</p>
      <h2 data-reveal className="mt-3 max-w-xl font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[52px]">
        From question to answer, <em className="text-accent-text">in four steps.</em>
      </h2>

      <div className="relative mt-14">
        <svg className="pointer-events-none absolute left-0 top-7 hidden h-6 w-full lg:block" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden>
          <path
            className="connector"
            d="M110 12 C 220 2, 300 22, 380 12 S 560 2, 630 12 S 800 22, 890 12"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step relative">
              <span
                className="step-icon relative z-10 inline-flex size-14 items-center justify-center rounded-2xl border-2 border-ink text-ink"
                style={{ background: s.tint, boxShadow: "4px 4px 0 0 var(--ink)" }}
              >
                <s.icon size={26} weight="duotone" />
              </span>
              <p className="mt-5 font-mono text-[12px] text-muted">0{i + 1}</p>
              <h3 className="mt-1 font-display text-[26px] leading-tight text-ink">{s.title}</h3>
              <p className="mt-1.5 max-w-[16rem] text-[14.5px] text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
