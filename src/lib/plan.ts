import { getDb, type DB } from "./db";

export type PlanKind = "task" | "deadline" | "note";
export type PlanItem = {
  id: number;
  kind: PlanKind;
  title: string;
  detail: string | null;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
};
export type NewPlanItem = { kind: PlanKind; title: string; detail?: string | null; dueDate?: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Row = { id: number; kind: PlanKind; title: string; detail: string | null; due_date: string | null; done: number; created_at: string };
const toItem = (r: Row): PlanItem => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  detail: r.detail,
  dueDate: r.due_date,
  done: !!r.done,
  createdAt: r.created_at,
});

export function listPlan(sessionId: string, db: DB = getDb()): PlanItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM plan_items WHERE session_id = ?
       ORDER BY done, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date, id`,
    )
    .all(sessionId) as Row[];
  return rows.map(toItem);
}

/** Adds items, skipping ones whose kind + title are already on the board. */
export function addPlanItems(sessionId: string, items: NewPlanItem[], db: DB = getDb()): number {
  const exists = db.prepare("SELECT 1 FROM plan_items WHERE session_id = ? AND kind = ? AND title = ?");
  const insert = db.prepare("INSERT INTO plan_items (session_id, kind, title, detail, due_date) VALUES (?, ?, ?, ?, ?)");
  let added = 0;
  db.transaction(() => {
    for (const item of items.slice(0, 50)) {
      const title = item.title.trim().slice(0, 200);
      if (!title || !["task", "deadline", "note"].includes(item.kind)) continue;
      if (exists.get(sessionId, item.kind, title)) continue;
      const due = item.dueDate && ISO_DATE.test(item.dueDate) ? item.dueDate : null;
      insert.run(sessionId, item.kind, title, item.detail?.slice(0, 1000) ?? null, due);
      added++;
    }
  })();
  return added;
}

export function setPlanItemDone(sessionId: string, id: number, done: boolean, db: DB = getDb()) {
  db.prepare("UPDATE plan_items SET done = ? WHERE id = ? AND session_id = ?").run(done ? 1 : 0, id, sessionId);
}

export function deletePlanItem(sessionId: string, id: number, db: DB = getDb()) {
  db.prepare("DELETE FROM plan_items WHERE id = ? AND session_id = ?").run(id, sessionId);
}
