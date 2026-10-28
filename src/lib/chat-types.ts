import type { InferUITools, UIMessage } from "ai";
import type { Confidence, Passage } from "./retrieval";
import type { CopilotTools } from "./tools";

export type EvidenceData = {
  queryId: number;
  question: string;
  rewritten: string;
  confidence: Confidence;
  topSimilarity: number;
  terms: string[];
  keywordHits: number;
  semanticHits: number;
  passages: Passage[];
  related: { label: string; docTitle: string }[];
  persona: string;
};

export type CopilotUITools = InferUITools<CopilotTools>;
export type CopilotMessage = UIMessage<never, { evidence: EvidenceData }, CopilotUITools>;
