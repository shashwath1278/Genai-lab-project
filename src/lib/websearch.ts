// Web search limited to official sites (Tavily). Northgate is fictional, so the
// web can't answer questions about the college itself; this is for the real
// world around it: entrance exams, government scholarships, certificates and
// regulator rules. Results are filtered to the allowlist below whatever the
// search API returns, so nothing from an unofficial site reaches the model.

import { siteInfo } from "./sites";

export type WebResult = {
  /** W1, W2, … unique within one answer; the model cites these. */
  id: string;
  title: string;
  url: string;
  domain: string;
  /** "KEA", "Reddit": how the site is shown next to its logo. */
  site: string;
  /** The site's own favicon, when the search returned one. */
  favicon: string | null;
  snippet: string;
  published: string | null;
};

export type WebSearchOutput = { query: string; results: WebResult[]; searchedAt: string };

/** Official domains, matched as the host or any subdomain of it. */
export const OFFICIAL_DOMAINS = [
  "gov.in", // central and state governments: education.gov.in, scholarships.gov.in, karnataka.gov.in, cetonline.karnataka.gov.in
  "nic.in", // government sites on NIC: kea.kar.nic.in, josaa.nic.in
  "nta.ac.in", // National Testing Agency: JEE Main and other national exams
  "comedk.org", // COMEDK UGET
  "aicte-india.org", // AICTE
  "ugc.ac.in", // UGC
  "nirfindia.org", // NIRF rankings
  "iimcat.ac.in", // CAT
  "aima.in", // MAT
] as const;

/** GATE moves between IITs each year (gate2027.iitr.ac.in and so on). */
const GATE_HOST = /^gate\d{4}\.iit[a-z]+\.ac\.in$/;

export function officialDomain(url: string): string | null {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (GATE_HOST.test(host)) return host;
  return OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)) ? host : null;
}

export const webSearchEnabled = () => !!process.env.TAVILY_API_KEY;

type TavilyResult = { title?: string; url?: string; content?: string; published_date?: string | null; favicon?: string | null };

/** Only https favicons served from the result's own (allowed) site. */
function safeFavicon(favicon: string | null | undefined, host: string): string | null {
  if (!favicon) return null;
  try {
    const u = new URL(favicon);
    return u.protocol === "https:" && (u.hostname === host || officialDomain(favicon) !== null) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Page text arrives with markdown and decoration ("## logo ####", 📄, →): keep the words. */
export function cleanSnippet(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> their text
    .replace(/#{1,6}\s*/g, " ") // heading marks
    .replace(/[*_`|>]+/g, " ")
    .replace(/\p{Extended_Pictographic}️?/gu, " ")
    .replace(/\s*(?:→|->|»)\s*/g, " · ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .replace(/^\s*·\s*|\s*·\s*$/g, "");
}

/** Tavily dates come as ISO or as "Mon, 10 Nov 2026 08:00:00 GMT"; anything unreadable is dropped. */
export function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

const clip = (s: string, n: number) => {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : clean;
};

/**
 * One basic search (1 Tavily credit). `startAt` numbers the results so ids stay
 * unique when the model searches more than once in an answer.
 */
export async function searchOfficialWeb(
  query: string,
  { startAt = 1, fetchImpl = fetch, apiKey = process.env.TAVILY_API_KEY }: { startAt?: number; fetchImpl?: typeof fetch; apiKey?: string } = {},
): Promise<WebSearchOutput> {
  if (!apiKey) throw new Error("Web search isn't set up (no TAVILY_API_KEY).");
  const res = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: query.slice(0, 300),
      search_depth: "basic",
      topic: "general",
      country: "india",
      max_results: 8,
      include_domains: [...OFFICIAL_DOMAINS],
      include_published_date: true,
      include_favicon: true,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const reason = res.status === 401 ? "the key was rejected" : res.status === 429 || res.status === 432 || res.status === 433 ? "the search quota is used up" : `HTTP ${res.status}`;
    throw new Error(`Web search failed: ${reason}.`);
  }
  const body = (await res.json()) as { results?: TavilyResult[] };
  const results: WebResult[] = [];
  for (const r of body.results ?? []) {
    const domain = r.url ? officialDomain(r.url) : null;
    if (!domain || !r.title || results.some((x) => x.url === r.url)) continue;
    results.push({
      id: `W${startAt + results.length}`,
      title: clip(cleanSnippet(r.title), 140),
      url: r.url!,
      domain,
      site: siteInfo(domain).name,
      favicon: safeFavicon(r.favicon, domain),
      snippet: clip(cleanSnippet(r.content ?? ""), 420),
      published: isoDay(r.published_date),
    });
    if (results.length === 5) break;
  }
  return { query, results, searchedAt: new Date().toISOString() };
}
