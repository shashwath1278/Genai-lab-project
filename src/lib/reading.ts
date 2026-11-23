import { z } from "zod";
import { findProgram, normalizeExam } from "./calculators";
import type { CollegeData, Program } from "./college-data";
import { formatINR } from "./format";

// What the assistant reads from a photo or PDF the user attaches, and the
// checks it runs on it in code: a PCM aggregate from a marks card, and a
// line-by-line audit of a fee receipt against the official fee tables.
// Shared by client (types) and server.

export const READING_KINDS = ["marksheet", "rank_card", "fee_receipt", "notice", "other"] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

const num = z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s₹%]|Rs\.?/gi, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().finite().nullable());
const str = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable());
const isoDate = z.preprocess((v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null), z.string().nullable());

/** Lenient on purpose: models drift on types, and a partial reading beats none. */
export const readingSchema = z.object({
  kind: z.preprocess((v) => (READING_KINDS.includes(v as ReadingKind) ? v : "other"), z.enum(READING_KINDS)),
  title: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : "Document"), z.string()),
  summary: z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, 400) : ""), z.string()),
  marks: z
    .object({
      subjects: z
        .array(z.object({ name: z.string(), obtained: num, max: num }))
        .catch([])
        .transform((s) => s.filter((x): x is { name: string; obtained: number; max: number } => x.obtained != null && x.max != null && x.max > 0).slice(0, 12)),
      aggregatePercent: num.catch(null),
    })
    .nullable()
    .catch(null),
  exam: z
    .object({ name: str.catch(null), rank: num.catch(null), percentile: num.catch(null), score: num.catch(null), category: str.catch(null) })
    .nullable()
    .catch(null),
  fees: z
    .object({
      lines: z
        .array(z.object({ label: z.string(), amount: num }))
        .catch([])
        .transform((l) => l.filter((x): x is { label: string; amount: number } => x.amount != null && !!x.label.trim()).slice(0, 20)),
      total: num.catch(null),
      program: str.catch(null),
      quota: str.catch(null),
    })
    .nullable()
    .catch(null),
  dates: z
    .array(z.object({ title: z.string(), date: isoDate, endDate: isoDate.catch(null) }))
    .catch([])
    .transform((d) => d.filter((x): x is { title: string; date: string; endDate: string | null } => !!x.date).slice(0, 12)),
  unclear: str.catch(null),
});
export type Reading = z.infer<typeof readingSchema>;

/** The first JSON object in a model reply (tolerates fences and stray prose). */
export function parseReading(text: string): Reading | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = readingSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Physics + Chemistry + Mathematics aggregate, when all three are on the card. */
export function pcmPercent(reading: Reading): number | null {
  const subjects = reading.marks?.subjects ?? [];
  const pick = (re: RegExp) => subjects.find((s) => re.test(s.name));
  const pcm = [pick(/physics/i), pick(/chemistry/i), pick(/math/i)];
  if (pcm.some((s) => !s)) return null;
  const got = pcm.reduce((n, s) => n + s!.obtained, 0);
  const max = pcm.reduce((n, s) => n + s!.max, 0);
  return max > 0 ? Math.round((got / max) * 10000) / 100 : null;
}

// --------------------------------------------------------------- fee audit

export type AuditStatus = "ok" | "higher" | "lower" | "unknown" | "info";
export type AuditLine = { label: string; amount: number; official: number | null; matched: string | null; status: AuditStatus; note: string };
export type FeeAudit = {
  lines: AuditLine[];
  linesTotal: number;
  printedTotal: number | null;
  totalMatches: boolean | null;
  program: string | null;
  verdict: "all-match" | "mismatch" | "unclear";
};

type Option = { amount: number; label: string };

function softProgram(data: CollegeData, text: string | null): Program | null {
  if (!text) return null;
  try {
    return findProgram(data, text);
  } catch {
    const words = text.toLowerCase();
    return data.programs.find((p) => words.includes(p.name.toLowerCase()) || new RegExp(`\\b${p.code.toLowerCase()}\\b`).test(words)) ?? null;
  }
}

/**
 * Checks each line of a fee receipt against the official tables: tuition by
 * programme and route, hostel rooms, mess plans, bus zones and the other fees.
 * Amounts that match any official option pass; others are flagged against the
 * closest official amount. Also checks that the lines add up to the total.
 */
export function auditFeeReceipt(data: CollegeData, fees: NonNullable<Reading["fees"]>): FeeAudit {
  const program = softProgram(data, fees.program);
  const route = program && fees.quota ? program.routes.find((r) => r.exam === normalizeExam(fees.quota!) || r.quota.toLowerCase() === fees.quota!.toLowerCase()) : undefined;
  const tuition: Option[] = program
    ? (route ? [route] : program.routes).map((r) => ({ amount: r.feePerYear, label: `${program.code} tuition via ${r.exam} (${r.quota} quota)` }))
    : [];
  const other = (code: string): Option[] => data.otherFees.filter((f) => f.code === code).map((f) => ({ amount: f.amount, label: f.name }));

  // Most specific first: "hostel caution deposit" must not match plain "caution deposit".
  const RULES: { test: RegExp; name: string; options: Option[] | "waiver" }[] = [
    { test: /scholarship|waiver|concession|discount|rebate/i, name: "Scholarship or concession", options: "waiver" },
    { test: /tuition|course fee|programme fee|program fee|academic fee/i, name: "Tuition", options: tuition },
    { test: /hostel.*(caution|deposit)|(caution|deposit).*hostel/i, name: "Hostel caution deposit", options: other("HOSTEL_CAUTION") },
    { test: /hostel.*(admission|registration)/i, name: "Hostel admission fee", options: other("HOSTEL_ADMISSION") },
    { test: /mess|food|dining/i, name: "Mess plan", options: data.messPlans.map((m) => ({ amount: m.feePerYear, label: m.name })) },
    { test: /hostel|room|accommodation/i, name: "Hostel room", options: data.hostelOptions.map((h) => ({ amount: h.feePerYear, label: h.name })) },
    { test: /bus|transport/i, name: "College bus", options: data.transportZones.map((z) => ({ amount: z.feePerYear, label: z.name })) },
    { test: /caution|deposit|refundable/i, name: "Caution deposit", options: other("CAUTION") },
    { test: /admission|registration|enrol/i, name: "Admission & registration fee", options: other("ADMISSION") },
    { test: /exam|lab|library|activity|annual|development|university|misc/i, name: "Exam, lab, library & activity fees", options: other("ANNUAL") },
  ];

  const lines: AuditLine[] = fees.lines.map(({ label, amount }) => {
    const rule = RULES.find((r) => r.test.test(label));
    if (!rule) return { label, amount, official: null, matched: null, status: "unknown", note: "Not a fee in Northgate's official fee tables." };
    if (rule.options === "waiver") {
      return { label, amount, official: null, matched: rule.name, status: "info", note: "Depends on your eligibility; the Scholarship Cell can confirm it." };
    }
    if (!rule.options.length) {
      return { label, amount, official: null, matched: rule.name, status: "unknown", note: "Tuition depends on the programme and admission route; the receipt doesn't say which." };
    }
    const exact = rule.options.find((o) => o.amount === amount);
    if (exact) return { label, amount, official: exact.amount, matched: exact.label, status: "ok", note: `Matches: ${exact.label}.` };
    const closest = rule.options.reduce((a, b) => (Math.abs(b.amount - amount) < Math.abs(a.amount - amount) ? b : a));
    const diff = amount - closest.amount;
    return {
      label,
      amount,
      official: closest.amount,
      matched: closest.label,
      status: diff > 0 ? "higher" : "lower",
      note: `${formatINR(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the official ${closest.label.charAt(0).toLowerCase() + closest.label.slice(1)} (${formatINR(closest.amount)}).`,
    };
  });

  const linesTotal = lines.reduce((n, l) => n + l.amount, 0);
  const totalMatches = fees.total == null ? null : Math.abs(fees.total - linesTotal) < 1;
  const mismatch = lines.some((l) => l.status === "higher" || l.status === "lower") || totalMatches === false;
  const unclear = lines.some((l) => l.status === "unknown") || !lines.length;
  return {
    lines,
    linesTotal,
    printedTotal: fees.total,
    totalMatches,
    program: program?.code ?? null,
    verdict: mismatch ? "mismatch" : unclear ? "unclear" : "all-match",
  };
}

// --------------------------------------------------------------- the part

export type ReadingFile = {
  name: string;
  mediaType: string;
  reading: Reading | null;
  pcmPercent: number | null;
  audit: FeeAudit | null;
  error: string | null;
};
export type ReadingData = { files: ReadingFile[] };

/** Adds the checks done in code to a raw reading. */
export function finishReading(data: CollegeData, name: string, mediaType: string, reading: Reading): ReadingFile {
  return {
    name,
    mediaType,
    reading,
    pcmPercent: pcmPercent(reading),
    audit: reading.kind === "fee_receipt" && reading.fees?.lines.length ? auditFeeReceipt(data, reading.fees) : null,
    error: null,
  };
}
