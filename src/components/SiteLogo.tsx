"use client";

import {
  Bank,
  DevToLogo,
  DiscordLogo,
  FacebookLogo,
  GithubLogo,
  GoogleLogo,
  GraduationCap,
  InstagramLogo,
  LinkedinLogo,
  MediumLogo,
  NotionLogo,
  RedditLogo,
  StackOverflowLogo,
  TelegramLogo,
  ThreadsLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
  type Icon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { type Brand, siteInfo } from "@/lib/sites";
import { cx } from "./ui";

// Source logos, like the favicons beside a search answer: a platform's own mark
// when we know it (Reddit, X, GitHub…), otherwise the site's favicon, otherwise
// a glyph for government and education sites or the site's initial.

const BRAND_ICON: Record<Brand, { icon: Icon; color: string }> = {
  reddit: { icon: RedditLogo, color: "#FF4500" },
  x: { icon: XLogo, color: "var(--ink)" },
  github: { icon: GithubLogo, color: "var(--ink)" },
  youtube: { icon: YoutubeLogo, color: "#FF0000" },
  linkedin: { icon: LinkedinLogo, color: "#0A66C2" },
  medium: { icon: MediumLogo, color: "var(--ink)" },
  stackoverflow: { icon: StackOverflowLogo, color: "#F48024" },
  instagram: { icon: InstagramLogo, color: "#E4405F" },
  facebook: { icon: FacebookLogo, color: "#1877F2" },
  google: { icon: GoogleLogo, color: "#4285F4" },
  discord: { icon: DiscordLogo, color: "#5865F2" },
  telegram: { icon: TelegramLogo, color: "#26A5E4" },
  whatsapp: { icon: WhatsappLogo, color: "#25D366" },
  threads: { icon: ThreadsLogo, color: "var(--ink)" },
  devto: { icon: DevToLogo, color: "var(--ink)" },
  notion: { icon: NotionLogo, color: "var(--ink)" },
};

export function SiteLogo({ domain, favicon, size = 18, className }: { domain: string; favicon?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const site = siteInfo(domain);
  const box = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface", className);
  const style = { width: size, height: size };

  if (site.brand) {
    const { icon: BrandIcon, color } = BRAND_ICON[site.brand];
    return (
      <span className={box} style={style} title={site.name}>
        <BrandIcon size={Math.round(size * 0.78)} weight="fill" color={color} aria-hidden />
      </span>
    );
  }
  if (favicon && !broken) {
    return (
      <span className={box} style={style} title={site.name}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote favicons from the result's own site */}
        <img src={favicon} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain p-[2px]" onError={() => setBroken(true)} />
      </span>
    );
  }
  const Glyph = site.kind === "gov" ? Bank : site.kind === "edu" ? GraduationCap : null;
  return (
    <span className={cx(box, site.kind === "gov" ? "bg-laterite-soft text-laterite" : "bg-accent-soft text-accent-text")} style={style} title={site.name}>
      {Glyph ? <Glyph size={Math.round(size * 0.7)} weight="duotone" aria-hidden /> : <span className="font-semibold leading-none" style={{ fontSize: size * 0.55 }}>{site.name.charAt(0)}</span>}
    </span>
  );
}

/** Overlapping logos for a row of sources, one per site. */
export function SiteStack({ sources, max = 4, size = 18 }: { sources: { domain: string; favicon?: string | null }[]; max?: number; size?: number }) {
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const name = siteInfo(s.domain).name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  return (
    <span className="inline-flex items-center" aria-hidden>
      {unique.slice(0, max).map((s, i) => (
        <SiteLogo key={s.domain} domain={s.domain} favicon={s.favicon} size={size} className={cx("rounded-full ring-2 ring-surface", i > 0 && "-ml-1.5")} />
      ))}
    </span>
  );
}
