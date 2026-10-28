"use client";

import { CheckCircle2, FileUp, Inbox, MessageSquarePlus, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import { getLanguage, getPersona } from "@/lib/college";
import type { GapReason } from "@/lib/gaps";
import { Button, cx, Pill } from "../ui";
import { api, timeAgo, type GapSummary } from "./api";

const REASON: Record<GapReason, string> = {
  "low-confidence": "Weak retrieval match",
  "model-flag": "Copilot couldn't answer",
  feedback: "Marked not helpful",
};

function GapItem({ gap, onChanged }: { gap: GapSummary; onChanged: (message?: string) => void }) {
  const [mode, setMode] = useState<"idle" | "answer">("idle");
  const [title, setTitle] = useState(gap.samples[0]?.question ?? gap.label);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // Other phrasings of the same gap (the label already shows one).
  const others = gap.samples.filter((s) => s.question.trim().toLowerCase() !== gap.label.trim().toLowerCase()).slice(0, 2);

  const run = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveAnswer = () =>
    run(async () => {
      const r = await api<{ title: string; chunks: number }>("/api/admin/documents", { method: "POST", json: { title, answer, gapId: gap.id } });
      return `Published "${r.title}".`;
    });

  const upload = (f: File) =>
    run(async () => {
      const form = new FormData();
      form.set("file", f);
      form.set("gapId", String(gap.id));
      const r = await api<{ title: string; chunks: number }>("/api/admin/documents", { method: "POST", body: form });
      return `Added "${r.title}".`;
    });

  const dismiss = () =>
    run(async () => {
      await api("/api/admin/gaps", { method: "PATCH", json: { id: gap.id, status: "dismissed" } });
      return undefined;
    });

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-4">
        <div className="w-10 shrink-0 text-center" title={`Asked ${gap.count}×`}>
          <p className="text-[24px] font-semibold leading-none text-ink">{gap.count}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{gap.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {gap.reasons.map((r) => (
              <Pill key={r}>{REASON[r]}</Pill>
            ))}
            <span className="text-[12px] text-muted">{timeAgo(gap.lastSeen)}</span>
          </div>
          {others.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {others.map((s) => (
                <li key={s.question + s.askedAt} className="text-[13px] text-ink-2" title={`${getPersona(s.persona).short} · ${getLanguage(s.language).label}`}>
                  “{s.question}”
                </li>
              ))}
            </ul>
          )}

          {mode === "answer" ? (
            <div className="mt-3 space-y-2 rounded-lg bg-surface-2 p-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Question"
                className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink"
              />
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                aria-label="Answer"
                placeholder="Answer"
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13.5px] text-ink placeholder:text-muted"
              />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" icon={CheckCircle2} disabled={busy || !answer.trim() || !title.trim()} onClick={saveAnswer}>
                  {busy ? "Saving…" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={MessageSquarePlus} onClick={() => setMode("answer")}>
                Answer
              </Button>
              <Button size="sm" icon={FileUp} disabled={busy} onClick={() => file.current?.click()}>
                {busy ? "Uploading…" : "Upload"}
              </Button>
              <Button size="sm" variant="ghost" icon={X} disabled={busy} onClick={dismiss}>
                Dismiss
              </Button>
              <input
                ref={file}
                type="file"
                accept=".pdf,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          {error && <p className="mt-2 text-[12.5px] text-critical-text">{error}</p>}
        </div>
      </div>
    </li>
  );
}

export function GapList({ gaps, onChanged }: { gaps: GapSummary[]; onChanged: (message?: string) => void }) {
  const open = gaps.filter((g) => g.status === "open");
  const closed = gaps.filter((g) => g.status !== "open");

  const reopen = async (id: number) => {
    await api("/api/admin/gaps", { method: "PATCH", json: { id, status: "open" } }).catch(() => {});
    onChanged();
  };

  return (
    <div className="space-y-6">
      {open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-muted">
          <Inbox size={20} className="mx-auto" aria-hidden />
          <p className="mt-2 text-[13.5px]">No open gaps</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {open.map((g) => (
            <GapItem key={g.id} gap={g} onChanged={onChanged} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-ink-2">
            Closed ({closed.length})
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {closed.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className={cx("shrink-0", g.status === "resolved" ? "text-good-text" : "text-muted")}>
                  {g.status === "resolved" ? <CheckCircle2 size={15} aria-label="Resolved" /> : <X size={15} aria-label="Dismissed" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{g.label}</span>
                  {g.resolvedDocument && <span className="text-muted"> → {g.resolvedDocument.title}</span>}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{g.count}×</span>
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => reopen(g.id)}>
                  Reopen
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
