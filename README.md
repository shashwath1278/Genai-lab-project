# Northgate Copilot

An AI college-information assistant built on retrieval-augmented generation (RAG), for a **fictional** college, the Northgate Institute of Technology, Bengaluru.

Everything except the LLM call runs on your machine. Embeddings are computed locally with transformers.js. One SQLite file holds the documents, the keyword index (FTS5), the vector index (sqlite-vec), the structured college data and the app's own tables.

## What makes it different from a plain chatbot

- **Every answer shows its receipts.** Inline citation chips `[1]` link to a Sources panel. The panel shows:
  - the rewritten search query
  - keyword (BM25) hits vs semantic (vector) hits, and how they were fused
  - the exact passages used, with the matched words highlighted
- **Answers as cards, not walls of text.** The LLM calls tools that compute results from structured data, so numbers are calculated, never guessed:
  - eligibility verdict against last year's cutoffs, with category relaxation
  - year-by-year cost breakdown (tuition by quota, hostel, mess, bus, scholarship)
  - side-by-side programme comparison
  - deadline timeline with countdowns
  - admission checklist
- **Knowledge-gap loop for staff.** A question gets logged as a gap when retrieval is weak, the model says the handbook doesn't cover it, or a user taps 👎. Gaps are grouped with similar questions on the `/admin` dashboard. Staff can type an answer or upload a PDF/Markdown file; it's indexed immediately and cited in the next answer.
- **Personas.** Prospective student, current student and parent each get a different tone, different starter questions and a retrieval boost toward their documents.
- **Five languages, with voice.** Answers in English, Hindi, Kannada, Tamil or Telugu. Questions in any of them are rewritten into an English search query first, so the English embedding model still finds the right passages. Questions can be spoken (Web Speech API) and answers read aloud.
- **Plan board.** Pin answers, add deadlines from a timeline or turn a checklist into to-dos, then export dated items to your calendar (`.ics`).

## Quick start

Requires Node 22+.

```bash
npm install
cp .env.example .env.local      # then add GEMINI_API_KEY or GROQ_API_KEY
npm run dev                     # seeds the database on first run, then http://localhost:3000
```

- **Gemini key:** https://aistudio.google.com/apikey. **Groq key:** https://console.groq.com/keys.
- If both keys are set, Gemini is used unless `LLM_PROVIDER=groq`.
- Models can be overridden in `.env.local`. Defaults: `gemini-3.5-flash` and `openai/gpt-oss-120b`.
- The first run downloads the embedding model (`Xenova/bge-small-en-v1.5`, about 33 MB) into `.cache/models`.
- Without a key, the app still loads, and search, embeddings and the staff dashboard work. Chat shows a message asking for a key.
- Staff dashboard: http://localhost:3000/admin. Set `ADMIN_PASSCODE` in `.env.local` to protect it; it's open when unset.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (webpack, see the Windows note below) |
| `npm run seed` | Rebuild the knowledge base from `data/`. Add `-- --fresh` to also wipe query logs, gaps and plans |
| `npm run eval` | Retrieval benchmark: keyword vs semantic vs hybrid. Needs no API key |
| `npm test` | Unit tests plus an end-to-end test of `/api/chat` with a scripted LLM |
| `npm run build` / `npm start` | Production build / server |

## How a question is answered

```
question ──► rewrite to a standalone English query      (fast LLM; skipped for a first English turn)
         ──► FTS5 BM25 top 20  ┐
             sqlite-vec top 20 ┴─► weighted reciprocal rank fusion ─► persona boost ─► top 6 passages
         ──► log query; weak match → knowledge gap
         ──► stream: evidence part ─► LLM answer with [n] citations + tool calls ─► cards
```

- **Chunking.** Markdown-aware: sections follow headings, the heading path is kept as the chunk label, tables are never split, and long prose is split by sentence with overlap. Chunks are embedded together with their document title and heading.
- **Fusion.** Reciprocal rank fusion (k = 60), with keyword ranks weighted 0.7.
- **Confidence.** Comes from the best cosine similarity: high ≥ 0.72, medium ≥ 0.64, otherwise low.
- **Gap clustering.** Questions are reduced to their topic words ("swimming pool"), embedded, and grouped by online clustering (cosine ≥ 0.81). Comparing whole sentences didn't work: "Is there a swimming pool on campus?" scored closer to "Is there a gym on campus?" than to a rephrasing of the pool question.
- **One source of truth for numbers.** The fee, scholarship, calendar, contact and document-checklist documents are generated from `data/structured/*.json`. The calculators read the same data, so cited text and card numbers can't disagree.

## Retrieval evaluation

`npm run eval` scores 39 questions against an expected section (not just the right document), using top-5 retrieval:

| Mode | hit@1 | hit@5 | MRR |
|---|---|---|---|
| Keyword (FTS5 BM25) | 82.1% | 97.4% | 0.885 |
| Semantic (bge-small + sqlite-vec) | 89.7% | 100% | 0.940 |
| **Hybrid (weighted RRF)** | **89.7%** | **100%** | **0.942** |

On the six off-corpus questions, the confidence threshold flags 4 as low. "Swimming pool" still scores 0.73, because it sits close to the sports-facilities section. That is why there is a second gap signal: the model calls `flagKnowledgeGap` when the passages don't answer the question.

## Project layout

```
data/corpus/          14 handwritten handbook documents (Markdown + frontmatter)
data/structured/      programmes, cutoffs, fees, hostel, scholarships, dates, contacts (JSON)
data/college.db       generated SQLite database (gitignored)
scripts/              seed, ensure-db (predev), eval-retrieval + eval-set.json
src/lib/              db + schema, embeddings, chunker, ingest, retrieval, calculators, tools,
                      prompts, gaps, plan, ics, llm provider selection
src/app/api/          chat, status, feedback, plan (+ ics), admin/{login,documents,gaps,stats}
src/components/       chat workspace, answer cards, evidence panel, plan board, admin dashboard
tests/                chunker, calculators, retrieval, gaps/ics/format, chat route (end to end)
```

To use a real college, replace the files in `data/corpus` and `data/structured` (same shapes), rename it in `src/lib/college.ts`, and run `npm run seed -- --fresh`.

## Windows note: why `--webpack`

Next.js 16 builds with Turbopack by default. For native packages like `better-sqlite3` and `sqlite-vec`, Turbopack creates symlinks or directory junctions inside `.next/node_modules`. On the drive this project was built on, Windows refuses to create junctions ("The file or directory is corrupted and unreadable", os error 1392), and that drive reports a "Warning" health status. So `dev` and `build` use webpack, which loads those packages with a plain `require`.

On a healthy drive, `npm run dev:turbo` uses Turbopack. Tailwind runs through PostCSS, so both bundlers work.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, Vercel AI SDK 7 (`@ai-sdk/google`, `@ai-sdk/groq`), better-sqlite3, sqlite-vec, SQLite FTS5, @huggingface/transformers, unpdf, Vitest.
