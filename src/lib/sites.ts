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
