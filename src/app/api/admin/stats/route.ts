import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const groups = (column: string) =>
    db.prepare(`SELECT ${column} AS key, COUNT(*) AS n FROM queries GROUP BY ${column} ORDER BY n DESC`).all() as { key: string; n: number }[];

  return Response.json({
    questions: one("SELECT COUNT(*) AS n FROM queries"),
    sessions: one("SELECT COUNT(DISTINCT session_id) AS n FROM queries"),
    openGaps: one("SELECT COUNT(*) AS n FROM gap_clusters WHERE status = 'open'"),
    resolvedGaps: one("SELECT COUNT(*) AS n FROM gap_clusters WHERE status = 'resolved'"),
    documents: one("SELECT COUNT(*) AS n FROM documents"),
    chunks: one("SELECT COUNT(*) AS n FROM chunks"),
    feedback: { up: one("SELECT COUNT(*) AS n FROM queries WHERE feedback = 'up'"), down: one("SELECT COUNT(*) AS n FROM queries WHERE feedback = 'down'") },
    confidence: groups("confidence"),
    personas: groups("persona"),
    languages: groups("language"),
    recent: db
      .prepare(
        `SELECT id, question, rewritten, confidence, persona, language, feedback, gap_cluster_id AS gapId, created_at AS createdAt
         FROM queries ORDER BY id DESC LIMIT 12`,
      )
      .all(),
  });
}
