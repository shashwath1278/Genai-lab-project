import Link from "next/link";
import { COLLEGE } from "@/lib/college";

/** The Northgate mark: a laterite gate arch with a jacaranda petal. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x={1.5} y={2.5} width={28} height={28} rx={9} fill="var(--laterite)" opacity={0.9} />
      <rect x={0.5} y={0.5} width={28} height={28} rx={9} fill="var(--accent)" />
      <path d="M8 23 V15 a6.5 6.5 0 0 1 13 0 V23" fill="none" stroke="var(--accent-ink)" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M12.2 23 V16.4 a2.3 2.3 0 0 1 4.6 0 V23" fill="none" stroke="var(--accent-ink)" strokeWidth={1.8} strokeLinecap="round" />
      <ellipse cx={23.5} cy={7.5} rx={3.2} ry={1.9} fill="var(--marigold)" transform="rotate(-30 23.5 7.5)" />
    </svg>
  );
}

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`group flex min-w-0 items-center gap-2.5 ${className ?? ""}`} aria-label={`${COLLEGE.assistant} home`}>
      <BrandMark className="size-8 shrink-0 transition-transform duration-300 group-hover:-rotate-6" />
      <span className="hidden truncate font-display text-[22px] leading-none tracking-tight text-ink sm:block">
        Northgate <em className="text-accent-text">Copilot</em>
      </span>
    </Link>
  );
}
