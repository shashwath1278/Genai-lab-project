import fs from "node:fs";
import path from "node:path";
import { CONFIDENCE_THRESHOLDS, retrieve, type RetrievalMode } from "../src/lib/retrieval";

// Retrieval quality check that needs no LLM key: does the right document come
// back, and do off-corpus questions score low enough to be flagged as gaps?

type EvalSet = { answerable: { q: string; expect: string[] }[]; unanswerable: string[] };
const set: EvalSet = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", "eval-set.json"), "utf8"));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** "doc-slug#heading part" matches a passage from that doc whose heading contains the part. */
function matches(target: string, p: { docSlug: string; heading: string }) {
  const [slug, section] = target.split("#");
  return p.docSlug === slug && (!section || p.heading.toLowerCase().includes(section.toLowerCase()));
}

async function main() {
  const modes: RetrievalMode[] = ["keyword", "semantic", "hybrid"];
  const misses: string[] = [];
  const n = set.answerable.length;
  console.log(`\n${n} answerable questions, top-5 retrieval, scored at section level\n`);
  console.log("mode       hit@1    hit@5    MRR     doc hit@1");
  for (const mode of modes) {
    let hit1 = 0;
    let hit5 = 0;
    let rr = 0;
    let docHit1 = 0;
    for (const item of set.answerable) {
      const { passages } = await retrieve(item.q, { mode, k: 5 });
      const rank = passages.findIndex((p) => item.expect.some((t) => matches(t, p)));
      if (passages[0] && item.expect.some((t) => t.split("#")[0] === passages[0].docSlug)) docHit1++;
      if (rank === 0) hit1++;
      if (rank >= 0) {
        hit5++;
        rr += 1 / (rank + 1);
      } else if (mode === "hybrid") {
        misses.push(`  "${item.q}"\n     expected ${item.expect.join(" | ")}\n     got      ${passages.slice(0, 3).map((p) => `${p.docSlug}#${p.heading}`).join(" | ")}`);
      }
    }
    console.log(`${mode.padEnd(10)} ${pct(hit1 / n).padStart(6)}   ${pct(hit5 / n).padStart(6)}   ${(rr / n).toFixed(3)}   ${pct(docHit1 / n).padStart(6)}`);
  }
  if (misses.length) console.log("\nhybrid misses:\n" + misses.join("\n"));

  // Confidence calibration on the top semantic similarity.
  const answerable = await Promise.all(set.answerable.map(async (i) => (await retrieve(i.q)).topSimilarity));
  const offCorpus = await Promise.all(set.unanswerable.map(async (q) => ({ q, s: (await retrieve(q)).topSimilarity })));
  const sorted = [...answerable].sort((a, b) => a - b);
  console.log(`\ntop similarity, answerable:   min ${sorted[0].toFixed(3)}  p10 ${sorted[Math.floor(sorted.length * 0.1)].toFixed(3)}  median ${sorted[Math.floor(sorted.length / 2)].toFixed(3)}`);
  console.log("top similarity, off-corpus:");
  for (const { q, s } of offCorpus) console.log(`  ${s.toFixed(3)}  ${q}`);
  const low = (s: number) => s < CONFIDENCE_THRESHOLDS.medium;
  console.log(
    `\nthresholds high>=${CONFIDENCE_THRESHOLDS.high} medium>=${CONFIDENCE_THRESHOLDS.medium}: ` +
      `${answerable.filter(low).length}/${answerable.length} answerable flagged low, ` +
      `${offCorpus.filter((o) => low(o.s)).length}/${offCorpus.length} off-corpus flagged low`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
