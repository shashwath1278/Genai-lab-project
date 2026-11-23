"use client";

import { ArrowBendDownRight, Check, Copy, PushPin, SpeakerHigh, SpeakerSlash, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";
import type { CopilotMessage, EvidenceData } from "@/lib/chat-types";
import type { WebResult } from "@/lib/websearch";
import { BrandMark } from "../art/Brand";
import { ReadingCards } from "../cards/ReadingCard";
import { isToolPart, ToolPartView } from "../cards/ToolPartView";
import { usePlan } from "../plan/PlanContext";
import { SiteStack } from "../SiteLogo";
import { CONFIDENCE, cx, IconButton } from "../ui";
import { AnswerMarkdown } from "./AnswerMarkdown";
import { speakableText } from "./speech";

export function getEvidence(message: CopilotMessage): EvidenceData | undefined {
  const part = message.parts.find((p) => p.type === "data-evidence");
  return part && "data" in part ? (part.data as EvidenceData) : undefined;
}

/** Official-site results the answer may cite as [W1]. */
export function getWebResults(message: CopilotMessage): WebResult[] {
  return message.parts.flatMap((p) =>
    p.type === "tool-searchOfficialWeb" && p.state === "output-available" && p.output && "results" in p.output ? p.output.results : [],
  );
}

export const messageText = (m: CopilotMessage) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n")
    .trim();

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
  const web = getWebResults(message);
  const text = messageText(message);
  const hasContent = message.parts.some((p) => (p.type === "text" && (p as { text: string }).text.trim()) || isToolPart(p) || p.type === "data-reading");
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
    <motion.article
      className="group/msg flex gap-3"
      aria-busy={working}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <BrandMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1 pt-0.5">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (part as { text: string }).text.trim() ? (
              <AnswerMarkdown key={i} text={(part as { text: string }).text} passages={passages} web={web} onCite={onCite} />
            ) : null;
          }
          if (isToolPart(part)) return <ToolPartView key={i} part={part} />;
          if (part.type === "data-reading") return <ReadingCards key={i} data={part.data} onAsk={onFollowUp} />;
          return null;
        })}

        {working && !hasContent && <TypingDots label={evidence ? "Writing…" : "Searching…"} />}
        {!working && !hasContent && <p className="py-1 text-[14px] text-muted">No answer came back. Try asking again.</p>}

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
            {web.length > 0 && (
              <button
                type="button"
                onClick={onShowEvidence}
                aria-label={`${web.length} web sources: ${[...new Set(web.map((w) => w.site))].join(", ")}`}
                className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-line py-0 pl-1 pr-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                <SiteStack sources={web} size={18} />
                {web.length} web {web.length === 1 ? "source" : "sources"}
              </button>
            )}
            <span className="flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100 md:focus-within:opacity-100">
              <IconButton label={speaking ? "Stop" : "Read aloud"} icon={speaking ? SpeakerSlash : SpeakerHigh} active={speaking} onClick={onSpeak} disabled={!text} />
              <IconButton label="Pin to plan" icon={PushPin} onClick={pin} disabled={!text} />
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
            {evidence.related.map((r, i) => (
              <motion.button
                key={r.label + r.docTitle}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                onClick={() => onFollowUp(`Tell me about ${r.label.toLowerCase()} (${r.docTitle})`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-accent-text"
              >
                <ArrowBendDownRight size={12} aria-hidden /> {r.label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
