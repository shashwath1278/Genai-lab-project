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

  it("searches official sites only when a key is set, and doesn't file web-answered questions as gaps", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) =>
      String(url).includes("api.tavily.com")
        ? new Response(JSON.stringify({ results: [
            { title: "KCET 2027 brochure", url: "https://cetonline.karnataka.gov.in/kea/kcet2027", content: "The exam is on 18 and 19 April 2027.", published_date: "2026-11-01" },
            { title: "KCET tips", url: "https://blog.example.com/kcet", content: "unofficial" },
          ] }))
        : realFetch(url, init),
    );
    try {
      script.push(toolCall("searchOfficialWeb", { query: "KCET 2027 exam date" }), text("KCET 2027 is on 18-19 April [W1]."));
      const chunks = await chat([{ role: "user", text: "When is the KCET 2027 exam?" }]);
      const out = chunks.find((c) => c.type === "tool-output-available")?.output as { results: { id: string; domain: string }[] };
      expect(out.results).toEqual([expect.objectContaining({ id: "W1", domain: "cetonline.karnataka.gov.in" })]);
      const toModel = prompts.at(-1)!;
      expect(toModel).toContain("searchOfficialWeb looks things up on official government");
      expect(toModel).toContain("not Northgate's handbook");
      const evidence = chunks.find((c) => c.type === "data-evidence")!.data as { queryId: number };
      const q = db.prepare("SELECT gap_cluster_id FROM queries WHERE id = ?").get(evidence.queryId) as { gap_cluster_id: number | null };
      expect(q.gap_cluster_id).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TAVILY_API_KEY;
    }
  });

  it("rejects requests without a user message", async () => {
    const res = await POST(new Request("http://test/api/chat", { method: "POST", body: JSON.stringify({ messages: [] }) }));
    expect(res.status).toBe(400);
  });
});
