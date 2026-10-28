import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "../src/lib/chunker";
import { loadCollegeDataFromJson, seedStructuredData } from "../src/lib/college-data";
import { closeDb, DB_PATH, getDb } from "../src/lib/db";
import { deleteDocument, ingestDocument, type IngestDoc } from "../src/lib/ingest";
import { renderGeneratedDocs } from "../src/lib/render-docs";

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");

function corpusDocs(): IngestDoc[] {
  return fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const { data, body } = parseFrontmatter(fs.readFileSync(path.join(CORPUS_DIR, file), "utf8"));
      const audience = data.audience;
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title ?? file),
        sourceType: "seed",
        filename: file,
        category: String(data.category ?? "general"),
        audience: Array.isArray(audience) ? audience : audience ? [audience] : [],
        effectiveDate: data.effective ? String(data.effective) : null,
        content: body,
      };
    });
}

/**
 * Rebuilds the knowledge base. Seed and generated documents are replaced;
 * uploaded documents, FAQ answers, query logs, gaps and plans are kept unless
 * --fresh is passed (which deletes the database file first).
 */
export async function seed({ fresh = false } = {}) {
  if (fresh) {
    closeDb();
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(DB_PATH + suffix, { force: true });
  }
  const db = getDb();
  const started = Date.now();

  const data = loadCollegeDataFromJson();
  seedStructuredData(db, data);
  console.log(`structured: ${data.programs.length} programmes, ${data.importantDates.length} dates, ${data.contacts.length} contacts`);

  const docs: IngestDoc[] = [
    ...renderGeneratedDocs(data).map((d) => ({ ...d, sourceType: "generated" as const })),
    ...corpusDocs(),
  ];

  // Drop seed/generated docs that no longer exist on disk.
  const keep = new Set(docs.map((d) => d.slug));
  const stale = (db.prepare("SELECT id, slug FROM documents WHERE source_type IN ('seed', 'generated')").all() as { id: number; slug: string }[])
    .filter((d) => !keep.has(d.slug));
  for (const d of stale) deleteDocument(d.id, db);

  console.log("loading embedding model (first run downloads ~33 MB)...");
  for (const doc of docs) {
    const r = await ingestDocument(doc, db);
    console.log(`${r.skipped ? "  unchanged" : "  indexed  "}  ${String(r.chunks).padStart(3)} chunks  ${doc.slug}`);
  }

  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const stats = {
    documents: count("SELECT COUNT(*) AS n FROM documents"),
    chunks: count("SELECT COUNT(*) AS n FROM chunks"),
    vectors: count("SELECT COUNT(*) AS n FROM vec_chunks"),
    fts: count("SELECT COUNT(*) AS n FROM chunks_fts"),
  };
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s:`, stats);
  if (stats.chunks !== stats.vectors || stats.chunks !== stats.fts) {
    throw new Error("Index mismatch: chunks, vectors and FTS rows should be equal.");
  }
  return stats;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed({ fresh: process.argv.includes("--fresh") }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
