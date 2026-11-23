import { expect, test } from "@playwright/test";
import { answers, ask, composer, lastAnswer, pace, sources, waitForAnswer } from "./helpers";

// Real-LLM journeys through the chat. Assertions target what the app controls
// (cards, computed numbers, sources, language, plan) rather than exact wording.

test.describe.configure({ mode: "serial" });
test.afterEach(async ({ page }) => pace(page));

test("cost question: card with computed total, sources and citations", async ({ page }) => {
  await page.goto("/chat");
  await ask(page, "What will CSE cost for 4 years via KCET with a triple hostel room?");

  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "CSE via KCET" }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Rs 10.99 lakh");
  await expect(card).toContainText("4 years");

  // Sources chip opens the panel with fused keyword + semantic passages.
  await lastAnswer(page).getByRole("button", { name: /\d+ sources/ }).click();
  await expect(sources(page)).toContainText(/\d+ keyword \+ \d+ semantic/);
  await expect(sources(page).locator("li[id^=passage-]").first()).toBeVisible();

  // Citation chips, when the model cites, jump to their passage.
  const cite = lastAnswer(page).getByRole("button", { name: /^Source \d+:/ });
  if (await cite.count()) {
    const n = (await cite.first().innerText()).trim();
    await cite.first().click();
    await expect(sources(page).locator(`#passage-${n}`)).toBeInViewport();
  }

  // Breakdown table adds up.
  await card.getByText("Breakdown").click();
  await expect(card.getByRole("row", { name: /Total/ })).toContainText("Rs 10,99,000");
});

test("plan: pin a card, add dates, export a calendar", async ({ page, context }) => {
  await page.goto("/chat");
  await ask(page, "What will CSE cost for 4 years via KCET with a triple hostel room?");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "CSE via KCET" }) });
  await card.getByRole("button", { name: "Pin to plan" }).click();
  await expect(page.getByRole("status")).toContainText(/Added 1 to plan|Already on plan/);
  await pace(page);

  await ask(page, "What are the upcoming important dates?");
  const dates = page.locator("section").filter({ has: page.getByRole("heading", { name: "Key dates" }) });
  await expect(dates).toBeVisible();
  await dates.getByRole("button", { name: "Add all" }).click();
  await expect(page.getByRole("status")).toContainText(/Added \d+ to plan/);

  await page.getByRole("tab", { name: /Plan/ }).click();
  await expect(sources(page)).toContainText("CSE (KCET) total");
  await expect(sources(page)).toContainText("Dates");
  const exportLink = sources(page).getByRole("link", { name: /Export/ });
  await expect(exportLink).toHaveAttribute("href", "/api/plan/ics");

  const ics = await context.request.get("/api/plan/ics");
  const text = await ics.text();
  expect(text).toContain("BEGIN:VEVENT");
  expect(text.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThan(3);
});

test("eligibility question: verdict card from last year's cutoffs", async ({ page }) => {
  await page.goto("/chat");
  await ask(page, "Am I eligible for AI & ML with 78% in PCM and a KCET rank of 12,000?");
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "AIML via KCET" }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Good chance");
  await expect(card).toContainText("12,000 vs closing 13,000");
});

test("follow-up keeps the context of the conversation", async ({ page }) => {
  await page.goto("/chat");
  await ask(page, "What is the tuition fee for CSE under KCET?");
  await pace(page);
  await ask(page, "And how much is it through COMEDK?");
  await expect(sources(page)).toContainText(/Searched:.*(CSE|Computer Science)/i);
  await expect(lastAnswer(page)).toContainText(/2,25,000|2\.25 lakh/);
});

test("answers in Hindi when Hindi is selected", async ({ page }) => {
  await page.goto("/chat");
  await page.getByLabel("Answer language").selectOption("hi");
  await ask(page, "हॉस्टल में रात को कितने बजे तक लौटना होता है?");
  await expect(lastAnswer(page)).toContainText(/[ऀ-ॿ]{3,}/);
  await expect(lastAnswer(page)).toContainText(/10/);
  // The search ran in English even though the question was in Hindi.
  await expect(sources(page)).toContainText(/Searched:\s*[A-Za-z]/);
  await page.getByLabel("Answer language").selectOption("en");
});

test("understands romanized Hinglish", async ({ page }) => {
  await page.goto("/chat");
  await ask(page, "hostel ka in-time kya hai weekdays mein?");
  await expect(sources(page)).toContainText(/Searched:/);
  await expect(lastAnswer(page)).toContainText(/10/);
});

test("landing persona card deep-links into a parent's question", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Parents/ }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("radio", { name: "Parent" })).toHaveAttribute("aria-checked", "true");
  // exact match: the hidden landing page (kept mounted by Next) quotes the same question in curly quotes
  await expect(page.getByText("How safe is the girls' hostel?", { exact: true })).toBeVisible();
  await waitForAnswer(page);
  await expect(lastAnswer(page).getByRole("button", { name: /\d+ sources/ })).toBeVisible();
});

test("shortcut fills the composer without sending", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(composer(page)).toHaveValue("Compare CSE, AIML and ECE");
  await expect(answers(page)).toHaveCount(0);
});
