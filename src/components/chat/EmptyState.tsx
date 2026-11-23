"use client";

import { ArrowUpRight, CalendarBlank, Columns, GraduationCap, Paperclip, Wallet, type Icon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { getPersona, type PersonaId } from "@/lib/college";
import { SprigSpot } from "../art/spots";

const TITLE: Record<PersonaId, [string, string]> = {
  prospective: ["Find your way", "into Northgate."],
  current: ["Your campus,", "answered."],
  parent: ["Clear answers", "for families."],
};

// Shortcuts drop an editable template into the composer instead of sending.
const SHORTCUTS: { icon: Icon; label: string; template: string; tint: string }[] = [
  { icon: GraduationCap, label: "Eligibility", template: "Am I eligible for CSE with 80% in PCM and a KCET rank of 11,000?", tint: "var(--accent-soft)" },
  { icon: Wallet, label: "Total cost", template: "What will AIML cost for 4 years via COMEDK with a double non-AC hostel room?", tint: "var(--marigold-soft)" },
  { icon: Columns, label: "Compare", template: "Compare CSE, AIML and ECE", tint: "var(--leaf-soft)" },
  { icon: CalendarBlank, label: "Key dates", template: "What are the upcoming important dates?", tint: "var(--laterite-soft)" },
];

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export function EmptyState({
  persona,
  onAsk,
  onTemplate,
  webSearch = false,
}: {
  persona: PersonaId;
  onAsk: (q: string) => void;
  onTemplate: (t: string) => void;
  webSearch?: boolean;
}) {
  const p = getPersona(persona);
  const [plain, accent] = TITLE[persona];
  return (
    <motion.div
      key={persona}
      className="relative mx-auto flex min-h-[58vh] max-w-2xl flex-col justify-center"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.div variants={item} className="pointer-events-none absolute -right-4 top-4 hidden h-32 w-44 rotate-6 sm:block">
        <SprigSpot className="size-full" />
      </motion.div>
      <motion.p variants={item} className="eyebrow">
        Ask Northgate
      </motion.p>
      <motion.h1 variants={item} className="mt-3 font-display text-[44px] leading-[0.98] tracking-tight text-ink sm:text-[58px]">
        {plain} <em className="text-accent-text">{accent}</em>
      </motion.h1>

      <motion.div variants={item} className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onTemplate(s.template)}
            className="group flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 text-[14px] font-medium text-ink shadow-card transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink" style={{ background: s.tint }}>
              <s.icon size={17} weight="duotone" />
            </span>
            {s.label}
          </button>
        ))}
      </motion.div>

      <motion.ul variants={item} className="-mx-2 mt-7 space-y-0.5">
        {p.starters.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[15px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {q}
              <ArrowUpRight size={14} weight="bold" className="text-accent-text opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </button>
          </li>
        ))}
      </motion.ul>

      <motion.p variants={item} className="mt-6 flex items-start gap-2 text-[13px] leading-snug text-muted">
        <Paperclip size={15} className="mt-px shrink-0 text-accent-text" aria-hidden />
        <span>
          Attach a photo of a marks card, rank card, fee receipt or notice and I&apos;ll read it for you.
          {webSearch && " For entrance exams and government schemes, I can also check the official sites."}
        </span>
      </motion.p>
    </motion.div>
  );
}
