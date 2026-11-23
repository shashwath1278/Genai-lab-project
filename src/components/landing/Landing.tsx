"use client";

import { ArrowRight, ArrowUpRight, Backpack, HouseLine, PaperPlaneTilt, type Icon } from "@phosphor-icons/react";
import { motion, MotionConfig, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { BrandMark, Wordmark } from "../art/Brand";
import { GateScene } from "../art/GateScene";
import { GapSpot, LedgerSpot, MapSpot, ScanSpot, SourcesSpot, SprigSpot, TonguesSpot } from "../art/spots";
import CountUp from "../reactbits/CountUp";
import SplitText from "../reactbits/SplitText";
import { cx } from "../ui";
import { ThemeToggle } from "../ThemeToggle";
import { HeroReceipt } from "./HeroReceipt";
import { HowItWorks } from "./HowItWorks";
import { Magnetic, useLandingMotion, useSmoothScroll } from "./motion";

const primaryBtn =
  "inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-medium text-accent-ink shadow-[3px_3px_0_0_var(--ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--ink)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--ink)]";
const ghostBtn =
  "inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface";

const chatLink = (persona: string, q: string) => `/chat?persona=${persona}&q=${encodeURIComponent(q)}`;

const FEATURES = [
  { art: SourcesSpot, title: "Every line has a source", text: "Tap a citation to read the exact passage it came from." },
  { art: LedgerSpot, title: "Numbers are calculated", text: "Fees, cutoffs and totals come from the college's own tables." },
  { art: TonguesSpot, title: "Ask in your language", text: "English, हिन्दी, ಕನ್ನಡ, தமிழ், తెలుగు. Type it or say it." },
  { art: GapSpot, title: "Honest when it doesn't know", text: "Unanswered questions go to staff, who fill the gap." },
  { art: ScanSpot, title: "Snap it, check it", text: "Photograph a fee receipt and every line is checked against the official fees." },
  { art: MapSpot, title: "Find your way", text: "Ask where any office is and get a map with the walking route." },
];

const PEOPLE: { icon: Icon; who: string; persona: string; q: string; tint: string }[] = [
  { icon: PaperPlaneTilt, who: "Applicants", persona: "prospective", q: "Can I get AI & ML with KCET rank 12,000?", tint: "var(--accent-soft)" },
  { icon: Backpack, who: "Students", persona: "current", q: "Last date to pay the exam fee?", tint: "var(--marigold-soft)" },
  { icon: HouseLine, who: "Parents", persona: "parent", q: "How safe is the girls' hostel?", tint: "var(--leaf-soft)" },
];

const STATS = [
  { to: 22, suffix: "", label: "handbook documents" },
  { to: 137, suffix: "", label: "passages indexed" },
  { to: 5, suffix: "", label: "languages" },
  { to: 100, suffix: "%", label: "top-5 retrieval on 42 test questions" },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  return (
    <header className={cx("sticky top-0 z-30 transition-colors duration-300", scrolled ? "border-b border-line bg-bg/85 backdrop-blur" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Wordmark />
        <nav className="ml-auto hidden items-center gap-7 text-[14.5px] text-ink-2 md:flex">
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#who" className="hover:text-ink">
            Who it&apos;s for
          </a>
          <Link href="/admin" className="hover:text-ink">
            For staff
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <ThemeToggle />
          <Link href="/chat" className={cx(primaryBtn, "h-10 px-4 text-[14px]")}>
            Open Copilot
          </Link>
        </div>
      </div>
      {/* Reading progress: GSAP scrubs scaleX; stays empty for reduced motion. */}
      <div aria-hidden className="scroll-progress pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-accent" style={{ transform: "scaleX(0)" }} />
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
      <div className="hero-copy">
        <p className="eyebrow flex items-center gap-2">
          <span className="inline-block size-1.5 rounded-full bg-laterite" />
          Northgate Institute of Technology · Bengaluru
        </p>
        <h1 className="mt-5 font-display text-[56px] leading-[0.95] tracking-tight text-ink sm:text-[80px] lg:text-[92px]">
          <SplitText text="Ask the college." tag="span" textAlign="left" trigger="load" splitType="words" delay={90} duration={0.9} className="block" />
          <SplitText
            text="Get the receipts."
            tag="span"
            textAlign="left"
            trigger="load"
            splitType="words"
            delay={90}
            duration={0.9}
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0, delay: 0.35 }}
            className="block italic text-accent-text"
          />
        </h1>
        <motion.p
          className="mt-7 max-w-md text-[17px] leading-relaxed text-ink-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          Admissions, fees, hostel and exams, answered from the official handbook, with a source for every line.
        </motion.p>
        <motion.div className="mt-9 flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }}>
          <Magnetic>
            <Link href="/chat" className={primaryBtn}>
              Ask a question <ArrowRight size={17} weight="bold" />
            </Link>
          </Magnetic>
          <a href="#how" className={ghostBtn}>
            How it works
          </a>
        </motion.div>
      </div>

      <div className="relative mx-auto mb-16 w-full max-w-140">
        <GateScene className="w-full" />
        {/* Hangs off the bottom-right corner, below the tree's roots, so the scene stays clear. */}
        <HeroReceipt className="absolute right-0 top-[86%] origin-top-right scale-[0.62] sm:scale-75 lg:scale-[0.8]" />
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-y border-line bg-surface/60">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="mt-2 text-[13.5px] text-muted">{s.label}</dt>
            <dd className="font-display text-[48px] leading-none text-ink">
              <CountUp to={s.to} suffix={s.suffix} duration={1.6} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <p className="eyebrow">Why it&apos;s different</p>
      <h2 data-reveal className="mt-3 max-w-2xl font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[52px]">
        Built to be checked, <em className="text-accent-text">not just believed.</em>
      </h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} {...reveal} transition={{ duration: 0.6, delay: (i % 2) * 0.1, ease: [0.22, 1, 0.36, 1] }}>
            <article className="group flex h-full items-center gap-6 rounded-3xl border border-line bg-surface p-6 shadow-card transition-transform duration-300 hover:-translate-y-1">
              {/* Separate wrapper so the scroll drift doesn't fight the hover transition. */}
              <div className="drift shrink-0">
                <f.art className="h-28 w-36 transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-105" />
              </div>
              <div>
                <h3 className="font-display text-[28px] leading-tight text-ink">{f.title}</h3>
                <p className="mt-1.5 text-[15px] text-ink-2">{f.text}</p>
              </div>
            </article>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function People() {
  return (
    <section id="who" className="scroll-mt-20 border-t border-line bg-surface/50">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <p className="eyebrow">Who it&apos;s for</p>
        <h2 data-reveal className="mt-3 max-w-2xl font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[52px]">
          Everyone at the gate, <em className="text-accent-text">in their own words.</em>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PEOPLE.map((p, i) => (
            <motion.div key={p.who} {...reveal} transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
              <Link
                href={chatLink(p.persona, p.q)}
                className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 shadow-card transition-transform duration-300 hover:-translate-y-1"
              >
                <span
                  className="inline-flex size-12 items-center justify-center rounded-2xl border-2 border-ink text-ink"
                  style={{ background: p.tint, boxShadow: "3px 3px 0 0 var(--ink)" }}
                >
                  <p.icon size={24} weight="duotone" />
                </span>
                <h3 className="mt-6 font-display text-[30px] leading-none text-ink">{p.who}</h3>
                <p className="mt-4 flex-1 text-[15px] text-ink-2">&ldquo;{p.q}&rdquo;</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-text">
                  Ask this <ArrowUpRight size={15} weight="bold" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-5 py-28 text-center">
      <SprigSpot className="sprig pointer-events-none absolute -left-6 top-6 h-40 w-52 -rotate-12 opacity-80 sm:left-10" />
      <SprigSpot className="sprig pointer-events-none absolute -right-6 bottom-6 h-40 w-52 rotate-168 opacity-80 sm:right-10" />
      <h2 data-reveal className="font-display text-[48px] leading-none tracking-tight text-ink sm:text-[72px]">
        Start with a <em className="text-accent-text">question.</em>
      </h2>
      <motion.div {...reveal} transition={{ duration: 0.7, delay: 0.15 }} className="mt-9 flex justify-center">
        <Magnetic>
          <Link href="/chat" className={primaryBtn}>
            Open Copilot <ArrowRight size={17} weight="bold" />
          </Link>
        </Magnetic>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <BrandMark className="size-5" /> Northgate is a fictional college; all data is for demonstration.
        </span>
        <span className="sm:ml-auto">Next.js · SQLite · Gemini</span>
        <Link href="/admin" className="hover:text-ink">
          Staff dashboard
        </Link>
      </div>
    </footer>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();
  useLandingMotion(root);
  return (
    <MotionConfig reducedMotion="user">
      <div ref={root} className="overflow-x-clip">
        <Nav />
        <main>
          <Hero />
          <Stats />
          <Features />
          <HowItWorks />
          <People />
          <Closing />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
