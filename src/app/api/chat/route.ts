import {
  type FileUIPart,
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
import { CHAT_ID, saveChat, storableMessages } from "@/lib/chats";
import { embedGapTopic, logQuery, recordGap, retractGap } from "@/lib/gaps";
import { dependsOnHistory, hasNonAscii, looksHinglish } from "@/lib/language";
import { friendlyLlmError, getModels, getVisionModel } from "@/lib/llm";
import { buildInstructions, buildRewritePrompt, describeReadings } from "@/lib/prompts";
import { type Attachment, readAttachment, readingQuery, validateAttachments } from "@/lib/reader";
import type { ReadingFile } from "@/lib/reading";
import { retrieve } from "@/lib/retrieval";
import { factsFromReadings, factsFromTools, listMemory, memoryEnabled, type NewFact, saveFacts } from "@/lib/memory";
import { getSessionId } from "@/lib/session";
import { createTools } from "@/lib/tools";
import { asksAboutCollege, handbookQuery, type WebSearchOutput, wantsWebSearch, webSearchEnabled } from "@/lib/websearch";

export const maxDuration = 60;

// Answers are lookups and short explanations, not puzzles: keep reasoning
// light (faster, and within Groq's per-minute token budget). Each provider
// reads only its own key.
const LIGHT_REASONING = { groq: { reasoningEffort: "low" } } as const;

const textOf = (m: CopilotMessage | undefined) =>
  (m?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n")
    .trim();

const filesOf = (m: CopilotMessage | undefined): Attachment[] =>
  (m?.parts ?? [])
    .filter((p): p is FileUIPart => p.type === "file")
    .map((p) => ({ name: (p.filename ?? "attachment").slice(0, 80), mediaType: p.mediaType, url: p.url }));

/**
 * Files never go to the answering model (it may be text-only, and they were
 * read already): each becomes a short note, and earlier readings travel as text.
 */
function withoutFiles(messages: CopilotMessage[]): CopilotMessage[] {
  return messages.map((m) => {
    const names = filesOf(m).map((f) => f.name);
    if (!names.length) return m;
    return { ...m, parts: [...m.parts.filter((p) => p.type !== "file"), { type: "text" as const, text: `[Attached: ${names.join(", ")}]` }] };
  });
}

/** Give up on an optional step after a while. */
function within<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([work, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`no reply in ${ms} ms`)), ms)))]).finally(() => clearTimeout(timer));
}

function reportError(error: unknown): string {
  console.error("[chat]", error);
  return friendlyLlmError(error);
}

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

  let body: { id?: string; messages?: CopilotMessage[]; persona?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const persona = getPersona(body.persona).id;
  const language = getLanguage(body.language).id;
  const messages = trimHistory(body.messages ?? []);
  const latest = messages.at(-1);
  const files = latest?.role === "user" ? filesOf(latest) : [];
  const question = latest?.role === "user" ? textOf(latest) || (files.length ? "Read the attached document for me." : "") : "";
  if (!question) return Response.json({ error: "The last message must be a non-empty user message." }, { status: 400 });
  const fileError = validateAttachments(files);
  if (fileError) return Response.json({ error: fileError }, { status: 400 });

  const sessionId = await getSessionId();
  const chatId = typeof body.id === "string" && CHAT_ID.test(body.id) ? body.id : null;
  const memoryOn = memoryEnabled(sessionId);
  const remembered = memoryOn ? listMemory(sessionId) : [];
  const data = getCollegeData();
  const today = todayIso();

  // 0. Read attachments (in memory only; nothing is stored).
  let readings: ReadingFile[] = [];
  if (files.length) {
    const vision = getVisionModel();
    readings = await Promise.all(files.map((f) => readAttachment(f, { vision, text: models.fast, data })));
  }

  // 1. Standalone English search query (follow-ups, other languages, Hinglish).
  const history = messages
    .slice(0, -1)
    .map((m) => ({ role: m.role as "user" | "assistant", text: textOf(m) }))
    .filter((m) => m.text && (m.role === "user" || m.role === "assistant"));
  let rewritten = question;
  // Only when needed: it is an extra model call before anything else can start.
  if ((history.length && dependsOnHistory(question)) || hasNonAscii(question) || looksHinglish(question)) {
    try {
      // Room for reasoning models (gpt-oss) to think before the one-line answer.
      const { text } = await within(
        6000,
        generateText({ model: models.quick, prompt: buildRewritePrompt(history, question), maxOutputTokens: 400, maxRetries: 0, providerOptions: LIGHT_REASONING }),
      );
      const line = text.trim().split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim();
      if (line) rewritten = line;
    } catch (err) {
      console.warn("[chat] query rewrite failed; searching with the raw question:", err instanceof Error ? err.message : err);
    }
  }

  // An explicit request to search the web is always carried out (see prepareStep),
  // and the handbook is searched for the topic, not for the word "reddit".
  const searchRequested = webSearchEnabled() && !readings.length && (wantsWebSearch(question) || wantsWebSearch(rewritten));
  if (searchRequested) rewritten = handbookQuery(rewritten);

  // Documents bring their own topic: a receipt should pull up the fee tables.
  if (readings.length) rewritten = [rewritten, ...readings.map(readingQuery)].join(" ").replace(/\s+/g, " ").trim().slice(0, 400);

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
  // A question about the user's own document isn't a hole in the handbook.
  if (retrieval.confidence === "low" && !readings.length) recordGap(queryId, "low-confidence");

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
  // Facts saved during this answer (by the remember tool, then from the other tools' inputs).
  const memoryChanges: NewFact[] = [];
  const tools = createTools({
    data,
    queryId,
    question,
    today,
    onRemember: memoryOn
      ? (fact) => {
          const changed = saveFacts(sessionId, [fact]);
          memoryChanges.push(...changed);
          return changed.length > 0;
        }
      : undefined,
  });

  // 3. Evidence first, then the streamed answer with tool cards.
  const stream = createUIMessageStream<CopilotMessage>({
    // Chat history: the conversation is saved (attachments by name only) when the answer ends.
    originalMessages: chatId ? storableMessages(body.messages ?? []) : undefined,
    onFinish: chatId ? ({ messages: all }) => saveChat(sessionId, chatId, all) : undefined,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-evidence", id: `evidence-${queryId}`, data: evidence });
      if (readings.length) writer.write({ type: "data-reading", id: `reading-${queryId}`, data: { files: readings } });
      const result = streamText({
        model: models.main,
        instructions: buildInstructions({ persona, language, passages: retrieval.passages, confidence: retrieval.confidence, data, today, webSearch: webSearchEnabled(), attachments: readings, memory: remembered, canRemember: memoryOn }),
        messages: await convertToModelMessages(withoutFiles(messages), {
          tools,
          ignoreIncompleteToolCalls: true,
          // Earlier readings stay in the conversation as text, for follow-ups.
          convertDataPart: (part) =>
            part.type === "data-reading"
              ? { type: "text", text: `(What was read from the user's attachments earlier: ${describeReadings((part.data as { files: ReadingFile[] }).files)})` }
              : undefined,
        }),
        tools,
        stopWhen: isStepCount(5),
        // Asked to search: the first step must search, and is sent only that tool (a
        // third of the tokens, which matters on free per-minute limits). Afterwards a
        // question about the outside world can't end in a handbook gap.
        prepareStep: ({ stepNumber }) => {
          if (!searchRequested) return {};
          if (stepNumber === 0) return { activeTools: ["searchWeb"], toolChoice: { type: "tool", toolName: "searchWeb" } };
          const names = Object.keys(tools) as (keyof typeof tools)[];
          return { activeTools: asksAboutCollege(question) ? names : names.filter((n) => n !== "flagKnowledgeGap") };
        },
        providerOptions: LIGHT_REASONING,
        // A question answered from the web (and not flagged by the model)
        // was about the outside world, not a hole in the handbook.
        onFinish: ({ steps }) => {
          const results = steps.flatMap((s) => s.toolResults);
          const answeredFromWeb = results.some((r) => {
            const out = r.toolName === "searchWeb" ? (r.output as Partial<WebSearchOutput>) : null;
            return !!out?.results?.length && !(out.aboutCollege && !out.collegeFound);
          });
          if (answeredFromWeb && !results.some((r) => r.toolName === "flagKnowledgeGap")) retractGap(queryId);
        },
      });
      // Errors inside the model stream (provider errors, tool failures) are
      // reported through this stream's own onError, not the outer one.
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false, sendReasoning: false, onError: reportError }));

      // After the answer: remember what this exchange said about the user. Free:
      // the facts are the inputs of tools the model already called.
      if (memoryOn) {
        try {
          const steps = await result.steps;
          memoryChanges.push(...saveFacts(sessionId, [...factsFromReadings(readings), ...factsFromTools(steps.flatMap((s) => s.toolCalls), data)]));
        } catch {
          // The answer failed; there's nothing new to remember.
        }
        const saved = [...new Map(memoryChanges.map((f) => [f.key, { label: f.label, value: f.value }])).values()];
        if (saved.length) writer.write({ type: "data-memory", id: `memory-${queryId}`, data: { saved } });
      }
      writer.write({ type: "finish" });
    },
    onError: reportError,
  });
  return createUIMessageStreamResponse({ stream });
}
