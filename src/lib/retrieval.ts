import { getDb, type DB } from "./db";
import { embedQuery } from "./embeddings";

export type Confidence = "high" | "medium" | "low";
export type RetrievalMode = "hybrid" | "keyword" | "semantic";

export type Passage = {
  /** 1-based citation number shown to the model and the user. */
  n: number;
  chunkId: number;
  docSlug: string;
  docTitle: string;
  category: string;
  heading: string;
  text: string;
  semanticRank: number | null;
  /** Cosine similarity to the query (0-1), shown for every passage. */
  similarity: number;
  keywordRank: number | null;
  fusedScore: number;
  personaBoost: boolean;
};

export type RetrievalResult = {
  passages: Passage[];
  terms: string[];
  topSimilarity: number;
  confidence: Confidence;
  keywordHits: number;
  semanticHits: number;
  related: { label: string; docTitle: string }[];
  queryEmbedding: Float32Array;
};

// Tuned on scripts/eval-set.json: answerable questions score well above
// these, off-corpus questions ("is there a swimming pool?") fall below.
export const CONFIDENCE_THRESHOLDS = { high: 0.72, medium: 0.64 };
export const RRF_K = 60;
const PERSONA_BOOST = 1.15;
// Keyword ranks count a little less than semantic ranks in the fusion; 0.7 scored
// best on the eval set (see README). Override with KEYWORD_WEIGHT to experiment.
export const KEYWORD_WEIGHT = Number(process.env.KEYWORD_WEIGHT ?? 0.7);
const CANDIDATES = 20;

const STOPWORDS = new Set(
  ("a an and are as at be by can do does for from how i if in is it its me my of on or our the to us was we what when where which who why will with you your " +
    "there this that these those have has had am any about tell please much many get give need want know").split(" "),
);

export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((w) => (w.length > 1 || /\d/.test(w)) && !STOPWORDS.has(w)))];
}

export function confidenceFor(similarity: number): Confidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

/** Reciprocal rank fusion over any number of ranked id lists. */
export function reciprocalRankFusion(lists: number[][], weights: number[] = [], k = RRF_K): Map<number, number> {
  const scores = new Map<number, number>();
  lists.forEach((list, l) => {
    const w = weights[l] ?? 1;
    list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + w / (k + i + 1)));
  });
  return scores;
}

function keywordSearch(db: DB, terms: string[], limit: number): number[] {
  if (!terms.length) return [];
  const match = terms.map((t) => `"${t}"`).join(" OR ");
  // bm25() is lower-is-better; title and heading words count more than body text.
  const rows = db
    .prepare("SELECT rowid AS id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts, 2.0, 3.0, 1.0) LIMIT ?")
    .all(match, limit) as { id: number }[];
  return rows.map((r) => r.id);
}

function semanticSearch(db: DB, embedding: Float32Array, limit: number): { id: number; similarity: number }[] {
  const rows = db
    .prepare("SELECT chunk_id AS id, distance FROM vec_chunks WHERE embedding MATCH ? AND k = ?")
    .all(embedding, limit) as { id: number; distance: number }[];
  return rows.map((r) => ({ id: r.id, similarity: 1 - r.distance }));
}

type ChunkRow = {
  id: number;
  document_id: number;
  ordinal: number;
  heading: string;
  text: string;
  slug: string;
  title: string;
  category: string;
  audience: string;
};

export async function retrieve(
  query: string,
  { persona, k = 6, mode = "hybrid", db = getDb() }: { persona?: string; k?: number; mode?: RetrievalMode; db?: DB } = {},
): Promise<RetrievalResult> {
  const terms = queryTerms(query);
  const queryEmbedding = await embedQuery(query);

  const keywordIds = mode === "semantic" ? [] : keywordSearch(db, terms, CANDIDATES);
  const semantic = semanticSearch(db, queryEmbedding, CANDIDATES);
  const semanticIds = mode === "keyword" ? [] : semantic.map((s) => s.id);

  const fused = reciprocalRankFusion([semanticIds, keywordIds], [1, KEYWORD_WEIGHT]);
  const ids = [...fused.keys()];
  if (!ids.length) {
    return { passages: [], terms, topSimilarity: 0, confidence: "low", keywordHits: 0, semanticHits: 0, related: [], queryEmbedding };
  }

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.ordinal, c.heading, c.text, d.slug, d.title, d.category, d.audience
       FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.id IN (${placeholders})`,
    )
    .all(...ids) as ChunkRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Similarity for keyword-only hits too, so the evidence panel can show it for every passage.
  const similarity = new Map(semantic.map((s) => [s.id, s.similarity]));
  const missing = ids.filter((id) => !similarity.has(id));
  if (missing.length) {
    const extra = db
      .prepare(`SELECT chunk_id AS id, vec_distance_cosine(embedding, ?) AS d FROM vec_chunks WHERE chunk_id IN (${missing.map(() => "?").join(",")})`)
      .all(queryEmbedding, ...missing) as { id: number; d: number }[];
    for (const e of extra) similarity.set(e.id, 1 - e.d);
  }

  const ranked = ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const row = byId.get(id)!;
      const boost = !!persona && (JSON.parse(row.audience) as string[]).includes(persona);
      return { id, row, boost, score: fused.get(id)! * (boost ? PERSONA_BOOST : 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const passages: Passage[] = ranked.map((r, i) => {
    const semanticRank = semanticIds.indexOf(r.id);
    const keywordRank = keywordIds.indexOf(r.id);
    return {
      n: i + 1,
      chunkId: r.id,
      docSlug: r.row.slug,
      docTitle: r.row.title,
      category: r.row.category,
      heading: r.row.heading,
      text: r.row.text,
      semanticRank: semanticRank >= 0 ? semanticRank + 1 : null,
      similarity: similarity.get(r.id) ?? 0,
      keywordRank: keywordRank >= 0 ? keywordRank + 1 : null,
      fusedScore: r.score,
      personaBoost: r.boost,
    };
  });

  const topSimilarity = semantic[0]?.similarity ?? 0;
  return {
    passages,
    terms,
    topSimilarity,
    confidence: confidenceFor(topSimilarity),
    keywordHits: keywordIds.length,
    semanticHits: semanticIds.length,
    related: relatedSections(db, ranked.map((r) => r.row)),
    queryEmbedding,
  };
}

/** Sibling sections of the top documents that weren't retrieved: follow-up suggestions. */
function relatedSections(db: DB, top: ChunkRow[]): { label: string; docTitle: string }[] {
  const seen = new Set(top.map((r) => r.heading));
  const out: { label: string; docTitle: string }[] = [];
  const docs = [...new Map(top.slice(0, 3).map((r) => [r.document_id, r])).values()];
  const stmt = db.prepare("SELECT DISTINCT heading FROM chunks WHERE document_id = ? ORDER BY ordinal");
  for (const doc of docs) {
    for (const { heading } of stmt.all(doc.document_id) as { heading: string }[]) {
      if (seen.has(heading) || heading === "Overview") continue;
      seen.add(heading);
      out.push({ label: heading.split(" › ").pop()!, docTitle: doc.title });
      if (out.length >= 3) return out;
      break; // one suggestion per document keeps them varied
    }
  }
  return out;
}
