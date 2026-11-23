import { expect, test } from "@playwright/test";

// Phone-width checks (Pixel 7 viewport): nothing scrolls sideways, the main
// actions stay reachable, and the side panel opens as a drawer.

test("landing fits a phone screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Get the receipts.");
  await page.waitForLoadState("networkidle");
  // Scroll like a visitor so the scroll-triggered sections play in.
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: /Ask a question/ })).toBeVisible();
  await page.screenshot({ path: "e2e-screens/landing-mobile.png", fullPage: true });
});

test("chat fits a phone screen and opens panels as a drawer", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByPlaceholder("Ask anything about Northgate")).toBeVisible();
  await page.screenshot({ path: "e2e-screens/chat-mobile.png" });

  await page.getByRole("button", { name: "Plan" }).click();
  const drawer = page.getByRole("dialog", { name: "Plan" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Your plan is empty")).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();

  // Escape closes it too.
  await page.getByRole("button", { name: "Sources" }).click();
  await expect(page.getByRole("dialog", { name: "Sources" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Sources" })).toBeHidden();
});
