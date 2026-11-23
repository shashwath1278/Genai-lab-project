import { describe, expect, it } from "vitest";
import { linkCitations } from "../src/components/chat/AnswerMarkdown";
import { normalizeCitations } from "../src/lib/citations";

describe("normalizeCitations", () => {
  it("turns gpt-oss style markers into [n]", () => {
    expect(normalizeCitations("Fee is Rs 2,25,000【1】.")).toBe("Fee is Rs 2,25,000[1].");
    expect(normalizeCitations("See 【2†L3-L5】 and 【3】")).toBe("See [2] and [3]");
    expect(normalizeCitations("Plain [1] stays")).toBe("Plain [1] stays");
  });

  it("drops bracketed tool names that aren't passages", () => {
    expect(normalizeCitations("Total is Rs 10,99,000 【estimateCost】.")).toBe("Total is Rs 10,99,000.");
    expect(normalizeCitations("Fee 【1】 and 【tool:compare】")).toBe("Fee [1] and");
  });
});

describe("linkCitations", () => {
  it("links only citations that match a retrieved passage", () => {
    expect(linkCitations("A [1] and B【2】 and C [9]", [{ n: 1 }, { n: 2 }])).toBe("A [1](#cite-1) and B[2](#cite-2) and C [9]");
  });
});
