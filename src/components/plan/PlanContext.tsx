"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { NewPlanItem, PlanItem } from "@/lib/plan";

type PlanApi = {
  items: PlanItem[];
  add: (items: NewPlanItem[]) => Promise<void>;
  toggle: (id: number, done: boolean) => Promise<void>;
  remove: (id: number) => Promise<void>;
  toast: string | null;
};

const PlanContext = createContext<PlanApi | null>(null);

async function call(method: string, url: string, body?: unknown): Promise<{ items: PlanItem[]; added?: number }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    call("GET", "/api/plan")
      .then((r) => setItems(r.items))
      .catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  const add = useCallback(
    async (newItems: NewPlanItem[]) => {
      try {
        const r = await call("POST", "/api/plan", { items: newItems });
        setItems(r.items);
        flash(r.added ? `Added ${r.added} to plan` : "Already on plan");
      } catch (e) {
        flash(`Couldn't update plan: ${(e as Error).message}`);
      }
    },
    [flash],
  );

  const toggle = useCallback(async (id: number, done: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done } : i)));
    const r = await call("PATCH", "/api/plan", { id, done }).catch(() => null);
    if (r) setItems(r.items);
  }, []);

  const remove = useCallback(async (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const r = await call("DELETE", `/api/plan?id=${id}`).catch(() => null);
    if (r) setItems(r.items);
  }, []);

  return <PlanContext.Provider value={{ items, add, toggle, remove, toast }}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanApi {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx;
}
