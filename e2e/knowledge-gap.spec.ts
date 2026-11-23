import { expect, test } from "@playwright/test";
import { ask, lastAnswer, pace, sources } from "./helpers";

// The full loop: an unanswerable question becomes a gap, staff answer it on
// /admin, and the same question is then answered from the new FAQ.

test.describe.configure({ mode: "serial" });

const QUESTION = "Is there a swimming pool on campus?";

test("unanswerable question is flagged and logged as a gap", async ({ page, request }) => {
  await page.goto("/chat");
  await ask(page, QUESTION);
  await expect(lastAnswer(page).getByText("Not in the handbook yet")).toBeVisible();

  const { gaps } = await (await request.get("/api/admin/gaps")).json();
  expect(gaps.some((g: { label: string; status: string }) => /swimming pool/i.test(g.label) && g.status === "open")).toBe(true);
});

test("staff answer the gap on the dashboard", async ({ page }) => {
  await page.goto("/admin");
  const gap = page.locator("li").filter({ hasText: /swimming pool/i }).first();
  await expect(gap).toBeVisible();
  await gap.getByRole("button", { name: "Answer" }).click();
  await gap.getByLabel("Answer").fill(
    "There is no swimming pool on campus. Students can use the municipal aquatic centre 3 km away at a student rate of Rs 600 a month.",
  );
  await gap.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status")).toContainText("Published");
  // It leaves the open list (other tests may have left gaps of their own).
  await expect(page.locator("li").filter({ hasText: /swimming pool/i }).filter({ has: page.getByRole("button", { name: "Answer" }) })).toHaveCount(0);

  await page.getByRole("tab", { name: /Documents/ }).click();
  await expect(page.getByRole("table")).toContainText(/FAQ: .*swimming pool/i);
});

test("the same question is now answered from the staff FAQ", async ({ page }) => {
  await pace(page);
  await page.goto("/chat");
  await ask(page, QUESTION);
  await expect(lastAnswer(page)).toContainText(/3 km|600/);
  await lastAnswer(page).getByRole("button", { name: /\d+ sources/ }).click();
  await expect(sources(page)).toContainText(/swimming pool/i);
});
