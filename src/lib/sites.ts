// Shared by client and server: how a web source is named and which logo it gets.

export const BRANDS = [
  "reddit", "x", "github", "youtube", "linkedin", "medium", "stackoverflow", "instagram",
  "facebook", "google", "discord", "telegram", "whatsapp", "threads", "devto", "notion",
] as const;
export type Brand = (typeof BRANDS)[number];

export type SiteInfo = { name: string; brand: Brand | null; kind: "gov" | "edu" | "web" };

const BRAND_HOSTS: [suffix: string, brand: Brand, name: string][] = [
  ["reddit.com", "reddit", "Reddit"],
  ["redd.it", "reddit", "Reddit"],
  ["x.com", "x", "X"],
  ["twitter.com", "x", "X"],
  ["github.com", "github", "GitHub"],
  ["github.io", "github", "GitHub Pages"],
  ["youtube.com", "youtube", "YouTube"],
  ["youtu.be", "youtube", "YouTube"],
  ["linkedin.com", "linkedin", "LinkedIn"],
  ["medium.com", "medium", "Medium"],
  ["stackoverflow.com", "stackoverflow", "Stack Overflow"],
  ["stackexchange.com", "stackoverflow", "Stack Exchange"],
  ["instagram.com", "instagram", "Instagram"],
  ["facebook.com", "facebook", "Facebook"],
  ["google.com", "google", "Google"],
  ["discord.com", "discord", "Discord"],
  ["t.me", "telegram", "Telegram"],
  ["whatsapp.com", "whatsapp", "WhatsApp"],
  ["threads.net", "threads", "Threads"],
  ["dev.to", "devto", "DEV"],
  ["notion.site", "notion", "Notion"],
];

/** Official sites we search, by their usual short names. */
const KNOWN: [suffix: string, name: string][] = [
  ["cetonline.karnataka.gov.in", "KEA"],
  ["kea.kar.nic.in", "KEA"],
  ["scholarships.gov.in", "National Scholarship Portal"],
  ["ssp.postmatric.karnataka.gov.in", "Karnataka SSP"],
  ["education.gov.in", "Ministry of Education"],
  ["josaa.nic.in", "JoSAA"],
  ["nta.ac.in", "NTA"],
  ["comedk.org", "COMEDK"],
  ["aicte-india.org", "AICTE"],
  ["ugc.ac.in", "UGC"],
  ["ugc.gov.in", "UGC"],
  ["nirfindia.org", "NIRF"],
  ["iimcat.ac.in", "CAT"],
  ["aima.in", "AIMA"],
  ["karnataka.gov.in", "Govt of Karnataka"],
];

const matches = (host: string, suffix: string) => host === suffix || host.endsWith(`.${suffix}`);

/** Official domains, matched as the host or any subdomain of it. */
export const OFFICIAL_DOMAINS = [
  "gov.in", // central and state governments: education.gov.in, scholarships.gov.in, cetonline.karnataka.gov.in
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

/** Places where anyone can post: useful for opinions, not for facts. */
const COMMUNITY = [
  "reddit.com", "redd.it", "x.com", "twitter.com", "quora.com", "youtube.com", "youtu.be", "medium.com", "linkedin.com", "stackoverflow.com",
  "stackexchange.com", "github.com", "instagram.com", "facebook.com", "discord.com", "t.me", "threads.net", "dev.to", "pagalguy.com",
];

export type SiteTier = "official" | "community" | "web";

export function siteTier(domain: string): SiteTier {
  const host = domain.toLowerCase().replace(/^www\./, "");
  if (GATE_HOST.test(host) || OFFICIAL_DOMAINS.some((d) => matches(host, d))) return "official";
  return COMMUNITY.some((d) => matches(host, d)) ? "community" : "web";
}

/** Sites people name in a question: "scan reddit", "what does Quora say". */
export const NAMED_SITES: { label: string; pattern: RegExp; domains: string[] }[] = [
  { label: "Reddit", pattern: /\bsub-?reddits?\b|\breddit\b|\br\/\w+/i, domains: ["reddit.com"] },
  { label: "X", pattern: /\btwitter\b|\bx\.com\b|\btweets?\b|\b(?:on|from|via|scan|search|check) X\b/, domains: ["x.com", "twitter.com"] },
  { label: "Quora", pattern: /\bquora\b/i, domains: ["quora.com"] },
  { label: "YouTube", pattern: /\byou\s?tube\b/i, domains: ["youtube.com"] },
  { label: "GitHub", pattern: /\bgit\s?hub\b/i, domains: ["github.com"] },
  { label: "LinkedIn", pattern: /\blinked\s?in\b/i, domains: ["linkedin.com"] },
  { label: "Stack Overflow", pattern: /\bstack\s?overflow\b/i, domains: ["stackoverflow.com"] },
  { label: "Medium", pattern: /\bmedium\.com\b|\b(?:on|from) Medium\b/, domains: ["medium.com"] },
  { label: "Instagram", pattern: /\binstagram\b/i, domains: ["instagram.com"] },
  { label: "Facebook", pattern: /\bfacebook\b/i, domains: ["facebook.com"] },
  { label: "Wikipedia", pattern: /\bwikipedia\b/i, domains: ["wikipedia.org"] },
  { label: "Glassdoor", pattern: /\bglassdoor\b/i, domains: ["glassdoor.co.in", "glassdoor.com"] },
  { label: "AmbitionBox", pattern: /\bambition\s?box\b/i, domains: ["ambitionbox.com"] },
  { label: "Shiksha", pattern: /\bshiksha\b/i, domains: ["shiksha.com"] },
  { label: "Collegedunia", pattern: /\bcollege\s?dunia\b/i, domains: ["collegedunia.com"] },
];

export const namedSites = (text: string) => NAMED_SITES.filter((s) => s.pattern.test(text));

export function siteInfo(domain: string): SiteInfo {
  const host = domain.toLowerCase().replace(/^www\./, "");
  const kind: SiteInfo["kind"] = /\.(gov|nic)\.in$|\.gov$/.test(host) ? "gov" : /\.(ac|edu)\.in$|\.edu$/.test(host) ? "edu" : "web";
  const brand = BRAND_HOSTS.find(([s]) => matches(host, s));
  if (brand) return { name: brand[2], brand: brand[1], kind };
  const known = KNOWN.find(([s]) => matches(host, s));
  if (known) return { name: known[1], brand: null, kind };
  if (/^gate\d{4}\./.test(host)) return { name: `GATE ${host.slice(4, 8)}`, brand: null, kind };
  // Otherwise the registrable name: "example.co.in" -> "Example".
  const labels = host.split(".");
  const tail = /^(co|ac|gov|nic|org|net|edu)$/.test(labels.at(-2) ?? "") && labels.length > 2 ? 3 : 2;
  const core = labels.at(-tail) ?? host;
  return { name: core.length <= 4 ? core.toUpperCase() : core.charAt(0).toUpperCase() + core.slice(1), brand: null, kind };
}
