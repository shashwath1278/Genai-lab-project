"use client";

import { ArrowLeft, BarChart3, Files, Inbox, KeyRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "../chat/AssistantMessage";
import { Button, cx } from "../ui";
import { api, type AdminDocument, type AdminStats, type GapSummary } from "./api";
import { Documents } from "./Documents";
import { GapList } from "./GapList";
import { Usage } from "./Usage";

type Tab = "gaps" | "documents" | "usage";

function Passcode({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mx-auto mt-24 max-w-sm rounded-xl border border-line bg-surface p-6 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/admin/login", { method: "POST", json: { passcode: value } });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <KeyRound size={20} className="text-accent-text" aria-hidden />
      <h1 className="mt-2 text-[17px] font-semibold text-ink">Staff dashboard</h1>
      <p className="mt-1 text-[13px] text-ink-2">Enter passcode</p>
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Passcode"
        className="mt-4 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink"
      />
      {error && <p className="mt-2 text-[12.5px] text-critical-text">{error}</p>}
      <Button type="submit" variant="primary" className="mt-4 w-full">
        Unlock
      </Button>
    </form>
  );
}

export default function AdminApp() {
  const [auth, setAuth] = useState<{ required: boolean; authed: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("gaps");
  const [gaps, setGaps] = useState<GapSummary[]>([]);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, d, s] = await Promise.all([
      api<{ gaps: GapSummary[] }>("/api/admin/gaps"),
      api<{ documents: AdminDocument[] }>("/api/admin/documents"),
      api<AdminStats>("/api/admin/stats"),
    ]);
    setGaps(g.gaps);
    setDocuments(d.documents);
    setStats(s);
  }, []);

  const checkAuth = useCallback(() => {
    api<{ required: boolean; authed: boolean }>("/api/admin/login")
      .then((a) => {
        setAuth(a);
        if (a.authed) return load();
      })
      .catch((e) => setNotice((e as Error).message));
  }, [load]);

  useEffect(checkAuth, [checkAuth]);

  const changed = (message?: string) => {
    if (message) setNotice(message);
    load().catch((e) => setNotice((e as Error).message));
  };

  if (auth && !auth.authed) return <Passcode onDone={checkAuth} />;

  const openGaps = gaps.filter((g) => g.status === "open").length;
  const tabs: { id: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { id: "gaps", label: "Knowledge gaps", icon: Inbox, count: openGaps },
    { id: "documents", label: "Documents", icon: Files, count: documents.length },
    { id: "usage", label: "Usage", icon: BarChart3 },
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <BrandMark className="size-8" />
          <div className="leading-tight">
            <p className="font-display text-[17px] font-semibold tracking-tight text-ink">Staff dashboard</p>

          </div>
          <Link href="/" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
            <ArrowLeft size={15} aria-hidden /> Back to chat
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-medium",
                tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <t.icon size={15} aria-hidden /> {t.label}
              {!!t.count && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] font-semibold text-ink">{t.count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {notice && (
          <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] text-ink-2">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-muted hover:text-ink" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {!auth ? (
          <p className="text-[13px] text-muted">Loading...</p>
        ) : tab === "gaps" ? (
          <GapList gaps={gaps} onChanged={changed} />
        ) : tab === "documents" ? (
          <Documents documents={documents} onChanged={changed} />
        ) : stats ? (
          <Usage stats={stats} />
        ) : null}
      </main>
    </div>
  );
}
