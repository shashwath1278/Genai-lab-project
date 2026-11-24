"use client";

import { CircleNotch, Warning } from "@phosphor-icons/react";
import type { ChecklistResult, CompareResult, CostEstimate, DatesResult, EligibilityResult } from "@/lib/calculators";
import type { CopilotMessage } from "@/lib/chat-types";
import type { MapResult } from "@/lib/campus-map";
import type { WebSearchOutput } from "@/lib/websearch";
import dynamic from "next/dynamic";

// Each card loads with the first answer that shows it.
const CampusMapCard = dynamic(() => import("./CampusMapCard").then((m) => m.CampusMapCard));
const ChecklistCard = dynamic(() => import("./ChecklistCard").then((m) => m.ChecklistCard));
const CompareCard = dynamic(() => import("./CompareCard").then((m) => m.CompareCard));
const CostCard = dynamic(() => import("./CostCard").then((m) => m.CostCard));
const EligibilityCard = dynamic(() => import("./EligibilityCard").then((m) => m.EligibilityCard));
const GapCard = dynamic(() => import("./GapCard").then((m) => m.GapCard));
const TimelineCard = dynamic(() => import("./TimelineCard").then((m) => m.TimelineCard));
const WebResultsCard = dynamic(() => import("./WebResultsCard").then((m) => m.WebResultsCard));

type Part = CopilotMessage["parts"][number];

const WORKING: Record<string, string> = {
  "tool-checkEligibility": "Checking eligibility",
  "tool-estimateCost": "Adding up fees",
  "tool-comparePrograms": "Comparing",
  "tool-getImportantDates": "Checking dates",
  "tool-buildAdmissionChecklist": "Building checklist",
  "tool-flagKnowledgeGap": "Noting the gap",
  "tool-showCampusMap": "Finding it on the map",
  "tool-searchWeb": "Searching the web",
};

export const isToolPart = (part: Part) => part.type.startsWith("tool-");

export function ToolPartView({ part }: { part: Part }) {
  if (!isToolPart(part) || !("state" in part)) return null;

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
        <CircleNotch size={15} className="animate-spin text-muted" aria-hidden />
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

  // Chats saved before search was opened up.
  if ((part.type as string) === "tool-searchOfficialWeb") return <WebResultsCard output={output as WebSearchOutput} />;

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
    case "tool-showCampusMap":
      return <CampusMapCard result={output as MapResult} />;
    case "tool-searchWeb":
      return <WebResultsCard output={output as WebSearchOutput} />;
    case "tool-flagKnowledgeGap":
      return <GapCard output={output as Parameters<typeof import("./GapCard").GapCard>[0]["output"]} />;
    default:
      return null;
  }
}

function ToolError({ message }: { message: string }) {
  return (
    <div className="my-3 flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
      <Warning size={15} className="mt-0.5 shrink-0 text-warning-text" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
