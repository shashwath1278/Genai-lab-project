"use client";

import { Pin, Wallet } from "lucide-react";
import { useState } from "react";
import type { CostEstimate } from "@/lib/calculators";
import { formatINR, formatLakh } from "@/lib/format";
import { usePlan } from "../plan/PlanContext";
import { CardFrame, cx, IconButton } from "../ui";

// Fixed component -> series slot mapping: a component keeps its color even when
// another component is zero and drops out of the bar.
const COMPONENTS = [
  { key: "tuitionNet", label: "Tuition", color: "var(--series-1)" },
  { key: "hostel", label: "Hostel", color: "var(--series-2)" },
  { key: "mess", label: "Mess", color: "var(--series-3)" },
  { key: "annualFees", label: "Annual fees", color: "var(--series-4)" },
  { key: "transport", label: "College bus", color: "var(--series-5)" },
  { key: "oneTime", label: "One-time fees", color: "var(--series-6)" },
] as const;

export function CostCard({ estimate }: { estimate: CostEstimate }) {
  const { add } = usePlan();
  const [hover, setHover] = useState<number | null>(null);
  const t = estimate.totals;
  const n = estimate.years.length;
  const values: Record<(typeof COMPONENTS)[number]["key"], number> = {
    tuitionNet: t.tuition + t.scholarship,
    hostel: t.hostel,
    mess: t.mess,
    annualFees: t.annualFees,
    transport: t.transport,
    oneTime: t.oneTime,
  };
  const segments = COMPONENTS.map((c) => ({ ...c, value: values[c.key] })).filter((s) => s.value > 0);
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const placed = segments.map((s, i) => ({
    ...s,
    start: segments.slice(0, i).reduce((sum, x) => sum + x.value, 0) / total,
    share: s.value / total,
  }));

  const choices = [estimate.choices.hostel, estimate.choices.mess, estimate.choices.transport, estimate.choices.scholarship].filter(Boolean);
  const year = estimate.years[0];

  const pin = () =>
    add([
      {
        kind: "note",
        title: `${estimate.program.code} (${estimate.route.exam}) total: ${formatLakh(t.grand)} for ${n} year${n > 1 ? "s" : ""}`,
        detail: [`Per year: ${formatINR(year.total)}`, ...choices, ...estimate.assumptions].join("\n"),
      },
    ]);

  const rows: [string, number, number][] = [
    ["Tuition", year.tuition, t.tuition],
    ...(t.scholarship ? ([["Scholarship waiver", year.scholarship, t.scholarship]] as [string, number, number][]) : []),
    ["Exam, lab & activity fees", year.annualFees, t.annualFees],
    ...(t.hostel ? ([["Hostel room", year.hostel, t.hostel]] as [string, number, number][]) : []),
    ...(t.mess ? ([["Mess", year.mess, t.mess]] as [string, number, number][]) : []),
    ...(t.transport ? ([["College bus", year.transport, t.transport]] as [string, number, number][]) : []),
  ];

  return (
    <CardFrame
      icon={Wallet}
      title={`${estimate.program.code} via ${estimate.route.exam}`}
      actions={<IconButton label="Pin to plan" icon={Pin} onClick={pin} />}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[32px] font-semibold leading-tight tracking-tight text-ink">
          {formatLakh(t.grand)}
          <span className="ml-2 text-[13px] font-normal text-muted">
            {n} year{n > 1 ? "s" : ""}
          </span>
        </p>
        <p className="text-[13px] text-ink-2">
          {formatINR(year.total)}/yr + {formatINR(t.oneTime)} once
        </p>
      </div>

      {/* Composition bar: one stacked bar, 2px surface gaps, rounded ends. */}
      <div className="relative mt-4" onMouseLeave={() => setHover(null)}>
        <div className="flex h-3.5 w-full gap-0.5" role="img" aria-label={placed.map((s) => `${s.label} ${formatINR(s.value)}`).join(", ")}>
          {placed.map((s, i) => (
            <div
              key={s.key}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              className={cx(
                "h-full cursor-default transition-opacity first:rounded-l-sm last:rounded-r-sm",
                hover != null && hover !== i && "opacity-40",
              )}
              style={{ width: `${s.share * 100}%`, background: s.color, minWidth: 3 }}
            />
          ))}
        </div>
        {hover != null && placed[hover] && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-card"
            style={{ left: `${Math.min(88, Math.max(12, (placed[hover].start + placed[hover].share / 2) * 100))}%` }}
          >
            <span className="font-medium text-ink">{placed[hover].label}</span>
            <span className="text-ink-2">
              {" "}
              · {formatINR(placed[hover].value)} · {Math.round(placed[hover].share * 100)}%
            </span>
          </div>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {placed.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-[12.5px]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="text-ink-2">{s.label}</span>
            <span className="ml-auto tabular-nums text-ink">{formatLakh(s.value)}</span>
          </li>
        ))}
      </ul>

      <details className="group mt-4 rounded-lg border border-line">
        <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink">Breakdown</summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-1.5 font-medium">Component</th>
                <th className="py-1.5 text-right font-medium">Per year</th>
                <th className="py-1.5 text-right font-medium">{n} years</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, perYear, all]) => (
                <tr key={label} className="border-t border-line">
                  <td className="py-1.5 text-ink-2">{label}</td>
                  <td className={cx("py-1.5 text-right", perYear < 0 ? "text-good-text" : "text-ink")}>{formatINR(perYear)}</td>
                  <td className={cx("py-1.5 text-right", all < 0 ? "text-good-text" : "text-ink")}>{formatINR(all)}</td>
                </tr>
              ))}
              {estimate.oneTime.map((f) => (
                <tr key={f.name} className="border-t border-line">
                  <td className="py-1.5 text-ink-2">
                    {f.name} <span className="text-muted">(once)</span>
                  </td>
                  <td className="py-1.5 text-right text-muted">—</td>
                  <td className="py-1.5 text-right text-ink">{formatINR(f.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-line-strong font-semibold">
                <td className="py-1.5 text-ink">Total</td>
                <td className="py-1.5 text-right text-ink">{formatINR(year.total)}</td>
                <td className="py-1.5 text-right text-ink">{formatINR(t.grand)}</td>
              </tr>
            </tbody>
          </table>
          {estimate.assumptions.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[11.5px] text-muted">
              {estimate.assumptions.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </CardFrame>
  );
}
