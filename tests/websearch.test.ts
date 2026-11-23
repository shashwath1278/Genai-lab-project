import { describe, expect, it, vi } from "vitest";
import { cleanSnippet, isoDay, officialDomain, searchOfficialWeb } from "../src/lib/websearch";

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

describe("officialDomain", () => {
  it.each([
    ["https://cetonline.karnataka.gov.in/kea/", "cetonline.karnataka.gov.in"],
    ["https://kea.kar.nic.in/", "kea.kar.nic.in"],
    ["https://www.comedk.org/uget", "comedk.org"],
    ["https://jeemain.nta.ac.in/", "jeemain.nta.ac.in"],
    ["https://scholarships.gov.in/", "scholarships.gov.in"],
    ["https://gate2027.iitr.ac.in/", "gate2027.iitr.ac.in"],
  ])("accepts %s", (url, host) => expect(officialDomain(url)).toBe(host));

  it.each([
    "https://shiksha.com/kcet-2027",
    "https://gov.in.example.com/",
    "https://notgov.in/",
    "https://somecollege.ac.in/",
    "javascript:alert(1)",
    "not a url",
  ])("rejects %s", (url) => expect(officialDomain(url)).toBeNull());
});

describe("searchOfficialWeb", () => {
  const response = (results: object[], status = 200) =>
    vi.fn(async () => new Response(JSON.stringify({ results }), { status })) as unknown as typeof fetch;

  it("keeps official results only, numbered from startAt", async () => {
    const fetchImpl = response([
      { title: "KCET 2027 schedule", url: "https://cetonline.karnataka.gov.in/kea/kcet2027", content: "  Exam on 18 April.  ", published_date: "2026-11-02T10:00:00Z" },
      { title: "KCET 2027: all you need to know", url: "https://coaching.example.com/kcet", content: "Unofficial blog" },
      { title: "COMEDK UGET 2027", url: "https://www.comedk.org/uget", content: "Applications open in February." },
    ]);
    const out = await searchOfficialWeb("KCET 2027 exam date", { fetchImpl, apiKey: "test", startAt: 3 });
    expect(out.results.map((r) => [r.id, r.domain])).toEqual([
      ["W3", "cetonline.karnataka.gov.in"],
      ["W4", "comedk.org"],
    ]);
    expect(out.results[0]).toMatchObject({ snippet: "Exam on 18 April.", published: "2026-11-02", site: "KEA", favicon: null });
    expect(out.results[1].site).toBe("COMEDK");

    const [, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ search_depth: "basic", include_favicon: true, include_domains: expect.arrayContaining(["gov.in", "nic.in"]) });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test");
  });

  it("explains quota and key failures", async () => {
    await expect(searchOfficialWeb("x", { fetchImpl: response([], 432), apiKey: "k" })).rejects.toThrow(/quota is used up/);
    await expect(searchOfficialWeb("x", { fetchImpl: response([], 401), apiKey: "k" })).rejects.toThrow(/key was rejected/);
    await expect(searchOfficialWeb("x", { apiKey: "" })).rejects.toThrow(/TAVILY_API_KEY/);
  });
});
