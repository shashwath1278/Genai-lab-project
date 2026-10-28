"use client";

import { AlertTriangle, CheckCircle2, CircleHelp, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Confidence } from "@/lib/retrieval";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: LucideIcon;
};

export function Button({ variant = "secondary", size = "md", icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-hover",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 16} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; active?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
        active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}

/** Frame shared by every answer card. */
export function CardFrame({
  icon: Icon,
  eyebrow,
  title,
  actions,
  children,
  className,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rise my-3 overflow-hidden rounded-xl border border-line bg-surface shadow-card", className)}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
          <Icon size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[11.5px] text-muted">{eyebrow}</p>}
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export const CONFIDENCE: Record<Confidence, { label: string; icon: LucideIcon; text: string }> = {
  high: { label: "Strong match", icon: CheckCircle2, text: "text-good-text" },
  medium: { label: "Partial match", icon: AlertTriangle, text: "text-warning-text" },
  low: { label: "Weak match", icon: CircleHelp, text: "text-critical-text" },
};

/** Status color always paired with an icon and a label. */
export function ConfidenceBadge({ confidence, onClick }: { confidence: Confidence; onClick?: () => void }) {
  const c = CONFIDENCE[confidence];
  const Icon = c.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-medium", c.text, onClick && "hover:bg-surface-2")}
    >
      <Icon size={13} aria-hidden />
      {c.label}
    </button>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warning" | "critical"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent-text",
        tone === "good" && "bg-surface-2 text-good-text",
        tone === "warning" && "bg-surface-2 text-warning-text",
        tone === "critical" && "bg-surface-2 text-critical-text",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--seq-track)" }} aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: "var(--seq-fill)" }} />
      </span>
      <span className="text-[11.5px] tabular-nums text-ink-2">{label}</span>
    </span>
  );
}
