import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getProviderInfo } from "@/lib/llm";

export async function GET() {
  await connection();
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return Response.json({
    llm: getProviderInfo(),
    documents: count("SELECT COUNT(*) AS n FROM documents"),
    chunks: count("SELECT COUNT(*) AS n FROM chunks"),
    openGaps: count("SELECT COUNT(*) AS n FROM gap_clusters WHERE status = 'open'"),
  });
}
