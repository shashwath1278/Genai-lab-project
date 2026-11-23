import { expect, test } from "@playwright/test";

// Staff dashboard: upload, find and delete a document; usage numbers render.

test("upload a document, see it indexed, delete it", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/admin");
  await page.getByRole("tab", { name: /Documents/ }).click();

  await page.getByLabel("File").setInputFiles({
    name: "robotics-lab.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Robotics lab\n\n## Opening hours\n\nThe robotics lab is open 9 am to 9 pm on weekdays for club members.\n"),
  });
  await page.getByLabel("Title").fill("Robotics Lab Hours");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status")).toContainText('Added "Robotics Lab Hours"');

  const row = page.getByRole("row").filter({ hasText: "Robotics Lab Hours" });
  await expect(row).toContainText("Uploaded");
  await row.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByRole("status")).toContainText("Deleted");
  await expect(page.getByRole("row").filter({ hasText: "Robotics Lab Hours" })).toHaveCount(0);
});

test("usage tab shows question statistics", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("tab", { name: /Usage/ }).click();
  await expect(page.getByText("Questions asked")).toBeVisible();
  await expect(page.getByText("Retrieval confidence")).toBeVisible();
  await expect(page.getByText("Recent questions")).toBeVisible();
});
