import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { parseFrontmatter } from "@/lib/chunker";
import { getDb } from "@/lib/db";
import { setGapStatus } from "@/lib/gaps";
import { deleteDocument, ingestDocument, uniqueSlug, type IngestDoc } from "@/lib/ingest";

const MAX_BYTES = 10 * 1024 * 1024;
const AUDIENCES = ["prospective", "current", "parent"];

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const docs = getDb()
    .prepare(
      `SELECT d.id, d.slug, d.title, d.source_type AS sourceType, d.filename, d.category, d.audience, d.created_at AS createdAt,
              COUNT(c.id) AS chunks
       FROM documents d LEFT JOIN chunks c ON c.document_id = d.id
       GROUP BY d.id ORDER BY d.source_type = 'seed', d.source_type = 'generated', d.created_at DESC, d.title`,
    )
    .all() as { audience: string }[];
  return Response.json({ documents: docs.map((d) => ({ ...d, audience: JSON.parse(d.audience) })) });
}

function parseAudience(value: unknown): string[] {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");
  const picked = list.map((s) => String(s).trim()).filter((s) => AUDIENCES.includes(s));
  return picked.length ? picked : AUDIENCES;
}

/** Problems with what the user sent, reported as 4xx rather than 500. */
class UploadError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function extractUpload(file: File): Promise<{ text: string; frontmatter: Record<string, unknown> }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    try {
      const { text } = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      return { text, frontmatter: {} };
    } catch {
      throw new UploadError("That PDF couldn't be read. Is it password-protected or damaged?", 422);
    }
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    const { data, body } = parseFrontmatter(await file.text());
    return { text: body, frontmatter: data };
  }
  throw new UploadError("Upload a PDF, Markdown (.md) or text (.txt) file.", 415);
}

/**
 * Two ways to add knowledge:
 *  - multipart upload: file (+ title, category, audience, gapId)
 *  - JSON { title, answer, gapId? }: a staff-written FAQ answer, usually to close a gap
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  try {
    let doc: IngestDoc;
    let gapId: number | null = null;

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "Files up to 10 MB only." }, { status: 413 });
      const { text, frontmatter } = await extractUpload(file);
      if (!text.trim()) return Response.json({ error: "No text could be extracted (scanned PDFs need OCR first)." }, { status: 422 });
      const title = String(form.get("title") || frontmatter.title || file.name.replace(/\.[^.]+$/, ""));
      doc = {
        slug: uniqueSlug(title),
        title,
        sourceType: "upload",
        filename: file.name,
        category: String(form.get("category") || frontmatter.category || "general"),
        audience: parseAudience(form.get("audience") || frontmatter.audience),
        content: text,
      };
      gapId = Number(form.get("gapId")) || null;
    } else {
      const body = (await req.json()) as { title?: string; answer?: string; gapId?: number; audience?: string[] };
      const title = body.title?.trim();
      const answer = body.answer?.trim();
      if (!title || !answer) return Response.json({ error: "Both a question and an answer are needed." }, { status: 400 });
      doc = {
        slug: uniqueSlug(`faq ${title}`),
        title: `FAQ: ${title}`,
        sourceType: "faq",
        category: "faq",
        audience: parseAudience(body.audience),
        content: `## ${title}\n\n${answer}`,
      };
      gapId = body.gapId ?? null;
    }

    const result = await ingestDocument(doc);
    if (gapId) setGapStatus(gapId, "resolved", result.documentId);
    return Response.json({ ok: true, ...result, title: doc.title });
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[admin/documents]", err);
    return Response.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get("id"));
  const doc = getDb().prepare("SELECT source_type FROM documents WHERE id = ?").get(id) as { source_type: string } | undefined;
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });
  if (doc.source_type === "seed" || doc.source_type === "generated") {
    return Response.json({ error: "Seed documents come from data/corpus; edit them there and run npm run seed." }, { status: 400 });
  }
  deleteDocument(id);
  return Response.json({ ok: true });
}
