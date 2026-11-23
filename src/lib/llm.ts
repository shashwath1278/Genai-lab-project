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

// Free tiers are small (Gemini's can be 20 requests a day; Groq's 8,000 tokens
// a minute). When a provider says "too many requests" we skip it and use the
// next one: for a long while after a daily quota, briefly after a per-minute one.
const g = globalThis as unknown as { __llmCooldown?: Map<ProviderId, number> };
const cooldown = (g.__llmCooldown ??= new Map<ProviderId, number>());

function cooldownFor(error: unknown): number {
  const e = rootError(error);
  const message = e instanceof Error ? e.message : String(e);
  return /per.?day|daily|RPD|TPD|quota/i.test(message) ? 30 * 60_000 : 20_000;
}

export function withFallback(models: { id: ProviderId; model: LanguageModelV4 }[]): LanguageModelV4 {
  if (models.length === 1) return models[0].model;

  async function attempt<T>(call: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> {
    const ready = models.filter((m) => (cooldown.get(m.id) ?? 0) <= Date.now());
    let lastError: unknown;
    for (const m of ready.length ? ready : models) {
      try {
        return await call(m.model);
      } catch (error) {
        if (!isRateLimited(error)) throw error;
        cooldown.set(m.id, Date.now() + cooldownFor(error));
        console.warn(`[llm] ${m.id} is rate-limited; trying the next provider`);
        lastError = error;
      }
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
    main: withFallback(list.map((p) => ({ id: p.id, model: p.make(p.model) }))),
    fast: withFallback(list.map((p) => ({ id: p.id, model: p.make(p.fastModel) }))),
    info,
  };
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
