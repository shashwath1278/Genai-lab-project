"use client";

import { ClipboardCheck, ListPlus, Mail } from "lucide-react";
import { useState } from "react";
import type { ChecklistResult } from "@/lib/calculators";
import { formatINR } from "@/lib/format";
import { usePlan } from "../plan/PlanContext";
import { Button, CardFrame } from "../ui";

export function ChecklistCard({ result }: { result: ChecklistResult }) {
  const { add } = usePlan();
  const [ready, setReady] = useState<Set<string>>(new Set());
  const mandatory = result.documents.filter((d) => d.mandatory);

  const toggle = (name: string) =>
    setReady((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const addAll = () =>
    add([
      ...result.steps.map((s, i) => ({ kind: "task" as const, title: `${i + 1}. ${s.title}`, detail: s.detail })),
      ...mandatory.map((d) => ({ kind: "task" as const, title: `Keep ready: ${d.name}`, detail: d.note })),
      ...result.deadlines.map((d) => ({ kind: "deadline" as const, title: d.title, dueDate: d.date })),
    ]);

  return (
    <CardFrame
      icon={ClipboardCheck}
      title={`Join ${result.program.code} via ${result.route.exam}`}
      actions={
        <Button size="sm" variant="primary" icon={ListPlus} onClick={addAll}>
          Add to plan
        </Button>
      }
    >
      <ol className="space-y-2">
        {result.steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 text-[13.5px] text-ink" title={s.detail}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">{i + 1}</span>
            {s.title}
          </li>
        ))}
      </ol>

      <details className="mt-3 rounded-lg bg-surface-2">
        <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink">
          Documents ({ready.size}/{result.documents.length})
        </summary>
        <ul className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2">
          {result.documents.map((d) => (
            <li key={d.name}>
              <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink-2" title={d.note ?? undefined}>
                <input type="checkbox" className="mt-0.5 accent-accent" checked={ready.has(d.name)} onChange={() => toggle(d.name)} />
                <span>
                  {d.name}
                  {!d.mandatory && <span className="text-muted"> (if applicable)</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span className="text-ink-2">
          Pay at admission <strong className="text-ink">{formatINR(result.feeDueAtAdmission)}</strong>
        </span>
        {result.contact && (
          <a className="inline-flex items-center gap-1 text-ink-2 hover:text-ink" href={`mailto:${result.contact.email}`} title={`${result.contact.office}, ${result.contact.phone}`}>
            <Mail size={13} aria-hidden /> {result.contact.email}
          </a>
        )}
      </div>
    </CardFrame>
  );
}
