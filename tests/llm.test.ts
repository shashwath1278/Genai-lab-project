import type { LanguageModelV4 } from "@ai-sdk/provider";
import { APICallError, RetryError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { friendlyLlmError, isRateLimited, retryAfterMs, withFallback } from "../src/lib/llm";

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

  it("cools down one model, not every model from the same provider", async () => {
    const big = fake("groq-big", () => Promise.reject(quota()));
    const small = fake("groq-small", () => Promise.resolve("small-stream"));
    const model = withFallback([
      { id: "groq", model: big },
      { id: "groq", model: small },
    ]);
    expect(await model.doStream({} as never)).toBe("small-stream");
    expect(await model.doStream({} as never)).toBe("small-stream");
    expect(big.calls()).toBe(1);
    expect(small.calls()).toBe(2);
  });

  it("waits out a short per-minute limit when nothing else is free", async () => {
    const perMinute = () =>
      new APICallError({
        message: "Rate limit reached for model `openai/gpt-oss-20b` on tokens per minute (TPM): Limit 8000, Used 4362, Requested 3723. Please try again in 60ms.",
        url: "https://example.test",
        requestBodyValues: {},
        statusCode: 429,
      });
    let first = true;
    const small = fake("groq-tpm", () => (first ? ((first = false), Promise.reject(perMinute())) : Promise.resolve("after-wait")));
    const daily = fake("gemini-daily", () => Promise.reject(quota()));
    const model = withFallback([
      { id: "gemini", model: daily },
      { id: "groq", model: small },
    ]);
    const started = Date.now();
    expect(await model.doStream({} as never)).toBe("after-wait");
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
    expect(small.calls()).toBe(2);
  });

  it("reads the provider's retry hint", () => {
    const hint = (message: string) => retryAfterMs(new APICallError({ message, url: "x", requestBodyValues: {}, statusCode: 429 }));
    expect(hint("Please try again in 637.5ms.")).toBe(637.5);
    expect(hint("Please try again in 22.8225s.")).toBeCloseTo(22822.5);
    expect(hint("Please try again in 23m28.75s.")).toBeCloseTo(1408750);
    expect(hint("slow down")).toBeNull();
  });

  it("marks a spent quota as final, so nothing waits and retries behind the user's back", async () => {
    const spent = fake("groq-spent", () => Promise.reject(quota()));
    const error = await withFallback([{ id: "groq", model: spent }]).doStream({} as never).then(() => null, (e: unknown) => e);
    expect(APICallError.isInstance(error) && error.isRetryable).toBe(false);
    expect(isRateLimited(error)).toBe(true);
  });

  it("does not wait when asked not to", async () => {
    const limit = new APICallError({ message: "Rate limit reached (TPM). Please try again in 5s.", url: "x", requestBodyValues: {}, statusCode: 429 });
    const busy = fake("groq-busy", () => Promise.reject(limit));
    const t = Date.now();
    await expect(withFallback([{ id: "groq", model: busy }], { patient: false }).doStream({} as never)).rejects.toThrow(/Rate limit/);
    expect(Date.now() - t).toBeLessThan(1000);
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
