// Shared by client and server.

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 225000 -> "Rs 2,25,000" (Indian digit grouping). */
export function formatINR(amount: number): string {
  return `Rs ${inr.format(Math.round(amount))}`;
}

/** 1099000 -> "Rs 10.99 lakh"; smaller amounts fall back to formatINR. */
export function formatLakh(amount: number): string {
  if (Math.abs(amount) < 100000) return formatINR(amount);
  return `Rs ${(amount / 100000).toFixed(2).replace(/\.?0+$/, "")} lakh`;
}

const MONEY_KEYS = new Set([
  "tuition",
  "scholarship",
  "annualFees",
  "hostel",
  "mess",
  "transport",
  "total",
  "grand",
  "amount",
  "oneTime",
  "refundableDeposits",
  "feePerYear",
  "lowestFeePerYear",
]);

/**
 * A copy of a calculator result for the language model, with every rupee
 * figure already written out: 1099000 -> "Rs 10,99,000 (Rs 10.99 lakh)".
 * Models slip when regrouping big numbers the Indian way (one wrote
 * 1,09,90,000 for 10,99,000), so they get strings to copy instead of
 * integers to format. Only numbers under a money key change.
 */
export function moneyForModel(value: unknown, key = ""): unknown {
  if (typeof value === "number") {
    if (!MONEY_KEYS.has(key)) return value;
    return Math.abs(value) >= 100000 ? `${formatINR(value)} (${formatLakh(value)})` : formatINR(value);
  }
  if (Array.isArray(value)) return value.map((v) => moneyForModel(v, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, moneyForModel(v, k)]));
  }
  return value;
}

export function formatNumber(n: number): string {
  return inr.format(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-06" -> "6 Nov 2026". Parsed by hand so time zones can't shift the day. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateRange(start: string, end: string | null | undefined): string {
  if (!end || end === start) return formatDate(start);
  const [ys, ms] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const [, , ds] = start.split("-").map(Number);
  if (ys === ye && ms === me) return `${ds}–${de} ${MONTHS[me - 1]} ${ye}`;
  if (ys === ye) return `${ds} ${MONTHS[ms - 1]} – ${de} ${MONTHS[me - 1]} ${ye}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Whole days from `fromIso` to `toIso` (both YYYY-MM-DD). */
export function daysBetween(fromIso: string, toIso: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
