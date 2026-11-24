import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// End-to-end through the real /api/chat handler: real retrieval, calculators,
// logging and gap clustering on a throwaway database; only the LLM is scripted.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};
type Chunk = Record<string, unknown>;
const toolCall = (toolName: string, input: object): Chunk[] => [
  { type: "tool-call", toolCallId: `call-${toolName}`, toolName, input: JSON.stringify(input) },
  { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
];
const text = (s: string): Chunk[] => [
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: s },
  { type: "text-end", id: "t1" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
];

const script: Chunk[][] = [];
const rewrites: string[] = [];
const prompts: string[] = [];
const visionReplies: string[] = [];
const toolChoices: unknown[] = [];

vi.mock("../src/lib/session", () => ({ getSessionId: async () => "test-session" }));
vi.mock("../src/lib/llm", () => ({
  friendlyLlmError: (e: unknown) => String(e),
  getModels: () => ({
    info: { provider: "gemini", model: "mock", fastModel: "mock" },
    fast: new MockLanguageModelV4({}),
    quick: new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: rewrites.shift() ?? "fallback query" }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    }),
    main: new MockLanguageModelV4({
      doStream: async (options) => {
        prompts.push(JSON.stringify(options.prompt));
        toolChoices.push(options.toolChoice);
        return { stream: simulateReadableStream({ chunks: (script.shift() ?? text("(no script)")) as never[] }) };
      },
    }),
  }),
  getVisionModel: () => ({
    label: "mock-vision",
    pdf: null,
    model: new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: visionReplies.shift() ?? "{}" }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    }),
  }),
}));

const dbFile = path.join(os.tmpdir(), `northgate-test-${process.pid}.db`);
let POST: (req: Request) => Promise<Response>;
let db: import("better-sqlite3").Database;

type Msg = { role: "user" | "assistant"; text: string; files?: { mediaType: string; url: string; filename: string }[] };
async function chat(messages: Msg[], body: object = {}) {
  const res = await POST(
    new Request("http://test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: messages.map((m, i) => ({
          id: String(i),
          role: m.role,
          parts: [...(m.files ?? []).map((f) => ({ type: "file", ...f })), { type: "text", text: m.text }],
        })),
        ...body,
      }),
    }),
  );
  expect(res.status).toBe(200);
  const chunks = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
  return chunks as { type: string; data?: Record<string, unknown>; output?: Record<string, unknown>; delta?: string }[];
}

beforeAll(async () => {
  process.env.COLLEGE_DB_PATH = dbFile;
  process.env.COLLEGE_DATA_DIR = path.join(process.cwd(), "fixtures", "northgate");
  const { seed } = await import("../scripts/seed");
  await seed({ fresh: true });
  ({ POST } = await import("../src/app/api/chat/route"));
  db = (await import("../src/lib/db")).getDb();
}, 120_000);

afterAll(async () => {
  (await import("../src/lib/db")).closeDb();
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(dbFile + s, { force: true });
});

describe("POST /api/chat", () => {
  it("streams evidence first, runs the cost tool, then the cited answer", async () => {
    script.push(toolCall("estimateCost", { program: "CSE", exam: "KCET", hostel: "TRIPLE" }), text("About **Rs 10.99 lakh** in total [1]."));
    const chunks = await chat([{ role: "user", text: "What will CSE cost for 4 years with a triple hostel room?" }]);
    const types = chunks.map((c) => c.type);

    const evidenceAt = types.indexOf("data-evidence");
    expect(evidenceAt).toBeGreaterThan(-1);
    expect(evidenceAt).toBeLessThan(types.indexOf("tool-output-available"));
    const evidence = chunks[evidenceAt].data as { passages: { docSlug: string }[]; confidence: string; rewritten: string; question: string };
    expect(evidence.passages).toHaveLength(6);
    expect(evidence.passages.map((p) => p.docSlug)).toContain("programmes-eligibility-fees");
    expect(evidence.rewritten).toBe(evidence.question); // first English turn: no rewrite call

    const output = chunks.find((c) => c.type === "tool-output-available")?.output as { totals: { grand: number } };
    expect(output.totals.grand).toBe(1_099_000);
    expect(chunks.filter((c) => c.type === "text-delta").map((c) => c.delta).join("")).toContain("[1]");

    // The passages reached the model, numbered, inside the instructions.
    expect(prompts.at(-2)).toMatch(/\[\d\] Programmes, Eligibility & Fees \(2026-27\) › B\.E\. Computer Science & Engineering \(CSE\)/);
    expect(prompts.at(-2)).toContain("Write your answer in English.");
    expect(db.prepare("SELECT COUNT(*) AS n FROM queries").get()).toEqual({ n: 1 });
  });

  it("rewrites follow-ups and other languages into a standalone English query", async () => {
    rewrites.push("hostel in-time for women students");
    script.push(text("रात 10 बजे [1]।"));
    const chunks = await chat([{ role: "user", text: "लड़कियों के हॉस्टल का समय क्या है?" }], { language: "hi", persona: "parent" });
    const evidence = chunks.find((c) => c.type === "data-evidence")!.data as { rewritten: string; passages: { docSlug: string }[] };
    expect(evidence.rewritten).toBe("hostel in-time for women students");
    expect(evidence.passages[0].docSlug).toBe("hostel-life");
    expect(prompts.at(-1)).toContain("Hindi");
  });

  it("files unanswerable questions as one knowledge gap", async () => {
    script.push(toolCall("flagKnowledgeGap", { topic: "swimming pool" }), text("I don't have that information."));
    const first = await chat([{ role: "user", text: "Is there a swimming pool on campus?" }]);
    const gap = first.find((c) => c.type === "tool-output-available")?.output as { logged: boolean; contact: { office: string } };
    expect(gap.logged).toBe(true);
    expect(gap.contact.office).toBeTruthy();

    script.push(toolCall("flagKnowledgeGap", { topic: "swimming pool" }), text("I don't have that information."));
    await chat([{ role: "user", text: "Can students use a swimming pool at Northgate?" }]);

    const clusters = db.prepare("SELECT label, count, status FROM gap_clusters").all() as { count: number; status: string }[];
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ count: 2, status: "open" });
  });

  it("shows the campus map and hands the model the directions, not the geometry", async () => {
    script.push(toolCall("showCampusMap", { to: "examination section" }), text("It's in Block B, about 4 minutes from the gate."));
    const chunks = await chat([{ role: "user", text: "Where is the Examination Section?" }]);
    const map = chunks.find((c) => c.type === "tool-output-available")?.output as { to: { id: string }; route: { points: unknown[]; steps: string[] } };
    expect(map.to.id).toBe("block-b");
    expect(map.route.points.length).toBeGreaterThan(3);
    expect(map.route.steps.at(-1)).toBe("Block B is on your left.");
    const toModel = prompts.at(-1)!;
    expect(toModel).toContain("Block B is on your left.");
    expect(toModel).not.toContain("points");
  });

  it("reads an attached receipt, audits it in code, and keeps the image away from the answering model", async () => {
    visionReplies.push(JSON.stringify({
      kind: "fee_receipt", title: "Fee receipt 2026-27", summary: "AIML fees under KCET.",
      fees: { lines: [{ label: "Tuition fee", amount: 110000 }, { label: "Exam, lab, library & activity fees", amount: 25000 }], total: 140000, program: "AIML", quota: "KCET" },
      dates: [], marks: null, exam: null, unclear: null,
    }));
    script.push(text("Two things don't match the official fees."));
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const before = (db.prepare("SELECT COUNT(*) AS n FROM gap_clusters").get() as { n: number }).n;
    const chunks = await chat([{ role: "user", text: "Is this receipt right?", files: [{ mediaType: "image/png", url: png, filename: "receipt.png" }] }]);

    const reading = chunks.find((c) => c.type === "data-reading")?.data as { files: { audit: { verdict: string; totalMatches: boolean; lines: { status: string }[] } }[] };
    expect(reading.files[0].audit).toMatchObject({ verdict: "mismatch", totalMatches: false });
    expect(reading.files[0].audit.lines.map((l) => l.status)).toEqual(["ok", "higher"]);
    expect(chunks.map((c) => c.type).indexOf("data-reading")).toBeLessThan(chunks.map((c) => c.type).indexOf("text-delta"));

    const toModel = prompts.at(-1)!;
    expect(toModel).toContain("ATTACHMENTS");
    expect(toModel).toContain("Rs 7,000 more");
    expect(toModel).toContain("[Attached: receipt.png]");
    expect(toModel).not.toContain("base64");
    expect((db.prepare("SELECT COUNT(*) AS n FROM gap_clusters").get() as { n: number }).n).toBe(before);
  });

  it("refuses attachments that aren't photos or PDFs", async () => {
    const res = await POST(
      new Request("http://test/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ id: "1", role: "user", parts: [{ type: "file", mediaType: "text/html", filename: "x.html", url: "data:text/html;base64,PGI+aGk8L2I+" }, { type: "text", text: "read" }] }] }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/isn't a photo/);
  });

  it("always searches when asked to, and never passes another college off as Northgate", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) =>
      String(url).includes("api.tavily.com")
        ? new Response(JSON.stringify({ results: [{ title: "Ramaiah Medical College placements thread", url: "https://www.reddit.com/r/Btechtards/1", content: "60% placed" }] }))
        : realFetch(url, init),
    );
    try {
      script.push(text("I searched Reddit and found nothing about Northgate. The handbook says 87% were placed [1]."));
      const chunks = await chat([{ role: "user", text: "scan reddit for last year placements of this college" }]);
      // The search ran without the model having to ask for it, for the college by its real name.
      const call = chunks.find((c) => c.type === "tool-input-available") as unknown as { input: { query: string; sites: string[] } };
      expect(call.input).toMatchObject({ query: "Ramaiah Institute of Technology MSRIT last year placements", sites: ["Reddit"] });
      const out = chunks.find((c) => c.type === "tool-output-available")?.output as { scope: string; collegeFound: boolean; results: { id: string; site: string }[] };
      expect(out).toMatchObject({ scope: "Reddit", collegeFound: false, results: [expect.objectContaining({ id: "W1", site: "Reddit" })] });
      // The handbook was searched for the topic, so its placements page is there to answer from.
      const evidence = chunks.find((c) => c.type === "data-evidence")!.data as { rewritten: string; passages: { docSlug: string }[] };
      expect(evidence.rewritten).toBe("last year placements of this college");
      expect(evidence.passages.map((p) => p.docSlug)).toContain("placements");
      expect(prompts.at(-1)).toContain("NONE of these results name M S Ramaiah Institute of Technology");
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TAVILY_API_KEY;
    }
  });

  it("doesn't force a search on ordinary questions, or without a key", async () => {
    script.push(text("Yes [1]."));
    await chat([{ role: "user", text: "Can I pay the fees online?" }]);
    expect(toolChoices.at(-1)).toEqual({ type: "auto" });
    script.push(text("Search isn't set up."));
    await chat([{ role: "user", text: "scan reddit for hostel reviews" }]);
    expect(toolChoices.at(-1)).toEqual({ type: "auto" });
    expect(prompts.at(-1)).not.toContain("searchWeb searches the live web");
  });

  it("remembers the user's details from tool inputs and uses them in the next chat", async () => {
    const memory = await import("../src/lib/memory");
    memory.clearMemory("test-session");
    script.push(toolCall("checkEligibility", { program: "AIML", exam: "KCET", rank: 12000, aggregatePercent: 85 }), text("You're likely to get AIML."));
    const chunks = await chat([{ role: "user", text: "Can I get AIML with KCET rank 12000 and 85% PCM?" }], { id: "chat-memory-1" });
    const update = chunks.find((c) => c.type === "data-memory")?.data as { saved: { label: string; value: string }[] };
    expect(update.saved.map((s) => s.value)).toEqual(expect.arrayContaining(["AIML (Artificial Intelligence & Machine Learning)", "KCET rank 12,000", "85%"]));
    // The memory note comes after the answer, and the stream still finishes.
    const types = chunks.map((c) => c.type);
    expect(types.indexOf("data-memory")).toBeGreaterThan(types.lastIndexOf("text-delta"));
    expect(types.at(-1)).toBe("finish");

    // A brand-new chat: the model is told what's remembered.
    script.push(text("With your KCET rank of 12,000 from earlier, CSE is a stretch."));
    await chat([{ role: "user", text: "What about CSE?" }], { id: "chat-memory-2" });
    expect(prompts.at(-1)).toContain("WHAT YOU REMEMBER ABOUT THIS USER");
    expect(prompts.at(-1)).toContain("Entrance exam result: KCET rank 12,000 (from eligibility check)");
  });

  it("saves each conversation for the history list", async () => {
    const chats = await import("../src/lib/chats");
    const saved = chats.getChat("test-session", "chat-memory-1")!;
    expect(saved.title).toBe("Can I get AIML with KCET rank 12000 and 85% PCM?");
    expect(saved.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(saved.messages[1].parts.some((p) => p.type === "tool-checkEligibility")).toBe(true);
    expect(chats.listChats("test-session").map((c) => c.id)).toEqual(expect.arrayContaining(["chat-memory-1", "chat-memory-2"]));
  });

  it("saves the remember tool's notes, and does nothing when memory is off", async () => {
    const memory = await import("../src/lib/memory");
    script.push(toolCall("remember", { label: "Home area", value: "Whitefield" }), text("Noted."));
    const chunks = await chat([{ role: "user", text: "I live in Whitefield, by the way." }]);
    expect(chunks.find((c) => c.type === "data-memory")?.data).toEqual({ saved: [{ label: "Home area", value: "Whitefield" }] });

    memory.setMemoryEnabled("test-session", false);
    try {
      script.push(toolCall("checkEligibility", { program: "ECE", exam: "KCET", rank: 30000 }), text("ok"));
      const off = await chat([{ role: "user", text: "And ECE with rank 30000?" }]);
      expect(off.some((c) => c.type === "data-memory")).toBe(false);
      expect(prompts.at(-1)).not.toContain("WHAT YOU REMEMBER");
      expect(prompts.at(-1)).not.toContain("MEMORY TOOL");
      expect(memory.listMemory("test-session").find((f) => f.key === "result")?.value).toBe("KCET rank 12,000");
    } finally {
      memory.setMemoryEnabled("test-session", true);
    }
  });

  it("rejects requests without a user message", async () => {
    const res = await POST(new Request("http://test/api/chat", { method: "POST", body: JSON.stringify({ messages: [] }) }));
    expect(res.status).toBe(400);
  });
});
