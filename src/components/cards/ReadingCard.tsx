"use client";

import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle,
  Exam,
  FileText,
  Info,
  Megaphone,
  Receipt,
  Trophy,
  Warning,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import programsJson from "../../../data/structured/programs.json";
import { formatDateRange, formatINR } from "@/lib/format";
import type { AuditLine, FeeAudit, ReadingData, ReadingFile, ReadingKind } from "@/lib/reading";
import { usePlan } from "../plan/PlanContext";
import { Button, CardFrame, cx, IconButton } from "../ui";

type ProgramLite = { code: string; name: string; level: "UG" | "PG"; degree: string; routes: { exam: string; cutoffType: string }[] };
const PROGRAMS = (programsJson as { programs: ProgramLite[] }).programs;

const KIND: Record<ReadingKind, { icon: Icon; label: string }> = {
  marksheet: { icon: Exam, label: "Marks card" },
  rank_card: { icon: Trophy, label: "Rank card" },
  fee_receipt: { icon: Receipt, label: "Fee receipt" },
  notice: { icon: Megaphone, label: "Notice" },
  other: { icon: FileText, label: "Document" },
};

/** Everything read from the user's attachments, one card per file. */
export function ReadingCards({ data, onAsk }: { data: ReadingData; onAsk: (text: string) => void }) {
  return (
    <>
      {data.files.map((f, i) => (
        <ReadingCard key={`${f.name}-${i}`} file={f} onAsk={onAsk} />
      ))}
    </>
  );
}

function ReadingCard({ file, onAsk }: { file: ReadingFile; onAsk: (text: string) => void }) {
  const r = file.reading;
  if (!r) {
    return (
      <CardFrame icon={WarningCircle} eyebrow={`Couldn't read · ${file.name}`} title="This file couldn't be read">
        <p className="text-[13.5px] text-ink-2">{file.error}</p>
      </CardFrame>
    );
  }
  const kind = KIND[r.kind];
  const hasMarks = (r.kind === "marksheet" || r.kind === "rank_card") && (file.pcmPercent != null || r.marks?.aggregatePercent != null || r.exam);
  return (
    <CardFrame
      icon={kind.icon}
      eyebrow={`What I read · ${file.name}`}
      title={r.title}
      actions={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink-2">{kind.label}</span>}
    >
      {r.summary && <p className="text-[13.5px] text-ink-2">{r.summary}</p>}

      {r.marks && r.marks.subjects.length > 0 && <Subjects file={file} />}
      {hasMarks && <EligibilityCheck file={file} onAsk={onAsk} />}
      {file.audit && <ReceiptCheck audit={file.audit} />}
      {/* A receipt's payment date isn't a deadline: only notices offer dates for the plan. */}
      {(r.kind === "notice" || r.kind === "other") && r.dates.length > 0 && <Dates dates={r.dates} />}

      {r.unclear && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-warning-text">
          <Warning size={14} className="mt-px shrink-0" aria-hidden />
          Couldn&apos;t read clearly: {r.unclear}
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-2.5 text-[11.5px] leading-snug text-muted">
        <Info size={13} className="mt-px shrink-0" aria-hidden />
        Read by machine, so check the values. Your file isn&apos;t stored, and personal details aren&apos;t read.
      </p>
    </CardFrame>
  );
}

function Subjects({ file }: { file: ReadingFile }) {
  const subjects = file.reading!.marks!.subjects;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {subjects.map((s) => (
        <span key={s.name} className={cx("rounded-lg border px-2 py-1 text-[12px] tabular-nums", /physics|chemistry|math/i.test(s.name) ? "border-accent/40 bg-accent-soft text-ink" : "border-line text-ink-2")}>
          {s.name} <span className="font-medium text-ink">{s.obtained}</span>/{s.max}
        </span>
      ))}
    </div>
  );
}

const EXAM_NAMES: Record<string, string> = { kcet: "KCET", cet: "KCET", comedk: "COMEDK", jee: "JEE Main", "jee main": "JEE Main", pgcet: "PGCET", cat: "CAT", mat: "MAT", gate: "GATE" };

/** Marks and exam result, editable, then one tap to ask for the eligibility check. */
function EligibilityCheck({ file, onAsk }: { file: ReadingFile; onAsk: (text: string) => void }) {
  const id = useId();
  const r = file.reading!;
  const examName = EXAM_NAMES[(r.exam?.name ?? "").toLowerCase().replace(/\s*(uget|exam|20\d\d).*$/, "").trim()] ?? "KCET";
  const [program, setProgram] = useState(PROGRAMS.find((p) => p.routes.some((x) => x.exam === examName))?.code ?? "CSE");
  const prog = PROGRAMS.find((p) => p.code === program)!;
  const exams = prog.routes.filter((x) => x.cutoffType !== "none");
  const [exam, setExam] = useState(examName);
  const route = exams.find((x) => x.exam === exam) ?? exams[0];
  const metric = route?.cutoffType === "percentile" ? "percentile" : route?.cutoffType === "score" ? "score" : "rank";
  const [percent, setPercent] = useState(String(file.pcmPercent ?? r.marks?.aggregatePercent ?? ""));
  const [result, setResult] = useState(String(r.exam?.rank ?? r.exam?.percentile ?? r.exam?.score ?? ""));
  const [category, setCategory] = useState(/obc/i.test(r.exam?.category ?? "") ? "OBC" : /sc|st/i.test(r.exam?.category ?? "") ? "SC/ST" : "GM");
  const ug = prog.level === "UG";

  const control = "rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink outline-none focus:border-accent";
  const field = `${control} h-9 w-full`;
  const ask = () => {
    const marks = percent ? ` with ${percent}% ${ug ? "in PCM" : "aggregate"}` : "";
    const res = result ? `${marks ? " and" : " with"} a ${route.exam} ${metric} of ${result}` : "";
    onAsk(`Am I eligible for ${prog.degree} ${prog.name} (${prog.code})${marks}${res}${category !== "GM" ? `, ${category} category` : ""}?`);
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <p className="text-[12px] font-medium text-ink-2">Check these, then see if you&apos;re eligible</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 text-[11.5px] text-muted sm:col-span-1" htmlFor={`${id}-p`}>
          Programme
          <select id={`${id}-p`} value={program} onChange={(e) => setProgram(e.target.value)} className={cx(field, "mt-1")}>
            {PROGRAMS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] text-muted" htmlFor={`${id}-m`}>
          {ug ? "PCM %" : "Aggregate %"}
          {ug && file.pcmPercent != null && <span className="ml-1 text-[10.5px]">(from P, C, M)</span>}
          <input id={`${id}-m`} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} className={cx(field, "mt-1 tabular-nums")} />
        </label>
        <label className="text-[11.5px] text-muted" htmlFor={`${id}-e`}>
          Exam
          <select id={`${id}-e`} value={route?.exam} onChange={(e) => setExam(e.target.value)} className={cx(field, "mt-1")}>
            {exams.map((x) => (
              <option key={x.exam}>{x.exam}</option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] capitalize text-muted" htmlFor={`${id}-r`}>
          {metric}
          <input id={`${id}-r`} inputMode="decimal" value={result} onChange={(e) => setResult(e.target.value.replace(/[^\d.]/g, ""))} className={cx(field, "mt-1 tabular-nums")} />
        </label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`${id}-c`}>
          Category
        </label>
        <select id={`${id}-c`} value={category} onChange={(e) => setCategory(e.target.value)} className={cx(control, "h-8")}>
          <option value="GM">General merit</option>
          <option value="OBC">OBC</option>
          <option value="SC/ST">SC/ST</option>
        </select>
        <Button size="sm" variant="primary" icon={ArrowRight} onClick={ask} disabled={!percent && !result}>
          Check my eligibility
        </Button>
      </div>
    </div>
  );
}

const STATUS: Record<AuditLine["status"], { label: (l: AuditLine) => string; tone: string }> = {
  ok: { label: () => "Matches", tone: "text-good-text" },
  higher: { label: (l) => `${formatINR(l.amount - (l.official ?? 0))} more`, tone: "text-critical-text" },
  lower: { label: (l) => `${formatINR((l.official ?? 0) - l.amount)} less`, tone: "text-warning-text" },
  unknown: { label: () => "Can't check", tone: "text-muted" },
  info: { label: () => "Depends on you", tone: "text-accent-text" },
};

/** Each receipt line against the official fee tables, and the arithmetic. */
function ReceiptCheck({ audit }: { audit: FeeAudit }) {
  const off = audit.lines.filter((l) => l.status === "higher" || l.status === "lower").length + (audit.totalMatches === false ? 1 : 0);
  const banner =
    audit.verdict === "all-match"
      ? { icon: CheckCircle, text: "Every line matches Northgate's official fees.", cls: "bg-leaf-soft text-ink" }
      : audit.verdict === "mismatch"
        ? { icon: WarningCircle, text: `${off} ${off === 1 ? "thing doesn't" : "things don't"} match the official fees. Ask the Accounts Section (Admin Block, A-110) before paying more.`, cls: "bg-laterite-soft text-ink" }
        : { icon: Info, text: "Some lines couldn't be checked against the official fees.", cls: "bg-surface-2 text-ink-2" };
  return (
    <div className="mt-3">
      <p className={cx("flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]", banner.cls)}>
        <banner.icon size={16} weight="fill" className={cx("mt-px shrink-0", audit.verdict === "mismatch" ? "text-critical-text" : audit.verdict === "all-match" ? "text-good-text" : "text-muted")} aria-hidden />
        {banner.text}
      </p>
      {/* A list rather than a table, so it reads the same on a phone. */}
      <ul className="mt-2 divide-y divide-line text-[13px] tabular-nums" aria-label="Receipt lines against the official fees">
        {audit.lines.map((l, i) => (
          <li key={`${l.label}-${i}`} className="py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="text-ink">{l.label}</span>
              <span className={cx("whitespace-nowrap text-[12px] font-medium", STATUS[l.status].tone)}>{STATUS[l.status].label(l)}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Charged <span className="font-medium text-ink-2">{formatINR(l.amount)}</span>
              {l.official != null && l.status !== "ok" && <> · official {formatINR(l.official)}</>}
              {(l.status === "unknown" || l.status === "info") && <> · {l.note}</>}
            </p>
          </li>
        ))}
        <li className="flex items-start justify-between gap-3 border-t-2 border-line-strong py-2">
          <span className="text-ink">
            Lines add up to <span className="font-medium">{formatINR(audit.linesTotal)}</span>
            {audit.printedTotal != null && <span className="text-muted"> · receipt says {formatINR(audit.printedTotal)}</span>}
          </span>
          <span className={cx("whitespace-nowrap text-[12px] font-medium", audit.totalMatches === false ? "text-critical-text" : audit.totalMatches ? "text-good-text" : "text-muted")}>
            {audit.totalMatches === false ? "Total is wrong" : audit.totalMatches ? "Adds up" : "No total"}
          </span>
        </li>
      </ul>
    </div>
  );
}

function Dates({ dates }: { dates: { title: string; date: string; endDate: string | null }[] }) {
  const { add, items } = usePlan();
  const onPlan = new Set(items.filter((i) => i.kind === "deadline").map((i) => i.title));
  const toItem = (d: (typeof dates)[number]) => ({ kind: "deadline" as const, title: d.title, detail: `From an attached notice: ${formatDateRange(d.date, d.endDate)}`, dueDate: d.date });
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-ink-2">Dates in it</p>
        {dates.length > 1 && (
          <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => add(dates.map(toItem))}>
            Add all to plan
          </Button>
        )}
      </div>
      <ul className="mt-1 divide-y divide-line">
        {dates.map((d) => (
          <li key={d.title + d.date} className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-ink">{d.title}</p>
              <p className="text-[12px] text-muted">{formatDateRange(d.date, d.endDate)}</p>
            </div>
            {onPlan.has(d.title) ? (
              <span className="inline-flex size-8 items-center justify-center text-good-text" title="On your plan">
                <Check size={16} aria-label="On your plan" />
              </span>
            ) : (
              <IconButton label="Add to plan" icon={CalendarPlus} onClick={() => add([toItem(d)])} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
