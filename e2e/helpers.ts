import { expect, type Page } from "@playwright/test";

// By its label, not its placeholder: the placeholder changes once a file is attached.
export const composer = (page: Page) => page.getByRole("textbox", { name: "Ask about Northgate" });

/** Type a question, send it and wait until the answer has finished streaming. */
export async function ask(page: Page, text: string) {
  const box = composer(page);
  await box.fill(text);
  await box.press("Enter");
  await waitForAnswer(page);
}

export async function waitForAnswer(page: Page) {
  // The send button turns into Stop while busy and comes back when done.
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible({ timeout: 15_000 }).catch(() => {});
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible({ timeout: 120_000 });
  // Provider trouble (rate limits, bad key) shows as an inline error: fail loudly with its text.
  const error = page.getByText(/quota is used up|too many requests|went wrong|An error occurred|rejected the API key|No LLM key|No answer came back/i);
  if (await error.count()) throw new Error(`LLM error: ${await error.first().innerText()}`);
}

/** The most recent assistant answer. Answers carry aria-busy; this keeps the hidden landing page's
 *  <article> cards (Next keeps the previous route mounted) out of the match. */
export const answers = (page: Page) => page.locator("article[aria-busy]");
export const lastAnswer = (page: Page) => answers(page).last();

/** Sources panel on desktop (the aside). */
export const sources = (page: Page) => page.locator("aside");

/** Free-tier LLM quotas are per minute (Groq: 8,000 tokens); pausing between chats keeps us under them. */
export const pace = (page: Page) => page.waitForTimeout(Number(process.env.E2E_PACE_MS ?? 15_000));
