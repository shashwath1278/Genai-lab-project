import { describe, expect, it } from "vitest";
import { cosine } from "../src/lib/embeddings";
import { formatDateRange, formatINR, formatLakh, moneyForModel } from "../src/lib/format";
import { gapTopic, mergeCentroid, nearestCluster } from "../src/lib/gaps";
import { buildIcs } from "../src/lib/ics";

const unit = (...v: number[]) => {
  const n = Math.hypot(...v);
  return new Float32Array(v.map((x) => x / n));
};

describe("gap clustering", () => {
  it("reduces a question to its topic words", () => {
    expect(gapTopic("Is there a swimming pool on campus?")).toBe("swimming pool");
    expect(gapTopic("Can students use a swimming pool at Northgate?")).toBe("swimming pool");
    expect(gapTopic("Is there a course like MBBS?")).toBe("mbbs");
    expect(gapTopic("Is there?")).toBe("Is there?");
  });

  it("joins the most similar cluster above the threshold, else none", () => {
    const clusters = [
      { id: 1, centroid: unit(1, 0, 0) },
      { id: 2, centroid: unit(0.9, 0.1, 0) },
    ];
    expect(nearestCluster(unit(0.85, 0.15, 0), clusters, 0.8)?.id).toBe(2);
    expect(nearestCluster(unit(0, 0, 1), clusters, 0.8)).toBeNull();
  });

  it("moves the centroid toward the new member and keeps it unit length", () => {
    const merged = mergeCentroid(unit(1, 0), 3, unit(0, 1));
    expect(Math.hypot(...merged)).toBeCloseTo(1);
    expect(cosine(merged, unit(0, 1))).toBeGreaterThan(0);
    expect(cosine(merged, unit(1, 0))).toBeGreaterThan(cosine(merged, unit(0, 1)));
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(
    [
      { uid: "a@x", title: "Exam fee, last date; pay online", date: "2026-11-30", description: "Late fee applies.\nNo registrations after." },
      { uid: "b@x", title: "A".repeat(120), date: "2026-12-31" },
    ],
    { now: new Date("2026-10-28T10:00:00Z") },
  );

  it("uses CRLF and all-day dates that roll over months and years", () => {
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("DTSTAMP:20261028T100000Z");
  });

  it("escapes text and folds long lines", () => {
    expect(ics).toContain("SUMMARY:Exam fee\\, last date\\; pay online");
    expect(ics).toContain("DESCRIPTION:Late fee applies.\\nNo registrations after.");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});

describe("format", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(1099000)).toBe("Rs 10,99,000");
    expect(formatLakh(1099000)).toBe("Rs 10.99 lakh");
    expect(formatLakh(250000)).toBe("Rs 2.5 lakh");
    expect(formatLakh(48000)).toBe("Rs 48,000");
  });

  it("pre-writes rupee figures for the model, leaving other numbers alone", () => {
    const out = moneyForModel({
      years: [{ year: 1, tuition: 225000, scholarship: -55000, total: 274750 }],
      oneTime: [{ name: "Caution", amount: 10000, refundable: true }],
      totals: { grand: 1099000, oneTime: 10000 },
      program: { durationYears: 4 },
      choices: { hostel: "Triple room" },
    });
    expect(out).toEqual({
      years: [{ year: 1, tuition: "Rs 2,25,000 (Rs 2.25 lakh)", scholarship: "Rs -55,000", total: "Rs 2,74,750 (Rs 2.75 lakh)" }],
      oneTime: [{ name: "Caution", amount: "Rs 10,000", refundable: true }],
      totals: { grand: "Rs 10,99,000 (Rs 10.99 lakh)", oneTime: "Rs 10,000" },
      program: { durationYears: 4 },
      choices: { hostel: "Triple room" },
    });
  });

  it("formats ranges compactly", () => {
    expect(formatDateRange("2026-12-07", "2026-12-24")).toBe("7–24 Dec 2026");
    expect(formatDateRange("2026-12-26", "2027-01-03")).toBe("26 Dec 2026 – 3 Jan 2027");
    expect(formatDateRange("2026-11-06", null)).toBe("6 Nov 2026");
  });
});
