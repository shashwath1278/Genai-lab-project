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

vi.mock("../src/lib/session", () => ({ getSessionId: async () => "test-session" }));
vi.mock("../src/lib/llm", () => ({
  friendlyLlmError: (e: unknown) => String(e),
  getModels: () => ({
    info: { provider: "gemini", model: "mock", fastModel: "mock" },
    fast: new MockLanguageModelV4({
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
        return { stream: simulateReadableStream({ chunks: (script.shift() ?? text("(no script)")) as never[] }) };
      },
    }),
  }),
}));

const dbFile = path.join(os.tmpdir(), `northgate-test-${process.pid}.db`);
let POST: (req: Request) => Promise<Response>;
let db: import("better-sqlite3").Database;

async function chat(messages: { role: "user" | "assistant"; text: string }[], body: object = {}) {
  const res = await POST(
    new Request("http://test/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: messages.map((m, i) => ({ id: String(i), role: m.role, parts: [{ type: "text", text: m.text }] })),
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

  it("rejects requests without a user message", async () => {
    const res = await POST(new Request("http://test/api/chat", { method: "POST", body: JSON.stringify({ messages: [] }) }));
    expect(res.status).toBe(400);
  });
});
