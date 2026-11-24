import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { loadBetterSqlite, loadSqliteVec } from "./native";
import { SCHEMA } from "./schema";

export type DB = Database.Database;

export const DB_PATH = process.env.COLLEGE_DB_PATH ?? path.join(process.cwd(), "data", "college.db");

// Survive Next's dev hot reloads: one connection per process.
const g = globalThis as unknown as { __collegeDb?: DB; __collegeDbSchema?: string };

/** Columns added after a database was first created. */
function migrate(db: DB) {
  const has = new Set((db.prepare("PRAGMA table_info(program_routes)").all() as { name: string }[]).map((c) => c.name));
  if (!has.has("later_fee_per_year")) db.exec("ALTER TABLE program_routes ADD COLUMN later_fee_per_year INTEGER");
  if (!has.has("cutoff_label")) db.exec("ALTER TABLE program_routes ADD COLUMN cutoff_label TEXT");
}

export function openDb(file = DB_PATH): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db: DB = new (loadBetterSqlite())(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  loadSqliteVec().load(db);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function getDb(): DB {
  g.__collegeDb ??= openDb();
  // The connection outlives hot reloads; when the schema gains a table, add it
  // (every statement is CREATE ... IF NOT EXISTS, so this is safe to repeat).
  if (g.__collegeDbSchema !== SCHEMA) {
    g.__collegeDb.exec(SCHEMA);
    g.__collegeDbSchema = SCHEMA;
  }
  return g.__collegeDb;
}

export function closeDb() {
  g.__collegeDb?.close();
  g.__collegeDb = undefined;
}

export function toBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function fromBlob(buf: Buffer): Float32Array {
  // Copy so the result is aligned and independent of SQLite's buffer.
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return new Float32Array(copy.buffer);
}
