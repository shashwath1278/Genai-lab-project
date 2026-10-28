import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, type LanguageModel } from "ai";

export type ProviderId = "gemini" | "groq";
export type ProviderInfo = { provider: ProviderId; model: string; fastModel: string };

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const groqKey = () => process.env.GROQ_API_KEY;

/** Which provider is configured: LLM_PROVIDER wins, else whichever key is set (Gemini first). */
export function getProviderInfo(): ProviderInfo | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  const useGemini = forced ? forced === "gemini" && !!geminiKey() : !!geminiKey();
  const useGroq = forced ? forced === "groq" && !!groqKey() : !useGemini && !!groqKey();
  if (useGemini) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      fastModel: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite",
    };
  }
  if (useGroq) {
    return {
      provider: "groq",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      fastModel: process.env.GROQ_FAST_MODEL || "llama-3.1-8b-instant",
    };
  }
  return null;
}

export function getModels(): { main: LanguageModel; fast: LanguageModel; info: ProviderInfo } | null {
  const info = getProviderInfo();
  if (!info) return null;
  if (info.provider === "gemini") {
    const google = createGoogle({ apiKey: geminiKey() });
    return { main: google(info.model), fast: google(info.fastModel), info };
  }
  const groq = createGroq({ apiKey: groqKey() });
  return { main: groq(info.model), fast: groq(info.fastModel), info };
}

/** Turn provider errors into something a student can act on. */
export function friendlyLlmError(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const provider = getProviderInfo()?.provider === "groq" ? "Groq" : "Gemini";
  if (status === 401 || status === 403) return `The ${provider} API key was rejected. Check the key in .env.local and restart the dev server.`;
  if (status === 429) return `${provider} rate limit reached (free tiers allow only a few requests per minute). Wait a moment and try again.`;
  if (status === 404) return `The configured ${provider} model wasn't found. Set a valid model name in .env.local.`;
  if (status && status >= 500) return `${provider} is having trouble right now (HTTP ${status}). Try again in a moment.`;
  const message = error instanceof Error ? error.message : String(error);
  return `Something went wrong while generating the answer: ${message.slice(0, 200)}`;
}
