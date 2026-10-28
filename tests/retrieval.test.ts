import { describe, expect, it } from "vitest";
import { CONFIDENCE_THRESHOLDS, confidenceFor, queryTerms, reciprocalRankFusion } from "../src/lib/retrieval";

describe("reciprocalRankFusion", () => {
  it("rewards ids that rank well in both lists", () => {
    const scores = reciprocalRankFusion([
      [1, 2, 3],
      [3, 1, 4],
    ]);
    const order = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    expect(order[0]).toBe(1);
    expect(order.indexOf(3)).toBeLessThan(order.indexOf(2));
    expect(scores.get(4)).toBeCloseTo(1 / 63);
  });

  it("weights lists", () => {
    const scores = reciprocalRankFusion([[1], [2]], [1, 0.5]);
    expect(scores.get(1)).toBeCloseTo(2 * scores.get(2)!);
  });
});

describe("queryTerms", () => {
  it("drops stopwords and duplicates, keeps numbers", () => {
    expect(queryTerms("What is the fee for the CSE hostel? fee 2 2026")).toEqual(["fee", "cse", "hostel", "2", "2026"]);
  });
});

describe("confidenceFor", () => {
  it("maps similarity to levels", () => {
    expect(confidenceFor(CONFIDENCE_THRESHOLDS.high)).toBe("high");
    expect(confidenceFor(CONFIDENCE_THRESHOLDS.medium)).toBe("medium");
    expect(confidenceFor(CONFIDENCE_THRESHOLDS.medium - 0.01)).toBe("low");
  });
});
