"use client";

import { Award, Columns3, Pin } from "lucide-react";
import type { ReactNode } from "react";
import type { CompareResult } from "@/lib/calculators";
import { formatINR } from "@/lib/format";
import { usePlan } from "../plan/PlanContext";
import { CardFrame, IconButton, Pill } from "../ui";

const BADGES = [
  ["placementRate", "Top placements"],
  ["medianPackage", "Top pay"],
  ["lowestFee", "Lowest fee"],
] as const;

export function CompareCard({ result }: { result: CompareResult }) {
  const { add } = usePlan();
  const programs = result.programs;
  const exams = [...new Set(programs.flatMap((p) => p.routes.map((r) => r.exam)))];

  const pin = () =>
    add([
      {
        kind: "note",
        title: `Compared ${programs.map((p) => p.code).join(" vs ")}`,
        detail: programs
          .map((p) => `${p.code}: placements ${p.placementRate ?? "?"}%, median ${p.medianPackageLpa ?? "?"} LPA, from ${formatINR(p.lowestFeePerYear)}/yr`)
          .join("\n"),
      },
    ]);

  const row = (label: string, cells: ReactNode[]) => (
    <tr key={label} className="border-t border-line align-top">
      <th scope="row" className="w-28 py-2 pr-3 text-left text-[12px] font-medium text-muted">
        {label}
      </th>
      {cells.map((c, i) => (
        <td key={programs[i].code} className="py-2 pr-3 text-[13px] text-ink">
          {c}
        </td>
      ))}
    </tr>
  );

  return (
    <CardFrame icon={Columns3} title={programs.map((p) => p.code).join(" vs ")} actions={<IconButton label="Pin to plan" icon={Pin} onClick={pin} />}>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin">
        <table className="w-full min-w-120 tabular-nums">
          <thead>
            <tr>
              <th className="w-28" />
              {programs.map((p) => (
                <th key={p.code} scope="col" className="pb-2 pr-3 text-left align-bottom" title={p.name}>
                  <span className="block text-[15px] font-semibold text-ink">{p.code}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {BADGES.filter(([key]) => result.best[key] === p.code).map(([key, label]) => (
                      <Pill key={key} tone="accent" className="text-[10.5px]!">
                        <Award size={11} aria-hidden />
                        {label}
                      </Pill>
                    ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row("Seats", programs.map((p) => p.intake))}
            {exams.map((exam) =>
              row(
                exam,
                programs.map((p) => {
                  const r = p.routes.find((x) => x.exam === exam);
                  return r ? (
                    <>
                      <span className="block">{formatINR(r.feePerYear)}/yr</span>
                      {exam !== "Management" && <span className="block text-[12px] text-muted">{r.cutoff}</span>}
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  );
                }),
              ),
            )}
            {row("Placed", programs.map((p) => (p.placementRate != null ? `${p.placementRate}%` : "—")))}
            {row("Median pay", programs.map((p) => (p.medianPackageLpa != null ? `${p.medianPackageLpa} LPA` : "—")))}
          </tbody>
        </table>
      </div>
    </CardFrame>
  );
}
