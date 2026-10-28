"use client";

import { FileUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { PERSONAS } from "@/lib/college";
import { Button, IconButton, Pill } from "../ui";
import { api, timeAgo, type AdminDocument } from "./api";

const CATEGORIES = ["general", "admissions", "fees", "scholarships", "hostel", "transport", "exams", "academics", "placements", "facilities", "student-life", "support", "faq"];

const SOURCE: Record<AdminDocument["sourceType"], { label: string; tone: "neutral" | "accent" | "good" }> = {
  seed: { label: "Handbook", tone: "neutral" },
  generated: { label: "From data tables", tone: "neutral" },
  upload: { label: "Uploaded", tone: "accent" },
  faq: { label: "Staff answer", tone: "good" },
};

function UploadBox({ onDone }: { onDone: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [audience, setAudience] = useState<string[]>(PERSONAS.map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      form.set("category", category);
      form.set("audience", audience.join(","));
      const r = await api<{ title: string; chunks: number }>("/api/admin/documents", { method: "POST", body: form });
      onDone(`Added "${r.title}".`);
      setFile(null);
      setTitle("");
      if (input.current) input.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h2 className="text-[15px] font-semibold text-ink">Add a document</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-medium text-ink-2">
          File
          <input
            ref={input}
            type="file"
            accept=".pdf,.md,.markdown,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
          />
        </label>
        <label className="block text-[12px] font-medium text-ink-2">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional"
            className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] text-ink placeholder:text-muted"
          />
        </label>
        <label className="block text-[12px] font-medium text-ink-2">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-[13.5px] text-ink">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <fieldset className="text-[12px] font-medium text-ink-2">
          <legend>Audience</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {PERSONAS.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-[13px] font-normal text-ink">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={audience.includes(p.id)}
                  onChange={(e) => setAudience((a) => (e.target.checked ? [...a, p.id] : a.filter((x) => x !== p.id)))}
                />
                {p.short}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" icon={FileUp} disabled={!file || busy} onClick={submit}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
        {error && <p className="text-[12.5px] text-critical-text">{error}</p>}
      </div>
    </section>
  );
}

export function Documents({ documents, onChanged }: { documents: AdminDocument[]; onChanged: (message?: string) => void }) {
  const remove = async (d: AdminDocument) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    await api(`/api/admin/documents?id=${d.id}`, { method: "DELETE" }).catch((e) => alert((e as Error).message));
    onChanged(`Deleted "${d.title}".`);
  };
  const totalChunks = documents.reduce((n, d) => n + d.chunks, 0);

  return (
    <div className="space-y-5">
      <UploadBox onDone={onChanged} />
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-ink">Knowledge base</h2>
          <p className="text-[12.5px] text-muted">
            {documents.length} documents · {totalChunks} chunks
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 text-right font-medium">Chunks</th>
                <th className="px-2 py-2 font-medium">Added</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {documents.map((d) => (
                <tr key={d.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <span className="text-ink">{d.title}</span>
                    {d.filename && <span className="block text-[11.5px] text-muted">{d.filename}</span>}
                  </td>
                  <td className="px-2 py-2">
                    <Pill tone={SOURCE[d.sourceType].tone}>{SOURCE[d.sourceType].label}</Pill>
                  </td>
                  <td className="px-2 py-2 text-ink-2">{d.category}</td>
                  <td className="px-2 py-2 text-right text-ink">{d.chunks}</td>
                  <td className="px-2 py-2 text-ink-2">{timeAgo(d.createdAt)}</td>
                  <td className="px-2 py-1">
                    {(d.sourceType === "upload" || d.sourceType === "faq") && <IconButton label={`Delete ${d.title}`} icon={Trash2} onClick={() => remove(d)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
