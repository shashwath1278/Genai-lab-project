"use client";

import { CheckCircle2, CircleHelp, GraduationCap, MinusCircle, Pin, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import type { CheckStatus, EligibilityResult, Verdict } from "@/lib/calculators";
import { formatINR } from "@/lib/format";
import { usePlan } from "../plan/PlanContext";
import { CardFrame, cx, IconButton, Pill } from "../ui";

const VERDICT: Record<Verdict, { label: string; tone: "good" | "warning" | "critical" | "neutral"; icon: LucideIcon }> = {
  likely: { label: "Good chance", tone: "good", icon: CheckCircle2 },
  borderline: { label: "Borderline", tone: "warning", icon: TriangleAlert },
  unlikely: { label: "Unlikely", tone: "critical", icon: XCircle },
  "not-eligible": { label: "Not eligible", tone: "critical", icon: XCircle },
  "needs-info": { label: "Need details", tone: "neutral", icon: CircleHelp },
};

const CHECK: Record<CheckStatus, { icon: LucideIcon; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-good-text", label: "Meets" },
  warn: { icon: TriangleAlert, className: "text-warning-text", label: "Close" },
  fail: { icon: XCircle, className: "text-critical-text", label: "Doesn't meet" },
  unknown: { icon: MinusCircle, className: "text-muted", label: "To confirm" },
};

export function EligibilityCard({ result }: { result: EligibilityResult }) {
  const { add } = usePlan();
  const v = VERDICT[result.verdict];

  const pin = () =>
    add([
      {
        kind: "note",
        title: `${result.program.code} via ${result.exam}: ${v.label.toLowerCase()}`,
        detail: result.checks.map((c) => `${c.label}: ${c.detail}`).join("\n"),
      },
    ]);

  return (
    <CardFrame
      icon={GraduationCap}
      title={`${result.program.code} via ${result.exam}`}
      actions={
        <>
          <Pill tone={v.tone}>
            <v.icon size={12} aria-hidden />
            {v.label}
          </Pill>
          <IconButton label="Pin to plan" icon={Pin} onClick={pin} />
        </>
      }
    >
      <ul className="space-y-1.5">
        {result.checks.map((c) => {
          const s = CHECK[c.status];
          return (
            <li key={c.label} className="flex items-center gap-2.5 text-[13.5px]">
              <s.icon size={16} className={cx("shrink-0", s.className)} aria-label={s.label} />
              <span className="text-ink-2">{c.label}</span>
              <span className="ml-auto tabular-nums text-ink">{c.detail}</span>
            </li>
          );
        })}
        {result.feePerYear != null && (
          <li className="flex items-center gap-2.5 text-[13.5px]">
            <span className="size-4 shrink-0" aria-hidden />
            <span className="text-ink-2">Tuition</span>
            <span className="ml-auto tabular-nums text-ink">{formatINR(result.feePerYear)}/yr</span>
          </li>
        )}
      </ul>

      {result.alternatives.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          <span className="text-[12px] text-muted">Also possible</span>
          {result.alternatives.map((a) => (
            <span key={a.code} title={`${a.name}, ${a.cutoff}`}>
              <Pill>{a.code}</Pill>
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-muted">{result.note}</p>
    </CardFrame>
  );
}
