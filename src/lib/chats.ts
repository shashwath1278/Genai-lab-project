import type { UIMessage } from "ai";
import { type DB, getDb } from "./db";

// Saved conversations, per browser session, in the local SQLite file.
// Attachments are saved by name only: the photo itself is never kept.

export type ChatSummary = { id: string; title: string; updatedAt: string; turns: number };

const MAX_MESSAGES = 80;
export const CHAT_ID = /^[\w-]{6,64}$/;

/** A copy safe to store: attached files lose their data, keep their name. */
export function storableMessages<M extends UIMessage>(messages: M[]): M[] {
  return messages.slice(-MAX_MESSAGES).map((m) =>
    m.parts.some((p) => p.type === "file") ? { ...m, parts: m.parts.map((p) => (p.type === "file" ? { ...p, url: "" } : p)) } : m,
  );
}

function titleOf(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = (first?.parts ?? [])
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.length > 70 ? `${text.slice(0, 67)}…` : text;
  return first?.parts.some((p) => p.type === "file") ? "Attached document" : "New chat";
}

export function saveChat(sessionId: string, id: string, messages: UIMessage[], db: DB = getDb()) {
  if (!CHAT_ID.test(id) || !messages.length) return;
  const json = JSON.stringify(storableMessages(messages));
  // Another session can't overwrite this chat even if it guessed the id.
  db.prepare(
    `INSERT INTO chats (id, session_id, title, messages) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, messages = excluded.messages, updated_at = datetime('now')
     WHERE chats.session_id = excluded.session_id`,
  ).run(id, sessionId, titleOf(messages), json);
}

export function listChats(sessionId: string, db: DB = getDb()): ChatSummary[] {
  const rows = db
    .prepare("SELECT id, title, updated_at, messages FROM chats WHERE session_id = ? ORDER BY updated_at DESC LIMIT 40")
    .all(sessionId) as { id: string; title: string; updated_at: string; messages: string }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
    turns: (JSON.parse(r.messages) as UIMessage[]).filter((m) => m.role === "user").length,
  }));
}

export function getChat(sessionId: string, id: string, db: DB = getDb()): { id: string; title: string; messages: UIMessage[] } | null {
  const row = db.prepare("SELECT id, title, messages FROM chats WHERE session_id = ? AND id = ?").get(sessionId, id) as
    | { id: string; title: string; messages: string }
    | undefined;
  return row ? { id: row.id, title: row.title, messages: JSON.parse(row.messages) } : null;
}

export function deleteChat(sessionId: string, id: string, db: DB = getDb()) {
  db.prepare("DELETE FROM chats WHERE session_id = ? AND id = ?").run(sessionId, id);
}
