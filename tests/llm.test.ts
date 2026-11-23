import type { LanguageModelV4 } from "@ai-sdk/provider";
import { APICallError, RetryError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { friendlyLlmError, isRateLimited, withFallback } from "../src/lib/llm";

const quota = () =>
  new APICallError({
    message: "You exceeded your current quota. Generate content requests per day limit exceeded on Free Tier.",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode: 429,
  });

function fake(name: string, impl: () => Promise<unknown>): LanguageModelV4 & { calls: () => number } {
  const doStream = vi.fn(impl);
  return {
    specificationVersion: "v4",
    provider: name,
    modelId: `${name}-model`,
    supportedUrls: {},
    doGenerate: vi.fn(impl) as never,
    doStream: doStream as never,
    calls: () => doStream.mock.calls.length,
  };
}

describe("withFallback", () => {
  it("uses the next provider when the first is rate-limited, then skips the first for a while", async () => {
    const gemini = fake("gemini", () => Promise.reject(quota()));
    const groq = fake("groq", () => Promise.resolve("groq-stream"));
    const model = withFallback([
      { id: "gemini", model: gemini },
      { id: "groq", model: groq },
    ]);

    expect(await model.doStream({} as never)).toBe("groq-stream");
    expect(await model.doStream({} as never)).toBe("groq-stream");
    expect(gemini.calls()).toBe(1); // cooling down after the first 429
    expect(groq.calls()).toBe(2);
  });

  it("does not hide other errors", async () => {
    const broken = fake("gemini", () => Promise.reject(new Error("bad request")));
    const groq = fake("groq", () => Promise.resolve("never"));
    const model = withFallback([
      { id: "groq", model: broken },
      { id: "gemini", model: groq },
    ]);
    await expect(model.doStream({} as never)).rejects.toThrow("bad request");
  });
});

describe("friendly errors", () => {
  it("sees a quota error through the SDK's retry wrapper", () => {
    const wrapped = new RetryError({ message: "Failed after 3 attempts", reason: "maxRetriesExceeded", errors: [quota(), quota()] });
    expect(isRateLimited(wrapped)).toBe(true);
    expect(friendlyLlmError(wrapped)).toMatch(/free quota is used up/);
  });
});
