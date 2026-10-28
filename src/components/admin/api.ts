"use client";

import type { GapSummary } from "@/lib/gaps";

export type AdminDocument = {
  id: number;
  slug: string;
  title: string;
  sourceType: "seed" | "generated" | "upload" | "faq";
  filename: string | null;
  category: string;
  audience: string[];
  createdAt: string;
  chunks: number;
};

export type AdminStats = {
  questions: number;
  sessions: number;
  openGaps: number;
  resolvedGaps: number;
  documents: number;
  chunks: number;
  feedback: { up: number; down: number };
  confidence: { key: string; n: number }[];
  personas: { key: string; n: number }[];
  languages: { key: string; n: number }[];
  recent: {
    id: number;
    question: string;
    rewritten: string;
    confidence: "high" | "medium" | "low";
    persona: string;
    language: string;
    feedback: "up" | "down" | null;
    gapId: number | null;
    createdAt: string;
  }[];
};

export type { GapSummary };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** SQLite datetime('now') is UTC without a zone marker. */
export function timeAgo(sqliteUtc: string, now = Date.now()): string {
  const t = new Date(sqliteUtc.replace(" ", "T") + "Z").getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
