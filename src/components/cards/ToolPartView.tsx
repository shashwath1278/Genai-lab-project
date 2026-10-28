"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import type { ChecklistResult, CompareResult, CostEstimate, DatesResult, EligibilityResult } from "@/lib/calculators";
import type { CopilotMessage } from "@/lib/chat-types";
import { ChecklistCard } from "./ChecklistCard";
import { CompareCard } from "./CompareCard";
import { CostCard } from "./CostCard";
import { EligibilityCard } from "./EligibilityCard";
import { GapCard } from "./GapCard";
import { TimelineCard } from "./TimelineCard";

type Part = CopilotMessage["parts"][number];

const WORKING: Record<string, string> = {
  "tool-checkEligibility": "Checking eligibility",
  "tool-estimateCost": "Adding up fees",
  "tool-comparePrograms": "Comparing",
  "tool-getImportantDates": "Checking dates",
  "tool-buildAdmissionChecklist": "Building checklist",
  "tool-flagKnowledgeGap": "Noting the gap",
};

export const isToolPart = (part: Part) => part.type.startsWith("tool-");

export function ToolPartView({ part }: { part: Part }) {
  if (!isToolPart(part) || !("state" in part)) return null;

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
        <Loader2 size={15} className="animate-spin text-muted" aria-hidden />
        {WORKING[part.type] ?? "Working"}…
      </div>
    );
  }
  if (part.state === "output-error") {
    return <ToolError message={part.errorText} />;
  }
  if (part.state !== "output-available") return null;

  const output = part.output as unknown;
  if (output && typeof output === "object" && "error" in output) {
    return <ToolError message={String((output as { error: string }).error)} />;
  }

  switch (part.type) {
    case "tool-checkEligibility":
      return <EligibilityCard result={output as EligibilityResult} />;
    case "tool-estimateCost":
      return <CostCard estimate={output as CostEstimate} />;
    case "tool-comparePrograms":
      return <CompareCard result={output as CompareResult} />;
    case "tool-getImportantDates":
      return <TimelineCard result={output as DatesResult} />;
    case "tool-buildAdmissionChecklist":
      return <ChecklistCard result={output as ChecklistResult} />;
    case "tool-flagKnowledgeGap":
      return <GapCard output={output as Parameters<typeof GapCard>[0]["output"]} />;
    default:
      return null;
  }
}

function ToolError({ message }: { message: string }) {
  return (
    <div className="my-3 flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
      <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning-text" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
