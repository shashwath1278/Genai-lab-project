import { fromBlob, getDb, toBlob, type DB } from "./db";
import { cosine, embedPassages } from "./embeddings";
import { queryTerms, type Confidence } from "./retrieval";

// Knowledge gaps: questions the corpus couldn't answer well. Similar questions
// are grouped by online clustering, so the admin sees "12 people asked about X"
// instead of 12 separate rows.
//
// Clustering compares the question's topic words, not the whole sentence: with
// full sentences "Is there a swimming pool on campus?" and "Is there a gym on
// campus?" score higher than two phrasings of the pool question.

// Measured on topic-word pairs: paraphrases scored 0.807-1.0, different topics
// up to 0.801 ("pet dog hostel" vs "guest hostel"). Erring high: a wrong merge
// hides a distinct gap, a missed merge only shows a second row.
export const GAP_SIMILARITY = 0.81;

const GENERIC = new Set(
  "campus college northgate ngit institute student students use allowed available bring run like programme program course".split(" "),
);

export function gapTopic(question: string): string {
  const words = queryTerms(question).filter((t) => !GENERIC.has(t));
  return words.length ? words.join(" ") : question;
}

export async function embedGapTopic(question: string): Promise<Float32Array> {
  const [vec] = await embedPassages([gapTopic(question)]);
  return vec;
}
export type GapReason = "low-confidence" | "model-flag" | "feedback";

export function nearestCluster(
  embedding: Float32Array,
  clusters: { id: number; centroid: Float32Array }[],
  threshold = GAP_SIMILARITY,
): { id: number; similarity: number } | null {
  let best: { id: number; similarity: number } | null = null;
  for (const c of clusters) {
    const similarity = cosine(embedding, c.centroid);
    if (similarity >= threshold && (!best || similarity > best.similarity)) best = { id: c.id, similarity };
  }
  return best;
}

/** Running mean of unit vectors, re-normalised. */
export function mergeCentroid(centroid: Float32Array, count: number, embedding: Float32Array): Float32Array {
  const out = new Float32Array(centroid.length);
  let norm = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = (centroid[i] * count + embedding[i]) / (count + 1);
    norm += out[i] * out[i];
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

export type QueryLog = {
  sessionId: string;
  persona: string;
  language: string;
  question: string;
  rewritten: string;
  topScore: number;
  confidence: Confidence;
  /** Embedding of gapTopic(rewritten), used for gap clustering. */
  topicEmbedding: Float32Array;
};

export function logQuery(q: QueryLog, db: DB = getDb()): number {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO queries (session_id, persona, language, question, rewritten, top_score, confidence, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(q.sessionId, q.persona, q.language, q.question, q.rewritten, q.topScore, q.confidence, toBlob(q.topicEmbedding));
  return Number(lastInsertRowid);
}

/** File a query under a gap cluster. Idempotent: a query is only counted once. */
export function recordGap(queryId: number, reason: GapReason, db: DB = getDb()): { clusterId: number; isNew: boolean } | null {
  return db.transaction(() => {
    const q = db.prepare("SELECT rewritten, embedding, gap_cluster_id FROM queries WHERE id = ?").get(queryId) as
      | { rewritten: string; embedding: Buffer; gap_cluster_id: number | null }
      | undefined;
    if (!q) return null;
    if (q.gap_cluster_id) return { clusterId: q.gap_cluster_id, isNew: false };

    const embedding = fromBlob(q.embedding);
    const open = (db.prepare("SELECT id, centroid, count FROM gap_clusters WHERE status = 'open'").all() as { id: number; centroid: Buffer; count: number }[]).map(
      (c) => ({ id: c.id, count: c.count, centroid: fromBlob(c.centroid) }),
    );
    const match = nearestCluster(embedding, open);

    let clusterId: number;
    let isNew = false;
    if (match) {
      const c = open.find((x) => x.id === match.id)!;
      db.prepare("UPDATE gap_clusters SET centroid = ?, count = count + 1, last_seen = datetime('now') WHERE id = ?").run(
        toBlob(mergeCentroid(c.centroid, c.count, embedding)),
        c.id,
      );
      clusterId = c.id;
    } else {
      const label = q.rewritten.length > 120 ? q.rewritten.slice(0, 117) + "..." : q.rewritten;
      clusterId = Number(db.prepare("INSERT INTO gap_clusters (label, centroid) VALUES (?, ?)").run(label, toBlob(embedding)).lastInsertRowid);
      isNew = true;
    }
    db.prepare("UPDATE queries SET gap_cluster_id = ?, gap_reason = ? WHERE id = ?").run(clusterId, reason, queryId);
    return { clusterId, isNew };
  })();
}

export type GapSummary = {
  id: number;
  label: string;
  count: number;
  status: "open" | "resolved" | "dismissed";
  lastSeen: string;
  createdAt: string;
  reasons: GapReason[];
  samples: { question: string; persona: string; language: string; askedAt: string }[];
  resolvedDocument: { id: number; title: string } | null;
};

export function listGaps(db: DB = getDb()): GapSummary[] {
  const clusters = db
    .prepare(
      `SELECT g.id, g.label, g.count, g.status, g.last_seen, g.created_at, d.id AS doc_id, d.title AS doc_title
       FROM gap_clusters g LEFT JOIN documents d ON d.id = g.resolved_document_id
       ORDER BY g.status = 'open' DESC, g.count DESC, g.last_seen DESC`,
    )
    .all() as { id: number; label: string; count: number; status: GapSummary["status"]; last_seen: string; created_at: string; doc_id: number | null; doc_title: string | null }[];
  const samples = db.prepare(
    "SELECT question, persona, language, created_at, gap_reason FROM queries WHERE gap_cluster_id = ? ORDER BY created_at DESC LIMIT 20",
  );
  return clusters.map((c) => {
    const rows = samples.all(c.id) as { question: string; persona: string; language: string; created_at: string; gap_reason: GapReason }[];
    const seen = new Set<string>();
    return {
      id: c.id,
      label: c.label,
      count: c.count,
      status: c.status,
      lastSeen: c.last_seen,
      createdAt: c.created_at,
      reasons: [...new Set(rows.map((r) => r.gap_reason))],
      samples: rows
        .filter((r) => !seen.has(r.question.toLowerCase()) && seen.add(r.question.toLowerCase()))
        .slice(0, 4)
        .map((r) => ({ question: r.question, persona: r.persona, language: r.language, askedAt: r.created_at })),
      resolvedDocument: c.doc_id ? { id: c.doc_id, title: c.doc_title! } : null,
    };
  });
}

export function setGapStatus(clusterId: number, status: "resolved" | "dismissed" | "open", documentId: number | null = null, db: DB = getDb()) {
  db.prepare("UPDATE gap_clusters SET status = ?, resolved_document_id = ? WHERE id = ?").run(status, documentId, clusterId);
}
