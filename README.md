# Northgate Copilot

An AI college-information assistant built on retrieval-augmented generation (RAG), for a **fictional** college, the Northgate Institute of Technology, Bengaluru.

Everything except the LLM call runs on your machine. Embeddings are computed locally with transformers.js. One SQLite file holds the documents, the keyword index (FTS5), the vector index (sqlite-vec), the structured college data and the app's own tables.

- `/`: landing page
- `/chat`: the assistant
- `/admin`: staff dashboard

## What makes it different from a plain chatbot

- **Every answer shows its receipts.** Inline citation chips `[1]` link to a Sources panel. The panel shows:
  - the rewritten search query
  - keyword (BM25) hits vs semantic (vector) hits, and how they were fused
  - the exact passages used, with the matched words highlighted
- **Answers as cards, not walls of text.** The LLM calls tools that compute results from structured data, so numbers are calculated, never guessed:
  - eligibility verdict against last year's cutoffs
  - year-by-year cost breakdown
  - programme comparison
  - deadline timeline
  - admission checklist
- **Knowledge-gap loop for staff.** A question gets logged as a gap when retrieval is weak, the model says the handbook doesn't cover it, or a user taps 👎. Gaps are grouped with similar questions on `/admin`. Staff can type an answer or upload a PDF/Markdown file; it's indexed immediately and cited in the next answer.
- **Personas.** Applicant, student and parent each get a different tone, different starter questions and a retrieval boost toward their documents.
- **Five languages, with voice.** Answers in English, Hindi, Kannada, Tamil or Telugu. Questions in those scripts, and romanized Hinglish ("hostel ka fees kitna hai"), are rewritten into an English search query first, so the English embedding model still finds the right passages. Questions can be spoken (Web Speech API) and answers read aloud.
- **Plan board.** Pin answers, add deadlines from a timeline or turn a checklist into to-dos, then export dated items to your calendar (`.ics`).
- **Reads your documents.** Attach a photo or PDF (up to 3, via the paperclip, paste or drag and drop):
  - **Fee receipt:** every line is checked in code against the official fee tables (tuition by programme and route, hostel, mess, bus, other fees). The card shows what matches, what's over or under and by how much, and whether the printed total adds up.
  - **Marks or rank card:** the PCM aggregate is worked out from the subject marks. An editable form lets the student check the values, then asks for an eligibility check.
  - **Notice or circular:** its dates go into My Plan in one tap.

  Photos are shrunk in the browser (longest side 1,600 px) and read by a vision model: Groq's `qwen/qwen3.8-27b` first, then Gemini. Text PDFs are read as text. Files are never stored, the reader is told to leave out names and ID numbers, and text inside a document is treated as data, not instructions.
- **Memory and chat history, kept locally.** The assistant remembers details about you across chats, in the same SQLite file, per browser:
  - **What it remembers:** programme, exam and rank, aggregate, category, hostel, mess, bus zone, scholarship, shortlists.
  - **How:** mostly for free, from the inputs of tools it already called. An eligibility check knows your programme, rank and marks; a cost estimate knows your hostel and bus zone; a marks card gives your PCM aggregate. For other lasting facts you mention ("I live in Whitefield"), it can call a `remember` tool. No extra model calls are made just to remember.
  - **In use:** a new chat greets you with what it remembers, and the model uses those details instead of asking again ("using your KCET rank of 12,000 from earlier"). Answers that taught it something show "Memory updated".
  - **Your control:** the Memory tab lists every fact with where it came from. You can delete any of them, forget everything, or switch memory off.
  - **History:** conversations are saved automatically and can be reopened from the same tab, with attachments kept by name only.
- **Campus map with walking directions.** "Where is the Examination Section?" brings up a hand-drawn campus map in the site's style, zoomed to the route, plus turn-by-turn steps ("At Jacaranda Circle, turn left onto Central Walk…"). Routes come from Dijkstra over a walkway graph, not from the LLM. The same data generates a "Campus Map and Directions" document, so text answers and the map agree.
- **Live web search (optional, with a Tavily key).** "Scan Reddit for…", "what does Quora say about…", "check the official KEA site": it searches the named site, official exam and government sites, or the open web. An explicit request to search is recognised in code and always carried out; the model can't decline it. Results show on a "From the web" card with `[W1]` citations and a trust tag (Official, Community). Northgate is fictional and its initials belong to real colleges, so each result is checked for the college's full name: when none has it, the card and the answer say so, and the handbook's own figures are given instead of another college's.

  Every web source shows its site's logo, the way search answers show favicons. Platforms like Reddit, X, GitHub and YouTube get their own marks (Phosphor brand icons), other sites their favicon, and government sites without one a government glyph. The logos appear on the card, as the inline citation chips, as a stacked "N web sources" button under the answer and in a "From the web" section of the Sources panel. The logo code handles any site, so widening the domain allowlist needs no UI work.
- **Provider fallback.** With both keys set, Gemini answers first. When a model hits a rate limit or quota, the next one takes over: Groq's `gpt-oss-120b`, then its smaller `gpt-oss-20b` as a last resort. A model is skipped for 30 minutes after a daily quota and 20 seconds after a per-minute limit; limits are per model, so cooldowns are too. Free tiers are small: the Gemini key this was built with allowed 20 requests a day, and Groq allows 200,000 tokens a day per model (roughly 20-30 answers).

## Design

- **Palette.** A "garden city" palette, after Bengaluru:
  - jacaranda purple as the accent
  - laterite-brick terracotta, rain-tree green and marigold for illustration and highlights
  - warm paper background, and an aubergine night for dark mode
  The chart colours on the cost card are a separate palette, validated for colour-blind safety on both card surfaces.
- **Light and dark.** Follows the system until you use the toggle in any header. The choice is remembered in the browser, and a small script in `<head>` applies it before the first paint, so there's no flash.
- **Type.** *Instrument Serif* for headlines (with italics for emphasis), *Bricolage Grotesque* for the interface, *Geist Mono* for small labels and figures.
- **Illustrations.** Drawn as SVG in code (`src/components/art`): the Northgate gate under a jacaranda, plus spot illustrations for sources, fees, languages, knowledge gaps and plans. They use a riso-print style, with fills printed slightly off their ink outlines. Colours come from theme tokens, so every illustration redraws itself for dark mode. Icons are Phosphor.
- **Motion.**
  - Smooth scrolling on the landing page with Lenis, driven by GSAP's ticker so scroll-linked animation stays in step. Anchor links glide to their section. Touch keeps native scrolling, and the chat keeps its own scroll panes.
  - GSAP (`src/components/landing/motion.tsx` and the art components):
    - the hero: falling petals, a breathing canopy, a lamp glow and a printed "receipt" that feeds out below the gate
    - scroll depth: the sun sinks behind the tree and the hill settles as the hero leaves
    - section headings rise line by line from behind a mask (SplitText)
    - a reading-progress line under the nav
    - illustrations that drift against the scroll, a connector that draws itself and step icons that land like stamps
    - call-to-action buttons that lean toward the pointer
  - Motion (Framer): card reveals, the sliding persona switch, tab underlines, drawer and toasts.
  - React Bits: the split-text headline and counting stats (`src/components/reactbits`, vendored unmodified).
  - Everything honours the reduced-motion setting: no smooth scrolling, no split text, nothing hidden.

## Quick start

Requires Node 22+.

```bash
npm install
cp .env.example .env.local      # then add GEMINI_API_KEY and/or GROQ_API_KEY
npm run dev                     # seeds the database on first run, then http://localhost:3000
```

- **Gemini key:** https://aistudio.google.com/apikey. **Groq key:** https://console.groq.com/keys.
- With both keys set, Gemini is primary and Groq is the fallback. `LLM_PROVIDER=groq` (or `gemini`) pins one and turns the fallback off.
- Default models:
  - Gemini: `gemini-3.5-flash`, with `gemini-3.5-flash-lite` for query rewriting
  - Groq: `openai/gpt-oss-120b`, with `openai/gpt-oss-20b` for query rewriting
  All are overridable in `.env.local`.
- The first run downloads the embedding model (`Xenova/bge-small-en-v1.5`, about 33 MB) into `.cache/models`.
- Without a key, the app still loads, and search, embeddings and the staff dashboard work. Chat shows a message asking for a key.
- Set `ADMIN_PASSCODE` in `.env.local` to protect `/admin`; it's open when unset.
- Optional: set `TAVILY_API_KEY` (free plan at https://app.tavily.com, 1,000 credits a month, no card) to turn on official-site web search. Each search costs 1 credit.
- Reading photos uses your Groq key (`GROQ_VISION_MODEL`, default `qwen/qwen3.8-27b`) or your Gemini key (`GEMINI_VISION_MODEL`).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run seed` | Rebuild the knowledge base from `data/`. Add `-- --fresh` to also wipe query logs, gaps and plans |
| `npm test` | Unit tests, including the chat route end to end with a scripted LLM |
| `npm run test:e2e` | Browser tests in Chrome against a production build with its own database, using the real LLM |
| `npm run eval` | Retrieval benchmark: keyword vs semantic vs hybrid. Needs no API key |
| `npm run eval:answers` | Answer-quality benchmark against a running server (uses the real LLM) |
| `npm run fast` | Build once and run the production app: by far the fastest to use or demo |
| `npm run build` / `npm start` | Production build / server |

## How a question is answered

```
attachments ──► vision model reads each one (in memory) ──► code checks: fee audit, PCM aggregate
question ──► rewrite to a standalone English query    (follow-ups, Indic scripts, Hinglish; skipped for a plain first English turn)
         ──► FTS5 BM25 top 20  ┐
             sqlite-vec top 20 ┴─► weighted reciprocal rank fusion ─► persona boost ─► top 6 passages
         ──► log query; weak match → knowledge gap
         ──► stream: evidence part ─► reading card ─► LLM answer with [n] / [Wn] citations + tool calls ─► cards
             (tools: eligibility, cost, compare, dates, checklist, campus map, knowledge gap, official-site search)
```

- **Chunking.** Markdown-aware: sections follow headings, the heading path is kept as the chunk label, tables are never split, and long prose is split by sentence with overlap. Chunks are embedded together with their document title and heading.
- **Fusion.** Reciprocal rank fusion (k = 60), with keyword ranks weighted 0.7.
- **Confidence.** Comes from the best cosine similarity: high ≥ 0.72, medium ≥ 0.64, otherwise low.
- **Gap clustering.** Questions are reduced to their topic words ("swimming pool"), embedded, and grouped by online clustering (cosine ≥ 0.81). Comparing whole sentences didn't work: "Is there a swimming pool on campus?" scored closer to "Is there a gym on campus?" than to a rephrasing of the pool question.
- **One source of truth for numbers.** The fee, scholarship, calendar, contact, document-checklist and campus-map documents are generated from `data/structured/*.json` and `src/lib/campus-map.ts`. The calculators, the receipt audit and the router read the same data, so cited text and card numbers can't disagree.
- **Rupees the model can't mangle.** Tool results reach the model with every amount already written out ("Rs 10,99,000 (Rs 10.99 lakh)") through `toModelOutput`. The cards still get the raw numbers.
- **Citations across models.** Gemini cites `[2]`; gpt-oss writes `【2】`. Both are normalised before linking.

## Retrieval evaluation

`npm run eval` scores 42 questions against an expected section (not just the right document), using top-5 retrieval:

| Mode | hit@1 | hit@5 | MRR |
|---|---|---|---|
| Keyword (FTS5 BM25) | 81.0% | 97.6% | 0.881 |
| Semantic (bge-small + sqlite-vec) | 88.1% | 100% | 0.933 |
| **Hybrid (weighted RRF)** | **88.1%** | **100%** | **0.933** |

On the six off-corpus questions, the confidence threshold flags 4 as low. "Swimming pool" still scores 0.73, because it sits close to the sports-facilities section. That is why there is a second gap signal: the model calls `flagKnowledgeGap` when the passages don't answer the question.

## Testing

- **Unit tests** (`npm test`, Vitest, 163 tests):
  - chunker, calculators, retrieval fusion, gap clustering, calendar export and formatting (including the pre-written rupee figures the model is given)
  - campus routing and place matching, the official-domain allowlist, snippet cleaning, site names for logos, reading parsing, the PCM aggregate and the fee-receipt audit
  - memory: facts from tool inputs and readings, the store (changes only, capped notes, per-browser, off switch) and chat history (attachments by name, no cross-browser access)
  - the chat route with scripted models: map directions reach the model without the geometry, an attached receipt is read and audited and the image never reaches the answering model, web-answered questions aren't filed as gaps, and details remembered in one chat reach the model in the next
  - Hinglish detection, citation normalising and provider fallback
  - the chat route end to end with a scripted model
- **Browser tests** (`npm run test:e2e`, Playwright in the installed Chrome). They run against a production build with a freshly seeded database, using the real LLM:
  - **API contracts**
  - **Chat:**
    - a cost question checked down to the Rs 10,99,000 total
    - citations that jump to their passage
    - pinning and `.ics` export
    - eligibility, a follow-up with context, Hindi and Hinglish
    - deep links from the landing page
  - **Knowledge-gap loop:** an unanswerable question is flagged, a staff member answers it on `/admin`, and the same question is then answered from the new FAQ.
  - **New features:** the campus map for an office, a fee-receipt photo checked line by line (`e2e/fixtures/fee-receipt.png`, a made-up receipt with one overcharge and a wrong total), official-site search (skipped without a Tavily key), and memory carrying into a new chat plus reopening a saved chat.
  - **Admin:** document upload and delete
  - **Phone layout**
  - **Light and dark captures:** no console errors and no sideways scrolling. Screenshots land in `e2e-screens/`.
- **Answer quality** (`npm run eval:answers`, needs the dev server running): 16 questions, each scored on four things — it called the right tool, it gave the key facts, its citations point at real passages, and it stayed grounded (or flagged a gap). The script uses its own session and deletes its rows from the database afterwards.
  - **Last run:** the free quotas ran out part-way (Gemini's free tier allows 20 requests a day), so 10 of the 16 questions came back with the quota message instead of an answer.
  - **The 6 that were answered:** 5 passed. Tool choice was 5/5, key facts 2/3, citations 3/3 and grounding 5/6. Median answer time was 25.7 s, on the Groq fallback.
  - **The failure was worth finding.** One cost answer wrote the total as Rs 1,09,90,000 instead of Rs 10,99,000: the model regrouped a raw integer the Indian way and slipped a digit. The calculators now hand the model every rupee figure already written out ("Rs 10,99,000 (Rs 10.99 lakh)") through the tool's `toModelOutput`, and the prompt says to copy them exactly. The card still gets the raw numbers. This fix hasn't yet been re-run against a live model.

## Project layout

```
data/corpus/          14 handwritten handbook documents (Markdown + frontmatter)
data/structured/      programmes, cutoffs, fees, hostel, scholarships, dates, contacts (JSON)
data/college.db       generated SQLite database (gitignored)
scripts/              seed, ensure-db (predev), eval-retrieval + eval-set.json, eval-answers
src/lib/              db + schema, embeddings, chunker, ingest, retrieval, calculators, tools,
                      prompts, gaps, plan, ics, language detection, citations, LLM providers + fallback
src/app/              landing (/), chat (/chat), admin (/admin), api/*
src/components/       landing, chat workspace, answer cards, sources panel, plan board, admin,
                      art (SVG illustrations), reactbits (vendored)
tests/                unit tests        e2e/      Playwright browser tests
```

To use a real college, replace the files in `data/corpus` and `data/structured` (same shapes), rename it in `src/lib/college.ts`, and run `npm run seed -- --fresh`.

## Windows note: native packages

Turbopack links native packages with directory junctions, which some drives refuse (`os error 1392`). `src/lib/native.ts` loads SQLite, sqlite-vec and the embedding runtime through Node directly, so the dev server runs on those drives too. `npm run dev:webpack` remains as a fallback.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, Vercel AI SDK 7 (`@ai-sdk/google`, `@ai-sdk/groq`), better-sqlite3, sqlite-vec, SQLite FTS5, @huggingface/transformers, unpdf, GSAP, Lenis, Motion, React Bits, Phosphor Icons, Vitest, Playwright.

React Bits components are © David Haz, MIT + Commons Clause.
