import { describe, expect, it } from "vitest";
import { siteInfo } from "../src/lib/sites";

describe("siteInfo", () => {
  it.each([
    ["www.reddit.com", "Reddit", "reddit"],
    ["old.reddit.com", "Reddit", "reddit"],
    ["x.com", "X", "x"],
    ["twitter.com", "X", "x"],
    ["github.com", "GitHub", "github"],
    ["m.youtube.com", "YouTube", "youtube"],
    ["stackoverflow.com", "Stack Overflow", "stackoverflow"],
  ])("%s is %s", (domain, name, brand) => {
    expect(siteInfo(domain)).toMatchObject({ name, brand });
  });

  it("names official sites the way people know them", () => {
    expect(siteInfo("cetonline.karnataka.gov.in")).toEqual({ name: "KEA", brand: null, kind: "gov" });
    expect(siteInfo("jeemain.nta.ac.in")).toEqual({ name: "NTA", brand: null, kind: "edu" });
    expect(siteInfo("www.comedk.org")).toMatchObject({ name: "COMEDK", kind: "web" });
    expect(siteInfo("gate2027.iitr.ac.in").name).toBe("GATE 2027");
  });

  it("falls back to the registrable name", () => {
    expect(siteInfo("news.example.co.in").name).toBe("Example");
    expect(siteInfo("bbc.co.uk").name).toBe("BBC");
    expect(siteInfo("abc.xyz").name).toBe("ABC");
    expect(siteInfo("transport.mp.gov.in").kind).toBe("gov");
  });
});
