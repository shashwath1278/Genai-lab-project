export type Chunk = { heading: string; text: string };

export type ChunkOptions = {
  /** Aim for chunks around this many words. */
  targetWords?: number;
  /** Prose blocks longer than this are split by sentence. Tables are never split. */
  maxWords?: number;
  /** A trailing block this short is repeated at the start of the next chunk. */
  overlapWords?: number;
};

export type Frontmatter = Record<string, string | string[]>;

/** Minimal YAML-ish frontmatter: `key: value` and `key: [a, b]`. */
export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim();
    const list = value.match(/^\[(.*)\]$/);
    data[kv[1]] = list
      ? list[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : value.replace(/^["']|["']$/g, "");
  }
  return { data, body: raw.slice(match[0].length) };
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

type Block = { text: string; words: number; table: boolean };

function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  let kind: "table" | "list" | "para" | null = null;

  const flush = () => {
    const text = current.join("\n").trim();
    if (text) blocks.push({ text, words: wordCount(text), table: kind === "table" });
    current = [];
    kind = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Blank lines end paragraphs, but lists and tables may continue after one.
      if (kind === "para") flush();
      continue;
    }
    const lineKind = trimmed.startsWith("|") ? "table" : /^([-*+]|\d+[.)])\s/.test(trimmed) ? "list" : "para";
    // An indented line or a plain line straight after a list item continues that item.
    const continuesList = kind === "list" && lineKind === "para" && /^\s+/.test(line);
    if (kind && lineKind !== kind && !continuesList) flush();
    if (!continuesList) kind = lineKind;
    current.push(line);
  }
  flush();
  return blocks;
}

function splitLongProse(block: Block, target: number, overlap: number): Block[] {
  const sentences = block.text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [block.text];
  const out: Block[] = [];
  let buf: string[] = [];
  let words = 0;
  for (const s of sentences) {
    const w = wordCount(s);
    if (words + w > target && buf.length) {
      out.push({ text: buf.join("").trim(), words, table: false });
      // Carry the last sentence(s) forward, up to `overlap` words.
      const carry: string[] = [];
      let carried = 0;
      for (let i = buf.length - 1; i >= 0 && carried + wordCount(buf[i]) <= overlap; i--) {
        carry.unshift(buf[i]);
        carried += wordCount(buf[i]);
      }
      buf = carry;
      words = carried;
    }
    buf.push(s);
    words += w;
  }
  if (buf.length) out.push({ text: buf.join("").trim(), words, table: false });
  return out;
}

/**
 * Markdown-aware chunking: sections follow headings (the heading path is kept
 * as the chunk's label), blocks inside a section are packed up to the target
 * size, tables stay whole and very long prose is split by sentence.
 */
export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): Chunk[] {
  const target = options.targetWords ?? 220;
  const max = options.maxWords ?? 320;
  const overlap = options.overlapWords ?? 45;

  type Section = { path: string[]; lines: string[] };
  const sections: Section[] = [];
  const stack: string[] = [];
  let current: Section = { path: [], lines: [] };

  for (const line of markdown.split(/\r?\n/)) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      sections.push(current);
      const level = h[1].length;
      // H1 is the document title; it isn't part of the heading path.
      if (level === 1) stack.length = 0;
      else {
        stack.length = Math.max(0, level - 2);
        stack[level - 2] = h[2];
      }
      current = { path: stack.filter(Boolean), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const heading = section.path.join(" › ") || "Overview";
    const blocks = toBlocks(section.lines).flatMap((b) =>
      !b.table && b.words > max ? splitLongProse(b, target, overlap) : [b],
    );
    if (!blocks.length) continue;

    let buf: Block[] = [];
    let words = 0;
    for (const block of blocks) {
      // Don't flush a tiny buffer just because the next block is big; keep them together.
      if (buf.length && words + block.words > target && words >= target * 0.35) {
        chunks.push({ heading, text: buf.map((b) => b.text).join("\n\n") });
        const last = buf[buf.length - 1];
        buf = !last.table && last.words <= overlap ? [last] : [];
        words = buf.reduce((n, b) => n + b.words, 0);
      }
      buf.push(block);
      words += block.words;
    }
    if (buf.length) chunks.push({ heading, text: buf.map((b) => b.text).join("\n\n") });
  }
  return chunks;
}
