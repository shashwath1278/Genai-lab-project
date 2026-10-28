"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Passage } from "@/lib/retrieval";

/** Turns [n] markers that match a retrieved passage into #cite-n links. */
export function linkCitations(text: string, passages: Pick<Passage, "n">[]): string {
  const valid = new Set(passages.map((p) => p.n));
  return text.replace(/\[(\d{1,2})\](?!\()/g, (m, n) => (valid.has(Number(n)) ? `[${n}](#cite-${n})` : m));
}

function CitationChip({ passage, onCite }: { passage: Passage; onCite: (n: number) => void }) {
  const snippet = passage.text.replace(/\s+/g, " ").replace(/\|/g, " ").slice(0, 170);
  return (
    <span className="group relative inline-block align-baseline">
      <button
        type="button"
        data-cite
        onClick={() => onCite(passage.n)}
        aria-label={`Source ${passage.n}: ${passage.docTitle}, ${passage.heading}`}
        className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-md bg-accent-soft px-1 text-[11px] font-semibold text-accent-text transition-colors hover:bg-accent hover:text-accent-ink"
      >
        {passage.n}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1.5 w-72 rounded-lg border border-line bg-surface p-2.5 text-left opacity-0 shadow-card transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="block text-[12px] font-medium text-ink">{passage.docTitle}</span>
        <span className="block text-[11.5px] text-muted">{passage.heading}</span>
        <span className="mt-1 block text-[12px] leading-snug text-ink-2">{snippet}...</span>
      </span>
    </span>
  );
}

export const AnswerMarkdown = memo(function AnswerMarkdown({
  text,
  passages,
  onCite,
}: {
  text: string;
  passages: Passage[];
  onCite: (n: number) => void;
}) {
  return (
    <div className="answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const cite = href?.match(/^#cite-(\d+)$/);
            const passage = cite && passages.find((p) => p.n === Number(cite[1]));
            if (passage) return <CitationChip passage={passage} onCite={onCite} />;
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {linkCitations(text, passages)}
      </ReactMarkdown>
    </div>
  );
});
