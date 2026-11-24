import { describe, expect, it } from "vitest";
import { quotedAnswer, verifyQuotes } from "../src/lib/quotes";

const results = [
  { id: "W1", title: "Placements", url: "https://reddit.com/1", domain: "reddit.com", site: "Reddit", favicon: null, published: null, snippet: "Top Comments. - overall median for last yr was 8 lakh. - Can I get a job?" },
];

describe("quotes from posts", () => {
  it("keeps only words that are really there", () => {
    const reply = JSON.stringify([
      { id: "W1", quote: "Overall median for last yr was 8 lakh." },
      { id: "W1", quote: "companies like IBM and Apple visit" }, // invented
      { id: "W1", quote: "Can I get a job?" }, // a question
      { id: "W9", quote: "overall median for last yr was 8 lakh" }, // no such result
    ]);
    expect(verifyQuotes("Sure: " + reply, results)).toEqual([{ id: "W1", quote: "Overall median for last yr was 8 lakh." }]);
    expect(verifyQuotes("not json", results)).toEqual([]);
    expect(quotedAnswer("Reddit", [])).toMatch(/don't really answer this/);
  });
});
