import { describe, expect, it } from "vitest";
import { dependsOnHistory, hasNonAscii, looksHinglish } from "../src/lib/language";

describe("looksHinglish", () => {
  it("spots romanized Hindi questions", () => {
    expect(looksHinglish("hostel ka fees kitna hai")).toBe(true);
    expect(looksHinglish("CSE mein admission kaise milega?")).toBe(true);
    expect(looksHinglish("Kya library raat ko khuli rehti hai")).toBe(true);
  });

  it("leaves English questions alone", () => {
    expect(looksHinglish("What is the hostel fee?")).toBe(false);
    expect(looksHinglish("Is there a gym on campus?")).toBe(false);
    expect(looksHinglish("Compare CSE, AIML and ECE")).toBe(false);
    // a single Hindi-looking token is not enough
    expect(looksHinglish("Can I bring my kitna?")).toBe(false);
  });
});

describe("dependsOnHistory", () => {
  it.each(["And the hostel?", "what about ECE", "How much does it cost per year?", "Is that fee refundable after I join?", "Which one is cheaper for four years?"])("needs the conversation: %s", (q) =>
    expect(dependsOnHistory(q)).toBe(true),
  );
  it.each(["Is there a gym on the campus?", "What is the hostel fee for a triple room?", "scan reddit for last year placements of this college", "Last date to pay the exam fee for BE"])("stands alone: %s", (q) =>
    expect(dependsOnHistory(q)).toBe(false),
  );
});

describe("hasNonAscii", () => {
  it("detects Indic scripts", () => {
    expect(hasNonAscii("क्या कैंपस में पूल है?")).toBe(true);
    expect(hasNonAscii("ಹಾಸ್ಟೆಲ್ ಶುಲ್ಕ")).toBe(true);
    expect(hasNonAscii("hostel fee")).toBe(false);
  });
});
