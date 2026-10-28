"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, Flag, type LucideIcon } from "lucide-react";
import { getLanguage, getPersona } from "@/lib/college";
import { formatNumber } from "@/lib/format";
import { ConfidenceBadge } from "../ui";
import { timeAgo, type AdminStats } from "./api";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[12.5px] text-ink-2">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

/** Single-series horizontal bars: one hue, value at the tip, hover shows the share. */
function BarList({ title, rows, total }: { title: string; rows: { label: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">No questions yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 text-[13px]" title={`${r.label}: ${r.n} (${Math.round((r.n / total) * 100)}%)`}>
              <span className="truncate text-ink-2">{r.label}</span>
              {/* Track reserves room on the right so the value can sit at the tip of a full-length bar. */}
              <span className="relative mr-10 flex h-3.5 items-center">
                <span
                  className="h-full rounded-r-sm transition-opacity group-hover:opacity-80"
                  style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: "var(--seq-fill)" }}
                />
                <span className="absolute pl-2 tabular-nums text-ink" style={{ left: `${Math.max(2, (r.n / max) * 100)}%` }}>
                  {r.n}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CONF: Record<string, { label: string; icon: LucideIcon; color: string; text: string }> = {
  high: { label: "Strong match", icon: CheckCircle2, color: "var(--good)", text: "text-good-text" },
  medium: { label: "Partial match", icon: AlertTriangle, color: "var(--warning)", text: "text-warning-text" },
  low: { label: "Weak match", icon: CircleHelp, color: "var(--critical)", text: "text-critical-text" },
};

export function Usage({ stats }: { stats: AdminStats }) {
  const total = Math.max(1, stats.questions);
  const high = stats.confidence.find((c) => c.key === "high")?.n ?? 0;
  const rated = stats.feedback.up + stats.feedback.down;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Questions asked" value={formatNumber(stats.questions)} sub={`from ${formatNumber(stats.sessions)} visitor${stats.sessions === 1 ? "" : "s"}`} />
        <Tile label="Strong retrieval match" value={stats.questions ? `${Math.round((high / total) * 100)}%` : "—"} sub="of questions" />
        <Tile label="Rated helpful" value={rated ? `${Math.round((stats.feedback.up / rated) * 100)}%` : "—"} sub={`${rated} rating${rated === 1 ? "" : "s"}`} />
        <Tile label="Open knowledge gaps" value={formatNumber(stats.openGaps)} sub={`${stats.resolvedGaps} resolved`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <h3 className="text-[13.5px] font-semibold text-ink">Retrieval confidence</h3>
          {/* Status colors, always with icon + label. */}
          <ul className="mt-3 space-y-2.5">
            {(["high", "medium", "low"] as const).map((k) => {
              const n = stats.confidence.find((c) => c.key === k)?.n ?? 0;
              const c = CONF[k];
              return (
                <li key={k} className="text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 ${c.text}`}>
                      <c.icon size={14} aria-hidden /> {c.label}
                    </span>
                    <span className="tabular-nums text-ink">
                      {n} <span className="text-muted">({Math.round((n / total) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: c.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <BarList title="Who's asking" rows={stats.personas.map((p) => ({ label: getPersona(p.key).short, n: p.n }))} total={total} />
        <BarList title="Answer language" rows={stats.languages.map((l) => ({ label: getLanguage(l.key).label, n: l.n }))} total={total} />
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <h3 className="border-b border-line px-4 py-3 text-[13.5px] font-semibold text-ink">Recent questions</h3>
        {stats.recent.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted">Nothing asked yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {stats.recent.map((q) => (
              <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink">{q.question}</p>
                  {q.rewritten !== q.question && <p className="text-[12px] text-muted">searched as: {q.rewritten}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[12px] text-muted">
                  {q.gapId && (
                    <span className="inline-flex items-center gap-1 text-ink-2">
                      <Flag size={12} aria-hidden /> gap
                    </span>
                  )}
                  <ConfidenceBadge confidence={q.confidence} />
                  <span>
                    {getPersona(q.persona).short} · {getLanguage(q.language).label} · {timeAgo(q.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
