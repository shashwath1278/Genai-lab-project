import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { SCHEMA } from "./schema";

export type DB = Database.Database;

export const DB_PATH = process.env.COLLEGE_DB_PATH ?? path.join(process.cwd(), "data", "college.db");

// Survive Next's dev hot reloads: one connection per process.
const g = globalThis as unknown as { __collegeDb?: DB; __collegeDbSchema?: string };

export function openDb(file = DB_PATH): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  db.exec(SCHEMA);
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
