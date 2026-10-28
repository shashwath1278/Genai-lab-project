"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EvidenceData } from "@/lib/chat-types";
import type { Passage } from "@/lib/retrieval";
import { ConfidenceBadge, cx, Meter, Pill } from "../ui";

function highlight(text: string, terms: string[]): ReactNode[] {
  const usable = terms.filter((t) => t.length > 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!usable.length) return [text];
  // Prefix match so "fee" also marks "fees" (FTS uses Porter stemming).
  const re = new RegExp(`\\b(${usable.join("|")})\\w*`, "gi");
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={m.index}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/** Strip markdown table pipes and emphasis so passages read as plain text. */
const plain = (s: string) =>
  s
    .replace(/^\|?[-:| ]+\|?$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function PassageCard({ p, terms, focused, focusTick }: { p: Passage; terms: string[]; focused: boolean; focusTick: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focused || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    ref.current.classList.remove("flash");
    void ref.current.offsetWidth; // restart the animation
    ref.current.classList.add("flash");
    setOpen(true);
  }, [focused, focusTick]);

  const body = plain(p.text);
  const long = body.length > 260;
  const signals = [
    p.semanticRank && `semantic #${p.semanticRank}`,
    p.keywordRank && `keyword #${p.keywordRank}`,
    p.personaBoost && "persona boost",
  ].filter(Boolean);

  return (
    <li ref={ref} id={`passage-${p.n}`} className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-accent px-1 text-[11px] font-semibold text-accent-ink">{p.n}</span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink" title={`${p.docTitle} › ${p.heading}`}>
          {p.heading.split(" › ").pop()}
        </p>
        <span title={signals.join(" · ")}>
          <Meter value={p.similarity} label={`${Math.round(p.similarity * 100)}%`} />
        </span>
      </div>
      {p.keywordRank && (
        <div className="mt-1.5">
          <Pill className="py-0! text-[10.5px]!">keyword match</Pill>
        </div>
      )}
      <p className={cx("mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2", !open && long && "line-clamp-4")}>{highlight(body, terms)}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[12px] font-medium text-accent-text hover:underline">
          {open ? "Less" : "More"}
        </button>
      )}
    </li>
  );
}

export function EvidencePanel({ evidence, focusN, focusTick }: { evidence: EvidenceData | null; focusN: number | null; focusTick: number }) {
  if (!evidence) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-muted">
        <BookOpen size={20} aria-hidden />
        <p className="text-[13px]">Sources appear here</p>
      </div>
    );
  }

  const rewritten = evidence.rewritten.trim().toLowerCase() !== evidence.question.trim().toLowerCase();

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={evidence.confidence} />
        <span
          className="text-[11.5px] text-muted"
          title="Keyword (BM25) and semantic (vector) results, merged with reciprocal rank fusion"
        >
          {evidence.keywordHits} keyword + {evidence.semanticHits} semantic → {evidence.passages.length}
        </span>
      </div>
      {rewritten && (
        <p className="text-[12.5px] text-ink-2">
          <span className="text-muted">Searched: </span>
          {evidence.rewritten}
        </p>
      )}

      {evidence.passages.length === 0 ? (
        <p className="text-[13px] text-muted">No matching passages.</p>
      ) : (
        <ol className="space-y-2.5">
          {evidence.passages.map((p) => (
            <PassageCard key={p.chunkId} p={p} terms={evidence.terms} focused={focusN === p.n} focusTick={focusTick} />
          ))}
        </ol>
      )}
    </div>
  );
}
