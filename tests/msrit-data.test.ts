import { describe, expect, it } from "vitest";
import { buildAdmissionChecklist, checkEligibility, estimateCost, suggestContact } from "../src/lib/calculators";
import { loadCollegeDataFromJson } from "../src/lib/college-data";
import { renderGeneratedDocs } from "../src/lib/render-docs";

// The real college's data: figures from the 2026-27 fee notices, and nothing invented.
const data = loadCollegeDataFromJson();

describe("MSRIT data", () => {
  it("matches the official first-year fees", () => {
    const fee = (code: string, exam: string) => data.programs.find((p) => p.code === code)!.routes.find((r) => r.exam === exam)!.feePerYear;
    expect([fee("CSE", "KCET"), fee("CSE", "COMEDK"), fee("BARCH", "KCET"), fee("MBA", "PGCET"), fee("MCA", "Management"), fee("MTECH-CSE", "PGCET")]).toEqual([140820, 354820, 142570, 90050, 314300, 108600]);
  });

  it("estimates four years from the published notices, and says what's left out", () => {
    const e = estimateCost(data, { program: "CSE", exam: "KCET" });
    expect(e.totals.grand).toBe(140820 + 3 * 126020);
    expect(e.assumptions.join(" ")).toMatch(/Hostel, mess and transport are not included/);
  });

  it("uses real cutoffs, and doesn't guess category ones", () => {
    expect(checkEligibility(data, { program: "CSE", exam: "KCET", rank: 1800, aggregatePercent: 90 })).toMatchObject({ verdict: "likely", note: expect.stringMatching(/KCET 2025 round 3/) });
    expect(checkEligibility(data, { program: "AIML", exam: "KCET", rank: 12000, aggregatePercent: 85 }).verdict).toBe("unlikely");
    expect(checkEligibility(data, { program: "CSE", exam: "KCET", rank: 5000, aggregatePercent: 85, category: "OBC" }).verdict).toBe("needs-info");
    expect(checkEligibility(data, { program: "ISE", exam: "COMEDK", rank: 1500, aggregatePercent: 85 }).verdict).toBe("needs-info");
  });

  it("gives real offices, and no invented fees or steps", () => {
    expect(suggestContact(data, "placement companies")!.email).toBe("placement@msrit.edu");
    const c = buildAdmissionChecklist(data, { program: "CSE", exam: "KCET", today: "2026-11-24" });
    expect(c.contact?.email).toBe("admn@msrit.edu");
    expect(JSON.stringify(c.steps)).not.toMatch(/Rs 0|caution|portal/i);
  });

  it("has nothing left from the made-up college", () => {
    const text = JSON.stringify(data) + renderGeneratedDocs(data).map((d) => d.content).join("\n");
    expect(text).not.toMatch(/northgate|ngit|example\.edu|undefined|NaN/i);
  });
});
