import { EMBEDDING_DIM } from "./embedding-config";

// One SQLite file holds the documents, the FTS5 keyword index, the sqlite-vec
// vector index, the structured college data and the app's own tables.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('seed', 'generated', 'upload', 'faq')),
  filename TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  audience TEXT NOT NULL DEFAULT '[]',
  effective_date TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  doc_title TEXT NOT NULL,
  heading TEXT NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chunks_document ON chunks(document_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  doc_title, heading, text, content='chunks', content_rowid='id', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, doc_title, heading, text) VALUES (new.id, new.doc_title, new.heading, new.text);
END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, doc_title, heading, text) VALUES ('delete', old.id, old.doc_title, old.heading, old.text);
END;
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, doc_title, heading, text) VALUES ('delete', old.id, old.doc_title, old.heading, old.text);
  INSERT INTO chunks_fts(rowid, doc_title, heading, text) VALUES (new.id, new.doc_title, new.heading, new.text);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[${EMBEDDING_DIM}] distance_metric=cosine
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS programs (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  degree TEXT NOT NULL,
  duration_years INTEGER NOT NULL,
  intake INTEGER NOT NULL,
  department TEXT NOT NULL,
  min_aggregate REAL NOT NULL,
  reserved_min_aggregate REAL NOT NULL,
  subjects TEXT NOT NULL,
  placement_rate REAL,
  median_package_lpa REAL,
  highest_package_lpa REAL,
  highlights TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS program_routes (
  id INTEGER PRIMARY KEY,
  program_code TEXT NOT NULL REFERENCES programs(code) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  quota TEXT NOT NULL,
  cutoff_type TEXT NOT NULL CHECK (cutoff_type IN ('rank', 'percentile', 'score', 'none')),
  cutoff REAL,
  fee_per_year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS other_fees (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, amount INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('one-time', 'annual')),
  refundable INTEGER NOT NULL DEFAULT 0, hostel_only INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS hostel_options (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, sharing INTEGER NOT NULL, ac INTEGER NOT NULL,
  fee_per_year INTEGER NOT NULL, seats INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mess_plans (code TEXT PRIMARY KEY, name TEXT NOT NULL, fee_per_year INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS transport_zones (code TEXT PRIMARY KEY, name TEXT NOT NULL, fee_per_year INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS scholarships (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, waiver_percent REAL NOT NULL,
  rule TEXT NOT NULL, criteria TEXT NOT NULL, renewal TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS important_dates (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT, audience TEXT NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS required_documents (
  id INTEGER PRIMARY KEY, level TEXT NOT NULL, name TEXT NOT NULL, mandatory INTEGER NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY, office TEXT NOT NULL, person TEXT NOT NULL, role TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT NOT NULL, location TEXT NOT NULL, hours TEXT NOT NULL, topics TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gap_clusters (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  centroid BLOB NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  persona TEXT NOT NULL,
  language TEXT NOT NULL,
  question TEXT NOT NULL,
  rewritten TEXT NOT NULL,
  top_score REAL NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  embedding BLOB NOT NULL,
  gap_cluster_id INTEGER REFERENCES gap_clusters(id) ON DELETE SET NULL,
  gap_reason TEXT,
  feedback TEXT CHECK (feedback IN ('up', 'down')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS queries_cluster ON queries(gap_cluster_id);

CREATE TABLE IF NOT EXISTS plan_items (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('task', 'deadline', 'note')),
  title TEXT NOT NULL,
  detail TEXT,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plan_items_session ON plan_items(session_id);
`;
