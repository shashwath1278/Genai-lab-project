import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAdmissionChecklist,
  CalcError,
  checkEligibility,
  comparePrograms,
  estimateCost,
  findProgram,
  getImportantDates,
  suggestContact,
} from "../src/lib/calculators";
import { loadCollegeDataFromJson } from "../src/lib/college-data";

const data = loadCollegeDataFromJson(path.join(__dirname, "..", "data", "structured"));

describe("findProgram", () => {
  it("accepts codes, aliases and names", () => {
    expect(findProgram(data, "aiml").code).toBe("AIML");
    expect(findProgram(data, "AI & ML").code).toBe("AIML");
    expect(findProgram(data, "mechanical").code).toBe("ME");
    expect(findProgram(data, "Computer Science & Engineering").code).toBe("CSE");
  });

  it("throws a CalcError listing valid codes", () => {
    expect(() => findProgram(data, "astronomy")).toThrow(CalcError);
  });
});

describe("checkEligibility", () => {
  it("rank inside last year's closing rank is likely, with alternatives", () => {
    const r = checkEligibility(data, { program: "AIML", exam: "KCET", aggregatePercent: 78, rank: 12000 });
    expect(r.verdict).toBe("likely");
    expect(r.cutoff?.forCategory).toBe(13000);
    expect(r.alternatives.map((a) => a.code)).toEqual(expect.arrayContaining(["ISE", "ECE"]));
    expect(r.alternatives.map((a) => a.code)).not.toContain("CSE");
  });

  it("just outside the closing rank is borderline, far outside is unlikely", () => {
    expect(checkEligibility(data, { program: "AIML", exam: "KCET", aggregatePercent: 78, rank: 14000 }).verdict).toBe("borderline");
    expect(checkEligibility(data, { program: "AIML", exam: "KCET", aggregatePercent: 78, rank: 30000 }).verdict).toBe("unlikely");
  });

  it("applies category relaxation to ranks and minimum aggregate", () => {
    const obc = checkEligibility(data, { program: "AIML", exam: "KCET", category: "OBC", aggregatePercent: 42, rank: 18000 });
    expect(obc.cutoff?.forCategory).toBe(19500);
    expect(obc.verdict).toBe("likely");
    expect(checkEligibility(data, { program: "AIML", exam: "KCET", aggregatePercent: 42, rank: 1000 }).verdict).toBe("not-eligible");
  });

  it("uses percentiles for JEE Main", () => {
    expect(checkEligibility(data, { program: "CSE", exam: "JEE Main", aggregatePercent: 85, percentile: 93 }).verdict).toBe("likely");
    expect(checkEligibility(data, { program: "CSE", exam: "JEE Main", aggregatePercent: 85, percentile: 90.5 }).verdict).toBe("borderline");
    expect(checkEligibility(data, { program: "CSE", exam: "jee mains", aggregatePercent: 85, percentile: 80 }).verdict).toBe("unlikely");
  });

  it("rejects an exam the programme doesn't accept", () => {
    const r = checkEligibility(data, { program: "CSE", exam: "GATE", aggregatePercent: 80, score: 600 });
    expect(r.verdict).toBe("not-eligible");
    expect(r.acceptedExams).toEqual(["KCET", "COMEDK", "JEE Main", "Management"]);
  });

  it("asks for the rank when it's missing", () => {
    expect(checkEligibility(data, { program: "ECE", exam: "COMEDK", aggregatePercent: 70 }).verdict).toBe("needs-info");
  });
});

describe("estimateCost", () => {
  it("adds tuition, annual fees, hostel, default mess and one-time fees", () => {
    const e = estimateCost(data, { program: "CSE", exam: "KCET", hostel: "TRIPLE" });
    expect(e.years).toHaveLength(4);
    expect(e.years[0].total).toBe(110000 + 18000 + 85000 + 48000);
    expect(e.totals.oneTime).toBe(25000 + 10000 + 5000 + 15000);
    expect(e.totals.grand).toBe(4 * 261000 + 55000);
    expect(e.totals.refundableDeposits).toBe(25000);
    expect(e.assumptions.some((a) => /mess plan/i.test(a))).toBe(true);
  });

  it("applies a scholarship only where its rules allow", () => {
    expect(estimateCost(data, { program: "CSE", exam: "KCET", scholarship: "MERIT50" }).totals.scholarship).toBe(-4 * 55000);
    const comedk = estimateCost(data, { program: "CSE", exam: "COMEDK", scholarship: "MERIT50" });
    expect(comedk.totals.scholarship).toBe(0);
    expect(comedk.choices.scholarship).toBeNull();
    expect(estimateCost(data, { program: "CSE", scholarship: "WICE15" }).totals.scholarship).toBe(0);
    expect(estimateCost(data, { program: "ME", scholarship: "WICE15" }).years[0].scholarship).toBe(-16500);
  });

  it("defaults to the first route and caps years at the programme length", () => {
    const e = estimateCost(data, { program: "MBA", years: 9 });
    expect(e.route.exam).toBe("PGCET");
    expect(e.years).toHaveLength(2);
  });
});

describe("comparePrograms", () => {
  it("compares unique programmes and marks the best values", () => {
    const r = comparePrograms(data, ["CSE", "ECE", "cse"]);
    expect(r.programs.map((p) => p.code)).toEqual(["CSE", "ECE"]);
    expect(r.best.placementRate).toBe("CSE");
    expect(r.best.lowestFee).toBeUndefined(); // same KCET fee: a tie gets no badge
    expect(comparePrograms(data, ["MBA", "MCA"]).best.lowestFee).toBe("MCA");
  });

  it("needs two different programmes", () => {
    expect(() => comparePrograms(data, ["CSE", "cse"])).toThrow(CalcError);
  });
});

describe("getImportantDates", () => {
  it("marks ongoing and upcoming dates and hides past ones", () => {
    const r = getImportantDates(data, { today: "2026-10-28" });
    const cie = r.items.find((i) => i.title.startsWith("Mid-semester"));
    expect(cie?.status).toBe("ongoing");
    expect(r.items.every((i) => i.status !== "past")).toBe(true);
    expect(r.items.find((i) => i.title.includes("exam fee"))?.daysUntil).toBe(9);
  });

  it("filters by category", () => {
    const r = getImportantDates(data, { category: "admissions", today: "2026-10-28" });
    expect(r.items.every((i) => i.category === "admissions")).toBe(true);
  });
});

describe("buildAdmissionChecklist", () => {
  it("counselling routes get counselling steps and keep the scorecard", () => {
    const r = buildAdmissionChecklist(data, { program: "CSE", exam: "KCET", today: "2026-10-28" });
    expect(r.steps[0].title).toMatch(/KCET/);
    expect(r.documents.some((d) => /scorecard/i.test(d.name))).toBe(true);
    expect(r.deadlines.some((d) => /management quota/i.test(d.title))).toBe(false);
    expect(r.feeDueAtAdmission).toBe(25000 + 10000 + 110000);
  });

  it("management admissions skip the entrance scorecard", () => {
    const r = buildAdmissionChecklist(data, { program: "CSE", exam: "Management", today: "2026-10-28" });
    expect(r.documents.some((d) => /scorecard/i.test(d.name))).toBe(false);
    expect(r.steps[0].title).toMatch(/portal/);
  });
});

describe("suggestContact", () => {
  it("routes by topic", () => {
    expect(suggestContact(data, "where do I get my hall ticket and revaluation")?.office).toBe("Examination Section");
    expect(suggestContact(data, "zzz")?.office).toBe("Admissions Office");
  });
});
