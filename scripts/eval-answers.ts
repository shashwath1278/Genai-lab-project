import crypto from "node:crypto";
import Database from "better-sqlite3";
import { normalizeCitations } from "../src/lib/citations";
import { DB_PATH } from "../src/lib/db";

// Answer-quality evaluation against a running server (default: npm run dev).
// Each case checks what we can verify mechanically:
//   tool       the right calculator was called (or none was needed)
//   facts      the answer or tool output contains the expected facts
//   citations  every [n] in the answer points at a retrieved passage
//   grounding  every number in the answer appears in a passage, tool output or the question
//   script     the answer is written in the requested language's script
//   abstain    off-corpus questions are flagged instead of answered from outside knowledge
// The run uses its own session id and removes its rows from the database afterwards.
//
//   npm run eval:answers                       (server at http://localhost:3000)
//   BASE_URL=http://localhost:3100 npm run eval:answers

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION = crypto.randomUUID();
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 5000);

type Turn = { role: "user" | "assistant"; text: string };
type Case = {
  name: string;
  turns: Turn[];
  language?: string;
  tool?: string | null;
  facts?: RegExp[];
  script?: RegExp;
  abstain?: boolean;
};

const DEVANAGARI = /[ऀ-ॿ]{4,}/;
const KANNADA = /[ಀ-೿]{4,}/;

const CASES: Case[] = [
  { name: "fee lookup", turns: [{ role: "user", text: "What is the tuition fee for CSE under KCET?" }], facts: [/1,10,000|1\.1 lakh/] },
  { name: "cost total", turns: [{ role: "user", text: "What will CSE cost for 4 years via KCET with a triple hostel room?" }], tool: "estimateCost", facts: [/10,99,000|10\.99/] },
  { name: "eligibility", turns: [{ role: "user", text: "Am I eligible for AI & ML with 78% and a KCET rank of 12000?" }], tool: "checkEligibility", facts: [/likely/] },
  { name: "comparison", turns: [{ role: "user", text: "Compare CSE and ECE" }], tool: "comparePrograms" },
  { name: "dates", turns: [{ role: "user", text: "What are the upcoming important dates?" }], tool: "getImportantDates" },
  { name: "checklist", turns: [{ role: "user", text: "How do I apply for B.E. CSE through COMEDK and what documents do I need?" }], tool: "buildAdmissionChecklist" },
  { name: "library rule", turns: [{ role: "user", text: "How many books can an undergraduate borrow from the library?" }], facts: [/\b4\b|four/i] },
  { name: "attendance rule", turns: [{ role: "user", text: "What is the minimum attendance needed to write exams?" }], facts: [/85\s?%/] },
  { name: "refund policy", turns: [{ role: "user", text: "If I cancel admission a week after classes start, how much tuition is refunded?" }], facts: [/80\s?%/] },
  { name: "off-corpus: pool", turns: [{ role: "user", text: "Is there a swimming pool on campus?" }], abstain: true },
  { name: "off-corpus: MBBS", turns: [{ role: "user", text: "Does the college offer an MBBS programme?" }], abstain: true },
  { name: "off-corpus: trivia", turns: [{ role: "user", text: "Who won the cricket world cup in 2011?" }], abstain: true },
  { name: "Hindi", language: "hi", turns: [{ role: "user", text: "डबल शेयरिंग नॉन-एसी हॉस्टल कमरे की सालाना फीस कितनी है?" }], script: DEVANAGARI, facts: [/1,05,000|1\.05/] },
  { name: "Kannada", language: "kn", turns: [{ role: "user", text: "ಗ್ರಂಥಾಲಯ ಯಾವ ಸಮಯದಲ್ಲಿ ತೆರೆದಿರುತ್ತದೆ?" }], script: KANNADA, facts: [/8/, /10/] },
  { name: "Hinglish", turns: [{ role: "user", text: "library kitne baje tak khuli rehti hai weekdays mein?" }], facts: [/10/] },
  {
    name: "follow-up",
    turns: [
      { role: "user", text: "Tell me about the ECE programme." },
      { role: "assistant", text: "B.E. Electronics & Communication Engineering is a 4-year programme with an intake of 120 students." },
      { role: "user", text: "What was its KCET closing rank last year?" },
    ],
    facts: [/22,000|22000/],
  },
];

type Chunk = { type: string; data?: { passages: { n: number; text: string }[]; rewritten: string }; toolName?: string; output?: unknown; delta?: string; errorText?: string };

async function run(c: Case) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `ng_sid=${SESSION}` },
    body: JSON.stringify({
      persona: "prospective",
      language: c.language ?? "en",
      messages: c.turns.map((t, i) => ({ id: String(i), role: t.role, parts: [{ type: "text", text: t.text }] })),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const chunks = (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)) as Chunk);
  const error = chunks.find((x) => x.type === "error");
  if (error) throw new Error(error.errorText);

  const evidence = chunks.find((x) => x.type === "data-evidence")?.data;
  const tools = chunks.filter((x) => x.type === "tool-input-available").map((x) => x.toolName!);
  const outputs = chunks.filter((x) => x.type === "tool-output-available").map((x) => JSON.stringify(x.output));
  const answer = normalizeCitations(chunks.filter((x) => x.type === "text-delta").map((x) => x.delta).join(""));
  return { ms: Date.now() - started, evidence, tools, outputs, answer };
}

/** Numbers as written (1,10,000 / 9.2 / 85%), normalised to digits for comparison. */
function numbersIn(text: string): string[] {
  return [...text.replace(/\[\d{1,2}\]/g, "").matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, "")).filter((n) => n.length > 1 || Number(n) > 4);
}

/** Large rupee amounts are often restated in lakh: 1099000 -> 10.99 / 11.0. */
function lakhForms(text: string): string[] {
  return [...text.matchAll(/\d{6,}/g)].flatMap((m) => {
    const v = Number(m[0]) / 1e5;
    return [v.toFixed(2), v.toFixed(1), String(Number(v.toFixed(2)))];
  });
}

function check(c: Case, r: Awaited<ReturnType<typeof run>>) {
  const passages = r.evidence?.passages ?? [];
  const sourceText = [r.outputs.join(" "), passages.map((p) => p.text).join(" "), c.turns.map((t) => t.text).join(" ")].join(" ").replace(/,/g, "");
  const haystack = `${sourceText} ${lakhForms(sourceText).join(" ")}`;
  const flagged = r.tools.includes("flagKnowledgeGap");
  const cited = [...r.answer.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1]));
  const ungrounded = [...new Set(numbersIn(r.answer))].filter((n) => !haystack.includes(n));
  const results: Record<string, boolean | null> = {
    tool: c.tool === undefined ? null : c.tool === null ? r.tools.length === 0 : r.tools.includes(c.tool),
    facts: c.facts ? c.facts.every((re) => re.test(r.answer) || r.outputs.some((o) => re.test(o))) : null,
    citations: cited.length ? cited.every((n) => passages.some((p) => p.n === n)) : null,
    grounding: c.abstain ? null : ungrounded.length === 0,
    script: c.script ? c.script.test(r.answer) : null,
    abstain: c.abstain ? flagged && !/\bIndia\b/.test(r.answer) : flagged ? false : null,
  };
  return { results, ungrounded, cited: cited.length, flagged };
}

function cleanup() {
  const db = new Database(DB_PATH);
  const q = db.prepare("DELETE FROM queries WHERE session_id = ?").run(SESSION).changes;
  const g = db.prepare("DELETE FROM gap_clusters WHERE id NOT IN (SELECT gap_cluster_id FROM queries WHERE gap_cluster_id IS NOT NULL)").run().changes;
  db.close();
  console.log(`\ncleaned up ${q} eval queries and ${g} gap clusters from ${DB_PATH}`);
}

async function main() {
  const status = await (await fetch(`${BASE_URL}/api/status`)).json();
  console.log(`answer-quality eval: ${CASES.length} cases against ${BASE_URL} (${status.llm?.provider} · ${status.llm?.model})\n`);
  const cols = ["tool", "facts", "citations", "grounding", "script", "abstain"] as const;
  const tally = Object.fromEntries(cols.map((c) => [c, { pass: 0, total: 0 }]));
  let passedCases = 0;
  const latencies: number[] = [];

  for (const c of CASES) {
    try {
      const r = await run(c);
      latencies.push(r.ms);
      const { results, ungrounded, cited } = check(c, r);
      let ok = true;
      const cells = cols.map((col) => {
        const v = results[col];
        if (v === null) return " - ";
        tally[col].total++;
        if (v) tally[col].pass++;
        else ok = false;
        return v ? "ok " : "NO ";
      });
      if (ok) passedCases++;
      const note = [
        r.tools.length ? `tools: ${r.tools.join(",")}` : "",
        cited ? `${cited} cites` : "",
        ungrounded.length ? `ungrounded: ${ungrounded.join(" ")}` : "",
        r.evidence && r.evidence.rewritten !== c.turns.at(-1)!.text ? `searched: "${r.evidence.rewritten.slice(0, 60)}"` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(20)} ${cells.join(" ")}  ${(r.ms / 1000).toFixed(1)}s  ${note}`);
      if (!ok) console.log(`      answer: ${r.answer.replace(/\s+/g, " ").slice(0, 220)}`);
    } catch (e) {
      console.log(`ERROR ${c.name.padEnd(20)} ${(e as Error).message.slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  console.log(`\n${passedCases}/${CASES.length} cases passed`);
  for (const col of cols) {
    const t = tally[col];
    if (t.total) console.log(`  ${col.padEnd(10)} ${t.pass}/${t.total}`);
  }
  latencies.sort((a, b) => a - b);
  if (latencies.length) console.log(`  latency    median ${(latencies[Math.floor(latencies.length / 2)] / 1000).toFixed(1)}s, max ${(latencies.at(-1)! / 1000).toFixed(1)}s`);
  cleanup();
}

main().catch((err) => {
  console.error(err);
  try {
    cleanup();
  } catch {}
  process.exit(1);
});
