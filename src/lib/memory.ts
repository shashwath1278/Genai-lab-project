import { findProgram, normalizeExam } from "./calculators";
import type { CollegeData } from "./college-data";
import { type DB, getDb } from "./db";
import { formatNumber } from "./format";
import type { ReadingFile } from "./reading";

// What the assistant remembers about a browser session, kept in the local
// SQLite file. Most facts come for free from the inputs of tools the model
// already calls (an eligibility check knows the programme, exam and rank), so
// remembering costs no extra model calls; the model can also save a lasting
// fact the user mentions with the `remember` tool. Users see every fact, can
// delete any of them, or turn memory off.

export type MemoryFact = { id: number; key: string; label: string; value: string; source: string; updatedAt: string };
export type NewFact = { key: string; label: string; value: string; source: string };
export type MemoryUpdate = { saved: { label: string; value: string }[] };

/** Free-form notes are capped; the structured keys are a fixed, small set. */
const MAX_NOTES = 12;

type ToolCall = { toolName: string; input: unknown };

function programFact(data: CollegeData, code: unknown, source: string): NewFact | null {
  if (typeof code !== "string" || !code.trim()) return null;
  try {
    const p = findProgram(data, code);
    return { key: "program", label: "Programme you're considering", value: `${p.code} (${p.name})`, source };
  } catch {
    return null;
  }
}

/** Facts implied by the tools the model called for this user. */
export function factsFromTools(calls: ToolCall[], data: CollegeData): NewFact[] {
  const out: NewFact[] = [];
  for (const call of calls) {
    const input = (call.input ?? {}) as Record<string, unknown>;
    if (call.toolName === "checkEligibility") {
      const source = "eligibility check";
      const p = programFact(data, input.program, source);
      if (p) out.push(p);
      const exam = typeof input.exam === "string" ? normalizeExam(input.exam) : null;
      const result =
        typeof input.rank === "number" ? `rank ${formatNumber(input.rank)}` : typeof input.percentile === "number" ? `${input.percentile} percentile` : typeof input.score === "number" ? `score ${input.score}` : null;
      if (exam && result) out.push({ key: "result", label: "Entrance exam result", value: `${exam} ${result}`, source });
      if (typeof input.aggregatePercent === "number") {
        const ug = (() => {
          try {
            return findProgram(data, String(input.program)).level === "UG";
          } catch {
            return true;
          }
        })();
        out.push({ key: "aggregate", label: ug ? "12th PCM aggregate" : "Degree aggregate", value: `${input.aggregatePercent}%`, source });
      }
      // General merit is the tool's default, so only a stated reserved category is worth keeping.
      if (input.category === "OBC" || input.category === "SC/ST") out.push({ key: "category", label: "Category", value: String(input.category), source });
    }
    if (call.toolName === "estimateCost") {
      const source = "cost estimate";
      const p = programFact(data, input.program, source);
      if (p) out.push(p);
      if (typeof input.exam === "string") out.push({ key: "route", label: "Admission route", value: normalizeExam(input.exam), source });
      const pick = <T extends { code: string; name: string }>(list: T[], code: unknown) => (typeof code === "string" ? list.find((x) => x.code === code) : undefined);
      if (input.hostel === "none") out.push({ key: "hostel", label: "Hostel", value: "Day scholar (no hostel)", source });
      const hostel = pick(data.hostelOptions, input.hostel);
      if (hostel) out.push({ key: "hostel", label: "Hostel", value: hostel.name, source });
      const mess = pick(data.messPlans, input.mess);
      if (mess) out.push({ key: "mess", label: "Mess plan", value: mess.name, source });
      const zone = pick(data.transportZones, input.transport);
      if (zone) out.push({ key: "transport", label: "College bus", value: zone.name, source });
      const sch = pick(data.scholarships, input.scholarship);
      if (sch) out.push({ key: "scholarship", label: "Scholarship of interest", value: sch.name, source });
    }
    if (call.toolName === "comparePrograms" && Array.isArray(input.programs)) {
      const codes = input.programs.flatMap((c) => {
        try {
          return [findProgram(data, String(c)).code];
        } catch {
          return [];
        }
      });
      if (codes.length >= 2) out.push({ key: "shortlist", label: "Programmes you compared", value: codes.join(", "), source: "comparison" });
    }
  }
  // Later calls in the same answer win.
  return [...new Map(out.map((f) => [f.key, f])).values()];
}

/** Facts from attached documents: the computed PCM aggregate, a rank card's result. */
export function factsFromReadings(files: ReadingFile[]): NewFact[] {
  const out: NewFact[] = [];
  for (const f of files) {
    if (f.pcmPercent != null) out.push({ key: "aggregate", label: "12th PCM aggregate", value: `${f.pcmPercent}%`, source: "your marks card" });
    const exam = f.reading?.kind === "rank_card" ? f.reading.exam : null;
    if (exam?.name && (exam.rank != null || exam.percentile != null)) {
      const result = exam.rank != null ? `rank ${formatNumber(exam.rank)}` : `${exam.percentile} percentile`;
      out.push({ key: "result", label: "Entrance exam result", value: `${normalizeExam(exam.name)} ${result}`, source: "your rank card" });
    }
  }
  return out;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** A fact the user stated, saved through the `remember` tool. */
export function noteFact(label: string, value: string): NewFact | null {
  const l = label.trim().slice(0, 48);
  const v = value.trim().slice(0, 160);
  if (!l || !v || !slug(l)) return null;
  return { key: `note:${slug(l)}`, label: l.charAt(0).toUpperCase() + l.slice(1), value: v, source: "you told me" };
}

// ------------------------------------------------------------------ storage

type Row = { id: number; key: string; label: string; value: string; source: string; updated_at: string };

export function listMemory(sessionId: string, db: DB = getDb()): MemoryFact[] {
  return (db.prepare("SELECT id, key, label, value, source, updated_at FROM memories WHERE session_id = ? ORDER BY updated_at DESC, id DESC").all(sessionId) as Row[]).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    value: r.value,
    source: r.source,
    updatedAt: r.updated_at,
  }));
}

/** Saves facts (newest value wins) and returns the ones that are new or changed. */
export function saveFacts(sessionId: string, facts: NewFact[], db: DB = getDb()): NewFact[] {
  const changed: NewFact[] = [];
  db.transaction(() => {
    const current = db.prepare("SELECT value FROM memories WHERE session_id = ? AND key = ?");
    const notes = db.prepare("SELECT COUNT(*) AS n FROM memories WHERE session_id = ? AND key LIKE 'note:%'");
    const upsert = db.prepare(`INSERT INTO memories (session_id, key, label, value, source) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (session_id, key) DO UPDATE SET label = excluded.label, value = excluded.value, source = excluded.source, updated_at = datetime('now')`);
    for (const f of facts) {
      const existing = current.get(sessionId, f.key) as { value: string } | undefined;
      if (existing?.value === f.value) continue;
      if (!existing && f.key.startsWith("note:") && (notes.get(sessionId) as { n: number }).n >= MAX_NOTES) continue;
      upsert.run(sessionId, f.key, f.label, f.value, f.source);
      changed.push(f);
    }
  })();
  return changed;
}

export function deleteFact(sessionId: string, id: number, db: DB = getDb()) {
  db.prepare("DELETE FROM memories WHERE session_id = ? AND id = ?").run(sessionId, id);
}

export function clearMemory(sessionId: string, db: DB = getDb()) {
  db.prepare("DELETE FROM memories WHERE session_id = ?").run(sessionId);
}

export function memoryEnabled(sessionId: string, db: DB = getDb()): boolean {
  const row = db.prepare("SELECT enabled FROM memory_settings WHERE session_id = ?").get(sessionId) as { enabled: number } | undefined;
  return row ? row.enabled === 1 : true;
}

export function setMemoryEnabled(sessionId: string, enabled: boolean, db: DB = getDb()) {
  db.prepare("INSERT INTO memory_settings (session_id, enabled) VALUES (?, ?) ON CONFLICT (session_id) DO UPDATE SET enabled = excluded.enabled").run(sessionId, enabled ? 1 : 0);
}

/** The memory section of the instructions. */
export function describeMemory(facts: MemoryFact[]): string {
  return facts.map((f) => `- ${f.label}: ${f.value} (from ${f.source})`).join("\n");
}
