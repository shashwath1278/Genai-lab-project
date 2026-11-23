import { expect, test, type Page } from "@playwright/test";

// Full-page captures for design review (written to e2e-screens/), plus the
// checks that keep the pages presentable: no console errors, no horizontal
// overflow, animations settled into their final state.

const SHOTS = "e2e-screens";

async function settle(page: Page) {
  // Wait for hydration first, or the scroll pass runs before any observers exist.
  await page.waitForLoadState("networkidle");
  // Scroll through so scroll-triggered animations play, then return to the top.
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);
}

for (const scheme of ["light", "dark"] as const) {
  test(`landing renders cleanly (${scheme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask the college.");
    await expect(page.getByRole("img", { name: /Northgate campus gate/ })).toBeVisible();
    await settle(page);
    await expect(page.getByText("137", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/landing-${scheme}.png`, fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test(`chat and admin render cleanly (${scheme})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/chat");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/chat-empty-${scheme}.png` });
    await page.goto("/admin");
    await expect(page.getByRole("tab", { name: /Knowledge gaps/ })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/admin-${scheme}.png` });
    expect(errors).toEqual([]);
  });
}
