import { describe, expect, it, vi } from "vitest";
import { namedSites, siteTier } from "../src/lib/sites";
import { asksAboutCollege, cleanSnippet, handbookQuery, isoDay, searchWeb, wantsWebSearch, webHost, webNote } from "../src/lib/websearch";

describe("result text", () => {
  it("strips markdown and decoration from page snippets", () => {
    const clean = (s: string) => cleanSnippet(s).replace(/\s+/g, " ").trim();
    expect(clean("## logo UGET – 2026 ###### UGET Engineering")).toBe("logo UGET – 2026 UGET Engineering");
    expect(clean("📄 Undergraduate CET (UGCET - 2026) → 📘 UGNEET → 🎓 [PGCET](https://x.gov.in/p) ![img](a.png)")).toBe("Undergraduate CET (UGCET - 2026) · UGNEET · PGCET");
  });

  it("normalises dates and drops ones it can't read", () => {
    expect(isoDay("2026-11-02T10:00:00Z")).toBe("2026-11-02");
    expect(isoDay("Mon, 10 Nov 2026 08:00:00 GMT")).toBe("2026-11-10");
    expect(isoDay("undefined")).toBeNull();
    expect(isoDay(null)).toBeNull();
  });
});

describe("recognising a request to search", () => {
  it.each([
    "scan reddit for last year placements of this college",
    "search the web for AI and ML salaries",
    "what does Quora say about hostel life in Bengaluru?",
    "find YouTube videos on data structures",
    "check the official KEA site for the KCET date",
    "look up Cobalt Systems on LinkedIn",
    "Search for scholarships for girls in Karnataka",
    "any reddit threads on COMEDK counselling?",
    "google it",
    "what are people saying on the internet about KCET 2027",
    "browse news about engineering admissions",
  ])("acts on: %s", (q) => expect(wantsWebSearch(q)).toBe(true));

  it.each([
    "Is there a web development club?",
    "Can I pay the fees online?",
    "How is the internet speed in the hostel?",
    "What is the medium of instruction?",
    "Where is the Examination Section?",
    "What will CSE cost for 4 years?",
    "Find the last date to pay the exam fee",
    "Check if I am eligible for AIML with rank 12000",
  ])("leaves alone: %s", (q) => expect(wantsWebSearch(q)).toBe(false));

  it("knows which sites were named", () => {
    expect(namedSites("scan reddit and Quora").map((s) => s.label)).toEqual(["Reddit", "Quora"]);
    expect(namedSites("posts on X about KCET").map((s) => s.label)).toEqual(["X"]);
    expect(namedSites("solve for x in maths")).toEqual([]);
  });

  it("searches the handbook for the topic, not the website", () => {
    expect(handbookQuery("scan reddit for last year placements of this college")).toBe("last year placements of this college");
    expect(handbookQuery("Northgate Institute of Technology last year placement statistics and student reviews on Reddit")).toBe(
      "Northgate Institute of Technology last year placement statistics and student reviews",
    );
    expect(handbookQuery("search the web")).toBe("search the web"); // nothing left: keep it
  });

  it("knows when the college itself is meant", () => {
    expect(asksAboutCollege("placements of this college")).toBe(true);
    expect(asksAboutCollege("Northgate hostel reviews")).toBe(true);
    expect(asksAboutCollege("KCET 2027 exam date")).toBe(false);
  });
});

describe("where results come from", () => {
  it.each([
    ["cetonline.karnataka.gov.in", "official"],
    ["gate2027.iitr.ac.in", "official"],
    ["reddit.com", "community"],
    ["old.reddit.com", "community"],
    ["x.com", "community"],
    ["thehindu.com", "web"],
    ["gov.in.example.com", "web"],
    ["notgov.in", "web"],
  ])("%s is %s", (domain, tier) => expect(siteTier(domain)).toBe(tier));

  it("only accepts plain web links", () => {
    expect(webHost("https://www.reddit.com/r/x")).toBe("reddit.com");
    expect(webHost("javascript:alert(1)")).toBeNull();
    expect(webHost("not a url")).toBeNull();
  });
});

describe("searchWeb", () => {
  type Call = [string, RequestInit];
  const fake = (...pages: object[][]) => {
    const fn = vi.fn(async () => new Response(JSON.stringify({ results: pages.length > 1 ? pages.shift() : pages[0] })));
    const body = (i = 0) => JSON.parse(String((fn.mock.calls as unknown as Call[])[i][1].body));
    return { fetchImpl: fn as unknown as typeof fetch, body, calls: () => fn.mock.calls.length };
  };

  it("keeps to a named site, numbers results and tags them", async () => {
    const f = fake([
      { title: "Placements thread", url: "https://www.reddit.com/r/Btechtards/1", content: "NGIT placements were good", published_date: "Mon, 10 Nov 2026 08:00:00 GMT", favicon: "https://www.reddit.com/favicon.ico" },
      { title: "Sneaky", url: "https://blog.example.com/reddit", content: "not reddit" },
    ]);
    const out = await searchWeb("Northgate Institute of Technology placements", { sites: ["reddit"], aboutCollege: true, fetchImpl: f.fetchImpl, apiKey: "k", startAt: 3 });
    expect(f.body().include_domains).toEqual(["reddit.com"]);
    expect(out.results).toEqual([expect.objectContaining({ id: "W3", site: "Reddit", tier: "community", published: "2026-11-10", favicon: "https://www.reddit.com/favicon.ico" })]);
    // "NGIT" alone is another college, so nothing here is about Northgate.
    expect(out).toMatchObject({ scope: "Reddit", aboutCollege: true, collegeFound: false });
    expect(webNote(out)).toMatch(/NONE of these results name Northgate Institute of Technology/);
  });

  it("recognises a page that really names the college", async () => {
    const f = fake([{ title: "Northgate Institute of Technology review", url: "https://example.org/a", content: "A student's view" }]);
    const out = await searchWeb("x", { aboutCollege: true, fetchImpl: f.fetchImpl, apiKey: "k" });
    expect(out.collegeFound).toBe(true);
    expect(webNote(out)).not.toMatch(/NONE of these/);
  });

  it("searches the open web by default, and official sites on request", async () => {
    const open = fake([{ title: "Salaries", url: "https://thehindu.com/a", content: "…" }]);
    expect((await searchWeb("AI salaries", { fetchImpl: open.fetchImpl, apiKey: "k" })).scope).toBe("the web");
    expect(open.body()).toMatchObject({ country: "india" });
    expect(open.body().include_domains).toBeUndefined();

    const official = fake([
      { title: "KCET", url: "https://cetonline.karnataka.gov.in/kea", content: "18 April" },
      { title: "Coaching blog", url: "https://coaching.example.com", content: "unofficial" },
    ]);
    const out = await searchWeb("KCET 2027", { official: true, fetchImpl: official.fetchImpl, apiKey: "k" });
    expect(out.results.map((r) => r.domain)).toEqual(["cetonline.karnataka.gov.in"]);
  });

  it("widens when the named site has nothing, and says so", async () => {
    const f = fake([], [{ title: "Found elsewhere", url: "https://example.org/b", content: "…" }]);
    const out = await searchWeb("KCET", { sites: ["x"], fetchImpl: f.fetchImpl, apiKey: "k" });
    expect(f.calls()).toBe(2);
    expect(out).toMatchObject({ scope: "X", widened: true });
    expect(webNote(out)).toMatch(/Nothing came back from X itself/);
  });

  it("explains quota and key failures", async () => {
    const status = (n: number) => vi.fn(async () => new Response("{}", { status: n })) as unknown as typeof fetch;
    await expect(searchWeb("x", { fetchImpl: status(432), apiKey: "k" })).rejects.toThrow(/quota is used up/);
    await expect(searchWeb("x", { fetchImpl: status(401), apiKey: "k" })).rejects.toThrow(/key was rejected/);
    await expect(searchWeb("x", { apiKey: "" })).rejects.toThrow(/TAVILY_API_KEY/);
  });
});
