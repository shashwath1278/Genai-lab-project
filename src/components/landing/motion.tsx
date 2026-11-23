"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/**
 * Lenis smooth scrolling for the landing page. GSAP's ticker drives it so
 * ScrollTrigger scrubs move in step with the eased scroll. Anchor links glide
 * (honouring each section's scroll-margin). Touch keeps native scrolling, and
 * visitors who ask for reduced motion get the browser's own scroll.
 *
 * Only the landing page uses this: the chat has its own scroll panes.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
}

/**
 * The landing page's scroll choreography, scoped to its root element:
 * - `.scroll-progress` fills across the page;
 * - `[data-reveal]` headings rise line by line from behind a mask;
 * - `.hero-copy` eases up and back as the hero leaves;
 * - `.drift` illustrations float against the scroll for a little depth;
 * - `.sprig` sprays grow in around the closing call to action.
 */
export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".scroll-progress",
          { scaleX: 0 },
          { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } },
        );

        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            linesClass: "rl",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 1,
                ease: "expo.out",
                stagger: 0.09,
                scrollTrigger: { trigger: el, start: "top 86%", once: true },
              }),
          });
        });

        gsap.to(".hero-copy", {
          y: -48,
          opacity: 0.35,
          ease: "none",
          scrollTrigger: { trigger: ".hero-copy", start: 0, end: "bottom top", scrub: true },
        });

        gsap.utils.toArray<HTMLElement>(".drift").forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: 9 },
            { yPercent: -9, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
          );
        });

        // Played rather than scrubbed: the lower sprig sits too close to the
        // end of the page for a scrub to ever finish.
        gsap.utils.toArray<SVGElement>(".sprig").forEach((el, i) => {
          gsap.from(el, {
            rotation: i % 2 ? 28 : -28,
            scale: 0.6,
            opacity: 0,
            transformOrigin: i % 2 ? "100% 100%" : "0% 100%",
            duration: 1.3,
            delay: i * 0.2,
            ease: "back.out(1.4)",
            scrollTrigger: { trigger: el.closest("section") ?? el, start: "top 75%" },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );
}

/**
 * Pulls its child gently toward the pointer and springs back on leave.
 * Mouse and trackpad only; still for touch and reduced motion.
 */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.5)" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.5)" });
        const move = (e: PointerEvent) => {
          // Measure from the untransformed centre so the pull doesn't feed back on itself.
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2 - Number(gsap.getProperty(el, "x"));
          const cy = r.top + r.height / 2 - Number(gsap.getProperty(el, "y"));
          xTo((e.clientX - cx) * strength);
          yTo((e.clientY - cy) * strength);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [strength] },
  );

  return (
    <span ref={ref} className="inline-block">
      {children}
    </span>
  );
}
