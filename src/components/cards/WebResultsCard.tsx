"use client";

import { ArrowSquareOut, GlobeHemisphereEast, Info } from "@phosphor-icons/react";
import type { WebSearchOutput } from "@/lib/websearch";
import { formatDate } from "@/lib/format";
import { siteTier } from "@/lib/sites";
import { SiteLogo, SiteStack, TierTag } from "../SiteLogo";
import { CardFrame } from "../ui";

/** Web results, kept visibly apart from the handbook's sources. */
export function WebResultsCard({ output }: { output: WebSearchOutput }) {
  return (
    <CardFrame
      icon={GlobeHemisphereEast}
      eyebrow={`From the web · ${output.scope ?? "official sites"}`}
      title={<span className="font-normal text-ink-2">&ldquo;{output.query}&rdquo;</span>}
      actions={output.results.length > 0 && <SiteStack sources={output.results} />}
      className="border-dashed"
    >
      {output.results.length > 0 && output.aboutCollege && !output.collegeFound && (
        <p className="mb-3 flex items-start gap-1.5 rounded-xl bg-marigold-soft px-3 py-2 text-[12.5px] leading-snug text-ink">
          <Info size={14} className="mt-px shrink-0" aria-hidden />
          None of these mention M S Ramaiah Institute of Technology. They&apos;re the closest matches, about other colleges or the topic in general.
        </p>
      )}
      {output.widened && <p className="mb-3 text-[12.5px] text-muted">Nothing came back from {output.scope} itself, so this is from the wider web.</p>}
      {output.results.length === 0 ? (
        <p className="text-[13px] text-ink-2">Nothing came up for this.</p>
      ) : (
        <ol className="space-y-3">
          {output.results.map((r) => (
            <li key={r.id} id={`web-${r.id}`} className="flex gap-2.5">
              <SiteLogo domain={r.domain} favicon={r.favicon} size={22} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="font-medium text-ink-2">{r.site}</span>
                  <span className="font-mono text-[10.5px]">{r.id}</span>
                  <TierTag domain={r.domain} />
                </p>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex items-start gap-1 text-[13.5px] font-medium leading-snug text-ink hover:text-accent-text"
                >
                  <span className="underline decoration-line-strong underline-offset-2 group-hover:decoration-accent">{r.title}</span>
                  <ArrowSquareOut size={13} className="mt-0.5 shrink-0 text-muted" aria-label="(opens the site)" />
                </a>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {r.domain}
                  {r.published && <> · {formatDate(r.published)}</>}
                </p>
                {r.snippet && <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{r.snippet}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex items-start gap-1.5 border-t border-line pt-2.5 text-[11.5px] leading-snug text-muted">
        <Info size={13} className="mt-px shrink-0" aria-hidden />
        {output.results.some((r) => siteTier(r.domain) === "community")
          ? "Not from the handbook. Community posts are opinions; check anything important with an official source."
          : "Not from the handbook. Check the date and the page before you rely on it."}
      </p>
    </CardFrame>
  );
}
