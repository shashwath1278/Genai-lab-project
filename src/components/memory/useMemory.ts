"use client";

import { useCallback, useState } from "react";
import type { ChatSummary } from "@/lib/chats";
import type { MemoryFact } from "@/lib/memory";

export type MemoryState = {
  enabled: boolean;
  facts: MemoryFact[];
  chats: ChatSummary[];
  refresh: () => void;
  refreshChats: () => void;
  forget: (id: number) => void;
  forgetAll: () => void;
  setEnabled: (on: boolean) => void;
  deleteChat: (id: string) => void;
};

const json = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))));

/** Memory facts and saved chats for this browser, from the local database. */
export function useMemory(): MemoryState {
  const [enabled, setOn] = useState(true);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const apply = (m: { enabled: boolean; facts: MemoryFact[] }) => {
    setOn(m.enabled);
    setFacts(m.facts);
  };

  const refresh = useCallback(() => {
    fetch("/api/memory").then(json).then(apply).catch(() => {});
  }, []);

  const refreshChats = useCallback(() => {
    fetch("/api/chats")
      .then(json)
      .then((r: { chats: ChatSummary[] }) => setChats(r.chats))
      .catch(() => {});
  }, []);

  return {
    enabled,
    facts,
    chats,
    refresh,
    refreshChats,
    forget: (id) => fetch(`/api/memory?id=${id}`, { method: "DELETE" }).then(json).then(apply).catch(() => {}),
    forgetAll: () => fetch("/api/memory?all=1", { method: "DELETE" }).then(json).then(apply).catch(() => {}),
    setEnabled: (on) =>
      fetch("/api/memory", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: on }) })
        .then(json)
        .then(apply)
        .catch(() => {}),
    deleteChat: (id) =>
      fetch(`/api/chats?id=${encodeURIComponent(id)}`, { method: "DELETE" })
        .then(json)
        .then((r: { chats: ChatSummary[] }) => setChats(r.chats))
        .catch(() => {}),
  };
}

/** A fact as a chip: short values ("85%") need their label to make sense. */
export const factText = (f: { label: string; value: string }) => (f.value.length <= 6 ? `${f.label}: ${f.value}` : f.value);

/** SQLite's datetime('now') is UTC without a zone. */
export function ago(sqliteUtc: string): string {
  const t = Date.parse(`${sqliteUtc.replace(" ", "T")}Z`);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return "yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
