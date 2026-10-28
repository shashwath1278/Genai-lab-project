"use client";

import { BookOpen, ClipboardList, Languages, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { COLLEGE, LANGUAGES, PERSONAS, type LanguageId, type PersonaId } from "@/lib/college";
import { cx, IconButton } from "../ui";
import { BrandMark } from "./AssistantMessage";

export type Status = {
  llm: { provider: string; model: string } | null;
  documents: number;
  chunks: number;
  openGaps: number;
};

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
  onOpenPanel: (tab: "evidence" | "plan") => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-4">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <BrandMark className="size-8 shrink-0" />
        <span className="hidden truncate font-display text-[17px] font-semibold tracking-tight text-ink sm:block" title={`${COLLEGE.name} (fictional demo)`}>
          {COLLEGE.assistant}
        </span>
      </Link>

      <div className="mx-auto hidden items-center rounded-xl border border-line bg-surface p-0.5 md:flex" role="radiogroup" aria-label="I am a">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={persona === p.id}
            onClick={() => onPersona(p.id)}
            title={p.blurb}
            className={cx(
              "rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              persona === p.id ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {p.short}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <label className="sr-only" htmlFor="persona-select">
          I am a
        </label>
        <select
          id="persona-select"
          value={persona}
          onChange={(e) => onPersona(e.target.value as PersonaId)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink md:hidden"
        >
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short}
            </option>
          ))}
        </select>

        <div className="relative flex items-center">
          <Languages size={15} className="pointer-events-none absolute left-2 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="language-select">
            Answer language
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => onLanguage(e.target.value as LanguageId)}
            className="h-8 rounded-lg border border-line bg-surface pl-7 pr-2 text-[13px] text-ink"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.native}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center lg:hidden">
          <IconButton label="Sources" icon={BookOpen} onClick={() => onOpenPanel("evidence")} />
          <span className="relative">
            <IconButton label="Plan" icon={ClipboardList} onClick={() => onOpenPanel("plan")} />
            {planCount > 0 && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink">
                {planCount}
              </span>
            )}
          </span>
        </div>

        <Link
          href="/admin"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          title="Staff dashboard"
        >
          <LayoutDashboard size={15} aria-hidden />
          <span className="hidden sm:inline">Staff</span>
          {!!status?.openGaps && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-[10px] font-semibold text-ink">{status.openGaps}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
