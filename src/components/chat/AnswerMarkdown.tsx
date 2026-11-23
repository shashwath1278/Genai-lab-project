"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeCitations } from "@/lib/citations";
import type { Passage } from "@/lib/retrieval";
import type { WebResult } from "@/lib/websearch";
import { SiteLogo } from "../SiteLogo";

/**
 * Turns [n] markers that match a retrieved passage into #cite-n links, and
 * [Wn] markers that match a web result into #web-Wn links.
 */
export function linkCitations(text: string, passages: Pick<Passage, "n">[], web: Pick<WebResult, "id">[] = []): string {
  const valid = new Set(passages.map((p) => p.n));
  const webIds = new Set(web.map((w) => w.id));
  return normalizeCitations(text)
    .replace(/\[(\d{1,2})\](?!\()/g, (m, n) => (valid.has(Number(n)) ? `[${n}](#cite-${n})` : m))
    .replace(/\[(W\d{1,2})\](?!\()/g, (m, id) => (webIds.has(id) ? `[${id}](#web-${id})` : m));
}

function WebChip({ result }: { result: WebResult }) {
  return (
    <span className="group relative inline-block align-baseline">
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer noopener"
        data-cite
        aria-label={`Official source ${result.id}: ${result.title}, ${result.domain} (opens the site)`}
        className="mx-0.5 inline-flex h-5 max-w-36 -translate-y-px items-center gap-1 rounded-full border border-line bg-surface py-0 pl-0.5 pr-2 text-[11.5px] font-medium text-ink-2 no-underline transition-colors hover:border-accent hover:text-accent-text"
      >
        <SiteLogo domain={result.domain} favicon={result.favicon} size={15} className="rounded-full border-0" />
        <span className="truncate">{result.site}</span>
      </a>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1.5 w-72 rounded-lg border border-line bg-surface p-2.5 text-left opacity-0 shadow-card transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="block text-[12px] font-medium text-ink">{result.title}</span>
        <span className="block font-mono text-[11px] text-muted">{result.domain}</span>
      </span>
    </span>
  );
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
  web = [],
  onCite,
}: {
  text: string;
  passages: Passage[];
  web?: WebResult[];
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
            const webRef = href?.match(/^#web-(W\d+)$/);
            const result = webRef && web.find((w) => w.id === webRef[1]);
            if (result) return <WebChip result={result} />;
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
        {linkCitations(text, passages, web)}
      </ReactMarkdown>
    </div>
  );
});
