import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCollegeDataFromJson } from "../src/lib/college-data";
import { auditFeeReceipt, finishReading, parseReading, pcmPercent } from "../src/lib/reading";

const data = loadCollegeDataFromJson(path.join(process.cwd(), "fixtures", "northgate", "structured"));

describe("parseReading", () => {
  it("pulls the JSON out of a chatty, fenced reply and coerces types", () => {
    const r = parseReading(`<think>hmm</think>Here you go:\n\`\`\`json
{"kind":"marksheet","title":"2nd PUC marks card","summary":"PUC results.",
 "marks":{"subjects":[{"name":"Physics","obtained":"88","max":100},{"name":"Chemistry","obtained":82,"max":"100"},{"name":"Mathematics","obtained":92,"max":100},{"name":"English","obtained":null,"max":100}],"aggregatePercent":"86.5%"},
 "exam":null,"fees":null,"dates":[{"title":"Revaluation","date":"2027-05-02","endDate":"soon"},{"title":"bad","date":"May 3"}],"unclear":""}
\`\`\``)!;
    expect(r.kind).toBe("marksheet");
    expect(r.marks?.subjects).toHaveLength(3); // the unreadable English mark is dropped
    expect(r.marks?.aggregatePercent).toBe(86.5);
    expect(r.dates).toEqual([{ title: "Revaluation", date: "2027-05-02", endDate: null }]);
    expect(r.unclear).toBeNull();
    expect(pcmPercent(r)).toBe(87.33);
  });

  it("treats unknown kinds as 'other' and rejects non-JSON", () => {
    expect(parseReading('{"kind":"passport","title":"x"}')?.kind).toBe("other");
    expect(parseReading("I can't read this image.")).toBeNull();
  });
});

describe("auditFeeReceipt", () => {
  it("passes a correct CSE COMEDK receipt and checks the arithmetic", () => {
    const a = auditFeeReceipt(data, {
      program: "B.E. Computer Science & Engineering",
      quota: "COMEDK",
      total: 393000,
      lines: [
        { label: "Tuition fee", amount: 225000 },
        { label: "Exam, lab & library fees", amount: 18000 },
        { label: "Hostel - double room (non-AC)", amount: 105000 },
        { label: "Mess charges (Mixed)", amount: 56000 },
        { label: "Hostel caution deposit", amount: 15000 },
      ],
    });
    expect(a.program).toBe("CSE");
    expect(a.lines.map((l) => l.status)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(a.linesTotal).toBe(419000);
    expect(a.totalMatches).toBe(false); // the printed total is wrong
    expect(a.verdict).toBe("mismatch");
  });

  it("flags an overcharged line against the closest official amount", () => {
    const a = auditFeeReceipt(data, { program: "AIML", quota: "KCET", total: 135000, lines: [{ label: "Tuition", amount: 110000 }, { label: "Library & lab fee", amount: 25000 }] });
    expect(a.lines[0]).toMatchObject({ status: "ok", official: 110000 });
    expect(a.lines[1]).toMatchObject({ status: "higher", official: 18000 });
    expect(a.lines[1].note).toMatch(/Rs 7,000 more than the official exam, lab, library/);
    expect(a.totalMatches).toBe(true);
    expect(a.verdict).toBe("mismatch");
  });

  it("keeps hostel deposits apart from the course caution deposit", () => {
    const a = auditFeeReceipt(data, { program: null, quota: null, total: null, lines: [{ label: "Caution deposit", amount: 10000 }, { label: "Hostel caution deposit", amount: 15000 }] });
    expect(a.lines.map((l) => [l.matched, l.status])).toEqual([
      ["Caution deposit (refunded after course completion)", "ok"],
      ["Hostel caution deposit (refundable)", "ok"],
    ]);
    expect(a.verdict).toBe("all-match");
  });

  it("can't check tuition without a programme, and marks unknown items", () => {
    const a = auditFeeReceipt(data, { program: null, quota: null, total: null, lines: [{ label: "Tuition", amount: 225000 }, { label: "Convenience charge", amount: 500 }] });
    expect(a.lines.map((l) => l.status)).toEqual(["unknown", "unknown"]);
    expect(a.verdict).toBe("unclear");
  });
});

describe("finishReading", () => {
  it("audits receipts only", () => {
    const receipt = parseReading('{"kind":"fee_receipt","title":"Fee receipt","summary":"","fees":{"lines":[{"label":"Admission fee","amount":"25,000"}],"total":25000,"program":"CSE","quota":null},"dates":[]}')!;
    expect(finishReading(data, "r.jpg", "image/jpeg", receipt).audit?.verdict).toBe("all-match");
    const notice = parseReading('{"kind":"notice","title":"Exam notice","summary":"","dates":[{"title":"Exam fee last date","date":"2026-12-05"}]}')!;
    expect(finishReading(data, "n.png", "image/png", notice).audit).toBeNull();
  });
});
