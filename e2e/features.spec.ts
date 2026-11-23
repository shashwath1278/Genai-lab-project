import path from "node:path";
import { expect, test } from "@playwright/test";
import { ask, composer, lastAnswer, pace, waitForAnswer } from "./helpers";

// The map, document reading and official-site search, end to end with the
// real models. The receipt is a made-up test fixture for the fictional college.

test.describe.configure({ mode: "serial" });
test.afterEach(async ({ page }) => pace(page));

test("campus map: an office's building, the route and the steps", async ({ page }) => {
  await page.goto("/chat");
  await ask(page, "Where is the Examination Section?");
  const card = lastAnswer(page).locator("section").filter({ hasText: "Campus map" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("img", { name: /walking route from Main Gate to Academic Block B/ })).toBeVisible();
  await expect(card).toContainText("Room B-001");
  await expect(card).toContainText("Block B is on your left.");
  await card.getByRole("button", { name: "Whole campus" }).click();
  await expect(card.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("fee receipt photo: every line checked against the official fees", async ({ page }) => {
  await page.goto("/chat");
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "fee-receipt.png"));
  await expect(page.getByRole("list", { name: "Attachments" }).locator("img")).toBeVisible();
  await composer(page).fill("Is this fee receipt correct?");
  await composer(page).press("Enter");
  await waitForAnswer(page);

  // The photo shows in the user's message; the reading and the audit in the answer.
  await expect(page.getByRole("img", { name: "fee-receipt.jpg" })).toBeVisible();
  const reading = lastAnswer(page).locator("section").filter({ hasText: "What I read" });
  await expect(reading).toContainText("Fee receipt");
  await expect(reading).toContainText("Rs 7,000 more"); // lab & library fees: Rs 25,000 vs the official Rs 18,000
  await expect(reading).toContainText("Total is wrong"); // lines add up to Rs 1,70,000, receipt says Rs 1,75,000
  await expect(lastAnswer(page)).not.toContainText("Not in the handbook yet"); // not filed as a knowledge gap
});

test("official-site search for things outside the handbook", async ({ page, request }) => {
  const status = await (await request.get("/api/status")).json();
  test.skip(!status.webSearch, "Set TAVILY_API_KEY to run the web search journey.");
  await page.goto("/chat");
  await ask(page, "When is the KCET 2027 entrance exam? Check the official KEA site.");
  const card = lastAnswer(page).locator("section").filter({ hasText: "Beyond the handbook" });
  await expect(card).toBeVisible();
  for (const href of await card.locator("a[href^=http]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).hostname))) {
    expect(href).toMatch(/(^|\.)(gov\.in|nic\.in|nta\.ac\.in|comedk\.org|aicte-india\.org|ugc\.ac\.in|nirfindia\.org|iimcat\.ac\.in|aima\.in)$/);
  }
});
