import { describe, expect, it } from "vitest";
import { chunkMarkdown, parseFrontmatter } from "../src/lib/chunker";

const words = (n: number, w = "word") => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");

describe("parseFrontmatter", () => {
  it("reads scalars and lists and strips the block", () => {
    const { data, body } = parseFrontmatter("---\ntitle: Hostel Life\naudience: [prospective, parent]\n---\n# Body");
    expect(data).toEqual({ title: "Hostel Life", audience: ["prospective", "parent"] });
    expect(body).toBe("# Body");
  });

  it("returns the input unchanged without frontmatter", () => {
    expect(parseFrontmatter("# Just text").body).toBe("# Just text");
  });
});

describe("chunkMarkdown", () => {
  it("labels chunks with the heading path below the H1 title", () => {
    const chunks = chunkMarkdown("# Doc\n\nIntro text.\n\n## Fees\n\n### Hostel\n\nRoom costs money.");
    expect(chunks.map((c) => c.heading)).toEqual(["Overview", "Fees › Hostel"]);
    expect(chunks[1].text).toBe("Room costs money.");
  });

  it("skips headings with no body", () => {
    const chunks = chunkMarkdown("## Empty\n\n## Full\n\nSomething here.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Full");
  });

  it("keeps a table in one chunk even when it is longer than the target", () => {
    const rows = Array.from({ length: 60 }, (_, i) => `| row ${i} | ${words(6)} |`).join("\n");
    const chunks = chunkMarkdown(`## Table\n\n| a | b |\n|---|---|\n${rows}`, { targetWords: 50, maxWords: 80 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.split("\n")).toHaveLength(62);
  });

  it("splits long prose by sentence and carries the last sentence over", () => {
    const sentences = Array.from({ length: 30 }, (_, i) => `Sentence ${i} ${words(8, `s${i}w`)}.`).join(" ");
    const chunks = chunkMarkdown(`## Long\n\n${sentences}`, { targetWords: 60, maxWords: 80, overlapWords: 15 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.text.split(/\s+/).length).toBeLessThanOrEqual(80);
    const lastOfFirst = chunks[0].text.split(/(?<=\.)\s/).at(-1)!;
    expect(chunks[1].text.startsWith(lastOfFirst)).toBe(true);
  });

  it("keeps a list item and its continuation line together", () => {
    const chunks = chunkMarkdown("## Rules\n\n- First rule\n  continues here\n- Second rule\n\nAfter the list.");
    expect(chunks[0].text).toContain("- First rule\n  continues here\n- Second rule");
  });
});
