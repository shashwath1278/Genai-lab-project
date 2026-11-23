"use client";

import { BookOpen, Brain, ClipboardText, SquaresFour, Translate } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { LANGUAGES, PERSONAS, type LanguageId, type PersonaId } from "@/lib/college";
import { Wordmark } from "../art/Brand";
import { ThemeToggle } from "../ThemeToggle";
import { cx, IconButton } from "../ui";

export type Status = {
  llm: { provider: string; model: string } | null;
  documents: number;
  chunks: number;
  openGaps: number;
  webSearch?: boolean;
};

const selectClass = "h-9 rounded-full border border-line bg-surface text-[13px] text-ink transition-colors hover:border-line-strong";

export function Header({
  persona,
  onPersona,
  language,
  onLanguage,
  status,
  planCount,
  onOpenPanel,
}: {
  persona: PersonaId;
  onPersona: (p: PersonaId) => void;
  language: LanguageId;
  onLanguage: (l: LanguageId) => void;
  status: Status | null;
  planCount: number;
  onOpenPanel: (tab: "evidence" | "plan" | "memory") => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-3 backdrop-blur sm:px-5">
      <Wordmark />

      <div className="mx-auto hidden items-center rounded-full border border-line bg-surface p-1 md:flex" role="radiogroup" aria-label="I am a">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={persona === p.id}
            onClick={() => onPersona(p.id)}
            title={p.blurb}
            className="relative rounded-full px-4 py-1.5 text-[13.5px] font-medium"
          >
            {persona === p.id && (
              <motion.span layoutId="persona-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />
            )}
            <span className={cx("relative transition-colors", persona === p.id ? "text-accent-ink" : "text-ink-2 hover:text-ink")}>{p.short}</span>
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <label className="sr-only" htmlFor="persona-select">
          I am a
        </label>
        <select id="persona-select" value={persona} onChange={(e) => onPersona(e.target.value as PersonaId)} className={cx(selectClass, "px-3 md:hidden")}>
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short}
            </option>
          ))}
        </select>

        <div className="relative flex items-center">
          <Translate size={15} className="pointer-events-none absolute left-2.5 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="language-select">
            Answer language
          </label>
          <select id="language-select" value={language} onChange={(e) => onLanguage(e.target.value as LanguageId)} className={cx(selectClass, "pl-8 pr-3")}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.native}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center lg:hidden">
          <IconButton label="Sources" icon={BookOpen} onClick={() => onOpenPanel("evidence")} />
          <IconButton label="Memory" icon={Brain} onClick={() => onOpenPanel("memory")} />
          <span className="relative">
            <IconButton label="Plan" icon={ClipboardText} onClick={() => onOpenPanel("plan")} />
            {planCount > 0 && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink">
                {planCount}
              </span>
            )}
          </span>
        </div>

        <ThemeToggle />

        {/* Hidden on phones, where the header has no room; the landing page links it too. */}
        <Link
          href="/admin"
          className="hidden h-9 items-center gap-1.5 rounded-full px-2.5 sm:inline-flex text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          title="Staff dashboard"
        >
          <SquaresFour size={16} aria-hidden />
          <span>Staff</span>
          {!!status?.openGaps && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-laterite px-1 text-[10px] font-semibold text-white">{status.openGaps}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
