import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import type { CopilotMessage, EvidenceData } from "@/lib/chat-types";
import { getLanguage, getPersona } from "@/lib/college";
import { getCollegeData } from "@/lib/data";
import { todayIso } from "@/lib/format";
import { embedGapTopic, logQuery, recordGap } from "@/lib/gaps";
import { friendlyLlmError, getModels } from "@/lib/llm";
import { buildInstructions, buildRewritePrompt } from "@/lib/prompts";
import { retrieve } from "@/lib/retrieval";
import { getSessionId } from "@/lib/session";
import { createTools } from "@/lib/tools";

export const maxDuration = 60;

const textOf = (m: CopilotMessage | undefined) =>
  (m?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n")
    .trim();

/** Last dozen messages, starting at a user turn (some providers require that). */
function trimHistory(messages: CopilotMessage[]): CopilotMessage[] {
  const recent = messages.slice(-12);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser < 0 ? [] : recent.slice(firstUser);
}

export async function POST(req: Request) {
  const models = getModels();
  if (!models) {
    return Response.json(
      { error: "No LLM key configured. Add GEMINI_API_KEY or GROQ_API_KEY to .env.local, then restart `npm run dev`." },
      { status: 503 },
    );
  }

  let body: { messages?: CopilotMessage[]; persona?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const persona = getPersona(body.persona).id;
  const language = getLanguage(body.language).id;
  const messages = trimHistory(body.messages ?? []);
  const latest = messages.at(-1);
  const question = latest?.role === "user" ? textOf(latest) : "";
  if (!question) return Response.json({ error: "The last message must be a non-empty user message." }, { status: 400 });

  const sessionId = await getSessionId();
  const data = getCollegeData();
  const today = todayIso();

  // 1. Standalone English search query (follow-ups, other languages).
  const history = messages
    .slice(0, -1)
    .map((m) => ({ role: m.role as "user" | "assistant", text: textOf(m) }))
    .filter((m) => m.text && (m.role === "user" || m.role === "assistant"));
  let rewritten = question;
  if (history.length || language !== "en" || /[^\x00-\x7F]/.test(question)) {
    try {
      const { text } = await generateText({ model: models.fast, prompt: buildRewritePrompt(history, question), maxOutputTokens: 80 });
      const line = text.trim().split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim();
      if (line) rewritten = line;
    } catch (err) {
      console.warn("[chat] query rewrite failed; searching with the raw question:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Hybrid retrieval, logged; weak matches are filed as knowledge gaps straight away.
  const retrieval = await retrieve(rewritten, { persona });
  const queryId = logQuery({
    sessionId,
    persona,
    language,
    question,
    rewritten,
    topScore: retrieval.topSimilarity,
    confidence: retrieval.confidence,
    topicEmbedding: await embedGapTopic(rewritten),
  });
  if (retrieval.confidence === "low") recordGap(queryId, "low-confidence");

  const evidence: EvidenceData = {
    queryId,
    question,
    rewritten,
    confidence: retrieval.confidence,
    topSimilarity: retrieval.topSimilarity,
    terms: retrieval.terms,
    keywordHits: retrieval.keywordHits,
    semanticHits: retrieval.semanticHits,
    passages: retrieval.passages,
    related: retrieval.related,
    persona,
  };
  const tools = createTools({ data, queryId, question, today });

  // 3. Evidence first, then the streamed answer with tool cards.
  const stream = createUIMessageStream<CopilotMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-evidence", id: `evidence-${queryId}`, data: evidence });
      const result = streamText({
        model: models.main,
        instructions: buildInstructions({ persona, language, passages: retrieval.passages, confidence: retrieval.confidence, data, today }),
        messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
        tools,
        stopWhen: isStepCount(5),
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, sendReasoning: false }));
    },
    onError: (error) => {
      console.error("[chat]", error);
      return friendlyLlmError(error);
    },
  });
  return createUIMessageStreamResponse({ stream });
}
