import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { APICallError, RetryError } from "ai";

export type ProviderId = "gemini" | "groq";
export type ProviderInfo = { provider: ProviderId; model: string; fastModel: string; fallback: ProviderId | null };

type Provider = { id: ProviderId; model: string; fastModel: string; make: (modelId: string) => LanguageModelV4 };

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const groqKey = () => process.env.GROQ_API_KEY;

/**
 * Providers in preference order: Gemini then Groq, for whichever keys are set.
 * LLM_PROVIDER pins one provider and turns the fallback off.
 */
function providers(): Provider[] {
  const list: Provider[] = [];
  const gemini = geminiKey();
  if (gemini) {
    const google = createGoogle({ apiKey: gemini });
    list.push({
      id: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      fastModel: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
      make: (m) => google(m),
    });
  }
  const groqApiKey = groqKey();
  if (groqApiKey) {
    const groq = createGroq({ apiKey: groqApiKey });
    list.push({
      id: "groq",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      fastModel: process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b",
      make: (m) => groq(m),
    });
  }
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  return forced ? list.filter((p) => p.id === forced) : list;
}

export function getProviderInfo(): ProviderInfo | null {
  const [primary, fallback] = providers();
  return primary ? { provider: primary.id, model: primary.model, fastModel: primary.fastModel, fallback: fallback?.id ?? null } : null;
}

/** The underlying provider error, unwrapping the SDK's retry wrapper. */
function rootError(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

export function isRateLimited(error: unknown): boolean {
  const e = rootError(error);
  return APICallError.isInstance(e) && (e.statusCode === 429 || /quota|rate.?limit/i.test(e.message));
}

// Free tiers are small (Gemini's can be 20 requests a day; Groq's 200,000
// tokens a day per model). When a model says "too many requests" we skip it and
// use the next one: for a long while after a daily quota, briefly after a
// per-minute one. Limits are per model, so cooldowns are too.
const g = globalThis as unknown as { __llmCooldown?: Map<string, number> };
const cooldown = (g.__llmCooldown ??= new Map<string, number>());
const keyOf = (m: { id: ProviderId; model: LanguageModelV4 }) => `${m.id}:${m.model.modelId}`;

function cooldownFor(error: unknown): number {
  const e = rootError(error);
  const message = e instanceof Error ? e.message : String(e);
  return /per.?day|daily|RPD|TPD|quota/i.test(message) ? 30 * 60_000 : 20_000;
}

/** "Please try again in 1m2.5s" / "in 637.5ms" → milliseconds, if the provider says. */
export function retryAfterMs(error: unknown): number | null {
  const e = rootError(error);
  const m = (e instanceof Error ? e.message : String(e)).match(/try again in (?:(\d+)m)?([\d.]+)(ms|s)\b/i);
  if (!m) return null;
  return Number(m[1] ?? 0) * 60_000 + Number(m[2]) * (m[3].toLowerCase() === "ms" ? 1 : 1000);
}

const SHORT_WAIT_MS = 25_000;

export function withFallback(models: { id: ProviderId; model: LanguageModelV4 }[]): LanguageModelV4 {
  async function attempt<T>(call: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> {
    const ready = models.filter((m) => (cooldown.get(keyOf(m)) ?? 0) <= Date.now());
    let lastError: unknown;
    let soonest: { m: (typeof models)[number]; wait: number } | null = null;
    for (const m of ready.length ? ready : models) {
      try {
        return await call(m.model);
      } catch (error) {
        if (!isRateLimited(error)) throw error;
        cooldown.set(keyOf(m), Date.now() + cooldownFor(error));
        console.warn(`[llm] ${keyOf(m)} is rate-limited; trying the next model`);
        lastError = error;
        const wait = retryAfterMs(error);
        const daily = cooldownFor(error) > SHORT_WAIT_MS;
        if (wait != null && !daily && wait <= SHORT_WAIT_MS && (!soonest || wait < soonest.wait)) soonest = { m, wait };
      }
    }
    // Every model is busy. A per-minute limit that clears in a few seconds (a
    // two-step answer can overshoot Groq's 8,000 tokens a minute by a little)
    // is worth waiting for, once, rather than failing the answer.
    if (soonest) {
      await new Promise((r) => setTimeout(r, soonest.wait + 300));
      cooldown.delete(keyOf(soonest.m));
      return await call(soonest.m.model);
    }
    throw lastError;
  }

  const first = models[0].model;
  return {
    specificationVersion: "v4",
    provider: models.map((m) => m.id).join("|"),
    modelId: first.modelId,
    supportedUrls: first.supportedUrls,
    doGenerate: (options) => attempt((m) => m.doGenerate(options)),
    doStream: (options) => attempt((m) => m.doStream(options)),
  };
}

export function getModels(): { main: LanguageModelV4; fast: LanguageModelV4; info: ProviderInfo } | null {
  const list = providers();
  const info = getProviderInfo();
  if (!list.length || !info) return null;
  return {
    // The last provider's small model is a last resort for answers, so the
    // assistant keeps working (a little less polished) when the big models' daily quotas run out.
    main: withFallback([
      ...list.map((p) => ({ id: p.id, model: p.make(p.model) })),
      ...list.slice(-1).filter((p) => p.fastModel !== p.model).map((p) => ({ id: p.id, model: p.make(p.fastModel) })),
    ]),
    fast: withFallback(list.map((p) => ({ id: p.id, model: p.make(p.fastModel) }))),
    info,
  };
}

/**
 * A model that can read images, for attached photos and scans. Groq's vision
 * model comes first here because its free tier is far larger than Gemini's;
 * Gemini (which also reads PDFs natively) is the fallback.
 */
export function getVisionModel(): { model: LanguageModelV4; pdf: LanguageModelV4 | null; label: string } | null {
  const list: { id: ProviderId; model: LanguageModelV4 }[] = [];
  const groqApiKey = groqKey();
  if (groqApiKey) list.push({ id: "groq", model: createGroq({ apiKey: groqApiKey })(process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b") });
  const gemini = geminiKey();
  const geminiVision = gemini ? createGoogle({ apiKey: gemini })(process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash") : null;
  if (geminiVision) list.push({ id: "gemini", model: geminiVision });
  if (!list.length) return null;
  return { model: withFallback(list), pdf: geminiVision, label: list.map((m) => m.model.modelId).join(" → ") };
}

/** Turn provider errors into something a student can act on. */
export function friendlyLlmError(error: unknown): string {
  const e = rootError(error);
  const status = APICallError.isInstance(e) ? e.statusCode : undefined;
  const message = e instanceof Error ? e.message : String(e);
  if (status === 401 || status === 403) return "The AI provider rejected the API key. Check the key in .env.local and restart the server.";
  if (isRateLimited(e)) {
    return /per.?day|daily|quota/i.test(message)
      ? "The AI model's free quota is used up for now. Try again later, or add a key for the other provider (Gemini or Groq) in .env.local."
      : "The AI model is getting too many requests right now. Wait a few seconds and try again.";
  }
  if (status === 404) return "The configured AI model wasn't found. Set a valid model name in .env.local.";
  if (status && status >= 500) return `The AI provider is having trouble right now (HTTP ${status}). Try again in a moment.`;
  return `Something went wrong while generating the answer: ${message.slice(0, 200)}`;
}
