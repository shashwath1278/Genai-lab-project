"use client";

import { CalendarPlus, ClipboardList, Download, StickyNote, Trash2 } from "lucide-react";
import type { PlanItem } from "@/lib/plan";
import { daysBetween, formatDate, todayIso } from "@/lib/format";
import { cx, IconButton } from "../ui";
import { usePlan } from "./PlanContext";

function countdown(due: string, today: string): { text: string; urgent: boolean } {
  const d = daysBetween(today, due);
  if (d < 0) return { text: "past", urgent: false };
  if (d === 0) return { text: "today", urgent: true };
  if (d === 1) return { text: "tomorrow", urgent: true };
  return { text: `in ${d}d`, urgent: d <= 7 };
}

function Row({ item, today }: { item: PlanItem; today: string }) {
  const { toggle, remove } = usePlan();
  const due = item.dueDate ? countdown(item.dueDate, today) : null;
  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
      {item.kind === "note" ? (
        <StickyNote size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      ) : (
        <input
          type="checkbox"
          checked={item.done}
          onChange={(e) => toggle(item.id, e.target.checked)}
          aria-label={item.title}
          className="mt-0.5 size-4 shrink-0 accent-accent"
        />
      )}
      <div className="min-w-0 flex-1" title={item.detail ?? undefined}>
        <p className={cx("text-[13px] leading-snug", item.done ? "text-muted line-through" : "text-ink")}>{item.title}</p>
        {item.dueDate && due && (
          <p className="text-[12px] text-muted">
            {formatDate(item.dueDate)} · <span className={cx(due.urgent && !item.done && "font-medium text-critical-text")}>{due.text}</span>
          </p>
        )}
      </div>
      <IconButton label="Remove" icon={Trash2} onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100" />
    </li>
  );
}

const SECTIONS = [
  { kind: "deadline", title: "Dates", icon: CalendarPlus },
  { kind: "task", title: "To do", icon: ClipboardList },
  { kind: "note", title: "Notes", icon: StickyNote },
] as const;

export function PlanBoard() {
  const { items } = usePlan();
  const today = todayIso();
  const checkable = items.filter((i) => i.kind !== "note");
  const done = checkable.filter((i) => i.done).length;
  const datedOpen = items.some((i) => i.dueDate && !i.done);

  if (!items.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-muted">
        <ClipboardList size={20} aria-hidden />
        <p className="text-[13px]">Pinned items appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--seq-track)" }} aria-hidden>
          <div className="h-full rounded-full transition-[width]" style={{ width: `${checkable.length ? (done / checkable.length) * 100 : 0}%`, background: "var(--seq-fill)" }} />
        </div>
        <span className="text-[12px] tabular-nums text-muted">
          {done}/{checkable.length}
        </span>
        <a
          href="/api/plan/ics"
          title="Export dates to calendar (.ics)"
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium",
            datedOpen ? "bg-surface text-ink hover:bg-surface-2" : "pointer-events-none opacity-40",
          )}
          aria-disabled={!datedOpen}
        >
          <Download size={14} aria-hidden /> Export
        </a>
      </div>
      {SECTIONS.map((s) => {
        const list = items.filter((i) => i.kind === s.kind);
        if (!list.length) return null;
        return (
          <section key={s.kind}>
            <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[11.5px] font-medium text-muted">
              <s.icon size={12} aria-hidden /> {s.title}
            </h3>
            <ul>
              {list.map((i) => (
                <Row key={i.id} item={i} today={today} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
