"use client";

import { Check, Copy, CornerDownRight, Pin, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import type { CopilotMessage, EvidenceData } from "@/lib/chat-types";
import { isToolPart, ToolPartView } from "../cards/ToolPartView";
import { usePlan } from "../plan/PlanContext";
import { CONFIDENCE, cx, IconButton } from "../ui";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { speakableText } from "./speech";

export function getEvidence(message: CopilotMessage): EvidenceData | undefined {
  const part = message.parts.find((p) => p.type === "data-evidence");
  return part && "data" in part ? (part.data as EvidenceData) : undefined;
}

export const messageText = (m: CopilotMessage) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n")
    .trim();

export function BrandMark({ className }: { className?: string }) {
  // A gate arch: Northgate's mark.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--accent)" />
      <path d="M6.5 18V11a5.5 5.5 0 0 1 11 0v7" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 18v-5.5a2 2 0 0 1 4 0V18" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TypingDots({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 py-1 text-[13.5px] text-muted">
      <span className="typing inline-flex gap-1" aria-hidden>
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="size-1.5 rounded-full bg-accent" />
      </span>
      {label}
    </p>
  );
}

export function AssistantMessage({
  message,
  streaming,
  isLast,
  selected,
  feedback,
  speaking,
  onCite,
  onShowEvidence,
  onFeedback,
  onSpeak,
  onFollowUp,
}: {
  message: CopilotMessage;
  streaming: boolean;
  isLast: boolean;
  selected: boolean;
  feedback?: "up" | "down";
  speaking: boolean;
  onCite: (n: number) => void;
  onShowEvidence: () => void;
  onFeedback: (value: "up" | "down") => void;
  onSpeak: () => void;
  onFollowUp: (text: string) => void;
}) {
  const { add } = usePlan();
  const [copied, setCopied] = useState(false);
  const evidence = getEvidence(message);
  const passages = evidence?.passages ?? [];
  const text = messageText(message);
  const hasContent = message.parts.some((p) => (p.type === "text" && (p as { text: string }).text.trim()) || isToolPart(p));
  const working = streaming && isLast;
  const conf = evidence ? CONFIDENCE[evidence.confidence] : null;

  const pin = () => {
    const clean = speakableText(text);
    const first = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
    add([{ kind: "note", title: (evidence?.question ?? first).slice(0, 120), detail: clean.slice(0, 1000) }]);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(speakableText(text)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="group/msg rise flex gap-3" aria-busy={working}>
      <BrandMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (part as { text: string }).text.trim() ? (
              <AnswerMarkdown key={i} text={(part as { text: string }).text} passages={passages} onCite={onCite} />
            ) : null;
          }
          if (isToolPart(part)) return <ToolPartView key={i} part={part} />;
          return null;
        })}

        {working && !hasContent && <TypingDots label={evidence ? "Writing…" : "Searching…"} />}

        {!working && hasContent && (
          <div className="mt-2 flex flex-wrap items-center gap-0.5">
            {conf && passages.length > 0 && (
              <button
                type="button"
                onClick={onShowEvidence}
                aria-label={`${passages.length} sources, ${conf.label.toLowerCase()}`}
                title={conf.label}
                className={cx(
                  "mr-1 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                  selected ? "border-accent bg-accent-soft text-accent-text" : "border-line text-ink-2 hover:bg-surface-2",
                )}
              >
                <conf.icon size={13} className={conf.text} aria-hidden />
                {passages.length} sources
              </button>
            )}
            <span className="flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100 md:focus-within:opacity-100">
              <IconButton label={speaking ? "Stop" : "Read aloud"} icon={speaking ? VolumeX : Volume2} active={speaking} onClick={onSpeak} disabled={!text} />
              <IconButton label="Pin to plan" icon={Pin} onClick={pin} disabled={!text} />
              <IconButton label={copied ? "Copied" : "Copy"} icon={copied ? Check : Copy} onClick={copy} disabled={!text} />
              {evidence && (
                <>
                  <IconButton label="Helpful" icon={ThumbsUp} active={feedback === "up"} onClick={() => onFeedback("up")} />
                  <IconButton label="Not helpful" icon={ThumbsDown} active={feedback === "down"} onClick={() => onFeedback("down")} />
                </>
              )}
            </span>
          </div>
        )}

        {isLast && !working && evidence && evidence.related.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evidence.related.map((r) => (
              <button
                key={r.label + r.docTitle}
                type="button"
                onClick={() => onFollowUp(`Tell me about ${r.label.toLowerCase()} (${r.docTitle})`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                <CornerDownRight size={12} aria-hidden /> {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
