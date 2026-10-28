"use client";

import { CalendarDays, CalendarPlus, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DatesResult } from "@/lib/calculators";
import { formatDateRange } from "@/lib/format";
import { usePlan } from "../plan/PlanContext";
import { Button, CardFrame, cx, IconButton } from "../ui";

function when(daysUntil: number, status: string): string {
  if (status === "ongoing") return "Now";
  if (status === "past") return "Done";
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 45) return `In ${daysUntil} days`;
  const months = Math.round(daysUntil / 30);
  return `In ~${months} month${months > 1 ? "s" : ""}`;
}

export function TimelineCard({ result }: { result: DatesResult }) {
  const { add, items } = usePlan();
  const [showAll, setShowAll] = useState(false);
  const onPlan = new Set(items.filter((i) => i.kind === "deadline").map((i) => i.title));
  const upcoming = result.items.filter((i) => i.status !== "past");
  const PREVIEW = 5;
  const visible = showAll ? result.items : result.items.slice(0, PREVIEW);

  const toPlanItem = (d: DatesResult["items"][number]) => ({
    kind: "deadline" as const,
    title: d.title,
    detail: [formatDateRange(d.start, d.end), d.note].filter(Boolean).join(". "),
    dueDate: d.start,
  });

  return (
    <CardFrame
      icon={CalendarDays}
      title="Key dates"
      actions={
        upcoming.length > 0 && (
          <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => add(upcoming.map(toPlanItem))}>
            Add all
          </Button>
        )
      }
    >
      {result.items.length === 0 ? (
        <p className="text-[13px] text-ink-2">No upcoming dates.</p>
      ) : (
        <ol className="relative ml-1.5 border-l border-line">
          {visible.map((d) => {
            const pinned = onPlan.has(d.title);
            return (
              <li key={d.title + d.start} className="relative pb-3 pl-5 last:pb-0">
                <span
                  aria-hidden
                  className={cx(
                    "absolute -left-1.25 top-1.5 size-2.5 rounded-full ring-2 ring-surface",
                    d.status === "past" ? "bg-line-strong" : d.status === "ongoing" ? "bg-good" : "bg-accent",
                  )}
                />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cx("text-[13.5px] font-medium", d.status === "past" ? "text-muted" : "text-ink")}>{d.title}</p>
                    <p className="text-[12.5px] text-ink-2">
                      {formatDateRange(d.start, d.end)}
                      <span className="mx-1.5 text-line-strong">·</span>
                      <span className={d.status === "ongoing" ? "font-medium text-good-text" : "text-muted"}>{when(d.daysUntil, d.status)}</span>
                    </p>
                  </div>
                  {d.status !== "past" &&
                    (pinned ? (
                      <span className="inline-flex size-8 items-center justify-center text-good-text" title="On your plan">
                        <Check size={16} aria-label="On your plan" />
                      </span>
                    ) : (
                      <IconButton label="Add to plan" icon={CalendarPlus} onClick={() => add([toPlanItem(d)])} />
                    ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {result.items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-text hover:underline"
          aria-expanded={showAll}
        >
          <ChevronDown size={14} className={cx("transition-transform", showAll && "rotate-180")} aria-hidden />
          {showAll ? "Less" : `${result.items.length - PREVIEW} more`}
        </button>
      )}
    </CardFrame>
  );
}
