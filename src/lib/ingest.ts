import crypto from "node:crypto";
import { chunkMarkdown } from "./chunker";
import { getDb, type DB } from "./db";
import { embedPassages } from "./embeddings";

export type SourceType = "seed" | "generated" | "upload" | "faq";

export type IngestDoc = {
  slug: string;
  title: string;
  sourceType: SourceType;
  filename?: string | null;
  category: string;
  audience: string[];
  effectiveDate?: string | null;
  /** Markdown (or plain text) body, without frontmatter. */
  content: string;
};

export type IngestResult = { documentId: number; slug: string; chunks: number; skipped: boolean };

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

/** Pick a slug not yet used in the documents table. */
export function uniqueSlug(base: string, db: DB = getDb()): string {
  const exists = db.prepare("SELECT 1 FROM documents WHERE slug = ?");
  let slug = slugify(base);
  for (let i = 2; exists.get(slug); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}

export function deleteDocument(documentId: number, db: DB = getDb()) {
  db.transaction(() => {
    // vec0 tables don't take part in foreign keys, so clear them by hand.
    db.prepare("DELETE FROM vec_chunks WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)").run(documentId);
    db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
  })();
}

/**
 * Chunk, embed and index a document. Re-ingesting the same slug with the same
 * content is a no-op; changed content replaces the old version.
 */
export async function ingestDocument(doc: IngestDoc, db: DB = getDb()): Promise<IngestResult> {
  const hash = crypto.createHash("sha256").update(doc.title + "\n" + doc.content).digest("hex");
  const existing = db.prepare("SELECT id, content_hash FROM documents WHERE slug = ?").get(doc.slug) as
    | { id: number; content_hash: string }
    | undefined;
  if (existing?.content_hash === hash) {
    const n = (db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE document_id = ?").get(existing.id) as { n: number }).n;
    return { documentId: existing.id, slug: doc.slug, chunks: n, skipped: true };
  }

  const chunks = chunkMarkdown(doc.content);
  if (!chunks.length) throw new Error(`"${doc.title}" has no text to index.`);

  // Embed with the document title and heading so short chunks keep their context.
  const vectors = await embedPassages(chunks.map((c) => `${doc.title} › ${c.heading}\n${c.text}`));

  const write = db.transaction(() => {
    if (existing) deleteDocument(existing.id, db);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO documents (slug, title, source_type, filename, category, audience, effective_date, content, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(doc.slug, doc.title, doc.sourceType, doc.filename ?? null, doc.category, JSON.stringify(doc.audience), doc.effectiveDate ?? null, doc.content, hash);
    const documentId = Number(lastInsertRowid);
    const insertChunk = db.prepare("INSERT INTO chunks (document_id, ordinal, doc_title, heading, text) VALUES (?, ?, ?, ?, ?)");
    const insertVec = db.prepare("INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)");
    chunks.forEach((c, i) => {
      const { lastInsertRowid: chunkId } = insertChunk.run(documentId, i, doc.title, c.heading, c.text);
      insertVec.run(BigInt(chunkId), vectors[i]);
    });
    return documentId;
  });

  return { documentId: write(), slug: doc.slug, chunks: chunks.length, skipped: false };
}
