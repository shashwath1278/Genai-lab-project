"use client";

import { ArrowUpRight, CalendarDays, Columns3, GraduationCap, Wallet, type LucideIcon } from "lucide-react";
import { getPersona, type PersonaId } from "@/lib/college";

const TITLE: Record<PersonaId, string> = {
  prospective: "Find your way into Northgate",
  current: "Your campus, answered",
  parent: "Clear answers for families",
};

// Shortcuts drop an editable template into the composer instead of sending.
const SHORTCUTS: { icon: LucideIcon; label: string; template: string }[] = [
  { icon: GraduationCap, label: "Eligibility", template: "Am I eligible for CSE with 80% in PCM and a KCET rank of 11,000?" },
  { icon: Wallet, label: "Total cost", template: "What will AIML cost for 4 years via COMEDK with a double non-AC hostel room?" },
  { icon: Columns3, label: "Compare", template: "Compare CSE, AIML and ECE" },
  { icon: CalendarDays, label: "Key dates", template: "What are the upcoming important dates?" },
];

export function EmptyState({ persona, onAsk, onTemplate }: { persona: PersonaId; onAsk: (q: string) => void; onTemplate: (t: string) => void }) {
  const p = getPersona(persona);
  return (
    <div className="rise mx-auto flex min-h-[55vh] max-w-2xl flex-col justify-center">
      <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">{TITLE[persona]}</h1>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onTemplate(s.template)}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] font-medium text-ink shadow-card transition-colors hover:border-line-strong"
          >
            <s.icon size={16} className="shrink-0 text-accent-text" aria-hidden />
            {s.label}
          </button>
        ))}
      </div>

      <ul className="-mx-2 mt-6 space-y-1">
        {p.starters.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[14px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {q}
              <ArrowUpRight size={14} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
