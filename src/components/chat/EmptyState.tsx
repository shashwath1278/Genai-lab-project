"use client";

import { ArrowUpRight, Brain, CalendarBlank, Columns, GraduationCap, Paperclip, Wallet, type Icon } from "@phosphor-icons/react";
import { getPersona, type PersonaId } from "@/lib/college";
import { SprigSpot } from "../art/spots";
import { factText } from "../memory/useMemory";

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

// A CSS entrance, so the page is readable before any JavaScript has run.
const step = (n: number) => ({ animationDelay: `${n * 35}ms` });

export function EmptyState({
  persona,
  onAsk,
  onTemplate,
  webSearch = false,
  remembered = [],
  onOpenMemory,
}: {
  persona: PersonaId;
  onAsk: (q: string) => void;
  onTemplate: (t: string) => void;
  webSearch?: boolean;
  remembered?: { id: number; label: string; value: string }[];
  onOpenMemory?: () => void;
}) {
  const p = getPersona(persona);
  const [plain, accent] = TITLE[persona];
  return (
    <div key={persona} className="relative mx-auto flex min-h-[58vh] max-w-2xl flex-col justify-center">
      <div className="rise pointer-events-none absolute -right-4 top-4 hidden h-32 w-44 rotate-6 sm:block" style={step(1)}>
        <SprigSpot className="size-full" />
      </div>
      <p className="eyebrow">Ask Northgate</p>
      <h1 className="rise mt-3 font-display text-[44px] leading-[0.98] tracking-tight text-ink sm:text-[58px]">
        {plain} <em className="text-accent-text">{accent}</em>
      </h1>

      {remembered.length > 0 && (
        <div className="rise mt-5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
          <Brain size={15} weight="duotone" className="text-accent-text" aria-hidden />
          <span>Welcome back. I remember</span>
          {remembered.slice(0, 4).map((f) => (
            <span key={f.id} title={f.label} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12.5px] text-ink">
              {factText(f)}
            </span>
          ))}
          {onOpenMemory && (
            <button type="button" onClick={onOpenMemory} className="text-[12.5px] font-medium text-accent-text hover:underline">
              {remembered.length > 4 ? `+${remembered.length - 4} more` : "Manage"}
            </button>
          )}
        </div>
      )}

      <div style={step(1)} className="rise mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
      </div>

      <ul style={step(2)} className="rise -mx-2 mt-7 space-y-0.5">
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
      </ul>

      <p style={step(3)} className="rise mt-6 flex items-start gap-2 text-[13px] leading-snug text-muted">
        <Paperclip size={15} className="mt-px shrink-0 text-accent-text" aria-hidden />
        <span>
          Attach a photo of a marks card, rank card, fee receipt or notice and I&apos;ll read it for you.
          {webSearch && " I can also search the web: try \"scan Reddit for hostel life tips\" or \"check the official KEA site\"."}
        </span>
      </p>
    </div>
  );
}
