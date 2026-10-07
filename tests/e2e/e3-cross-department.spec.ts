/**
 * Plan v2, E3b (cross-department.md §3–§6): the Cross-department tab. Dana sees the three initiatives that need
 * management first; Hila sees only what HR takes part in; the sponsor's reminder reaches HR, and HR closes the item.
 * Changes the demo (a reminder, a milestone): runs on a fresh reset like the other story specs.
 */
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("Dana sees the three initiatives that need management first, and what waits on her", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.getByRole("link", { name: "Cross-department" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cross-department" })).toBeVisible();
  const rows = page.getByTestId("initiative-row");
  await expect(rows).toHaveCount(8);
  for (const [n, title] of ["North DC recovery", "POS upgrade", "Holiday-season readiness"].entries())
    await expect(rows.nth(n)).toContainText(title);
  await expect(rows.nth(3).getByText(/^M\d$/)).toHaveCount(0);
  const yours = page.getByTestId("your-items");
  await expect(yours).toBeVisible();
  await expect(yours.getByText("Settle Marketing ↔ Finance")).toBeVisible();
  await expect(page.getByTestId("deviations").getByText("M4")).toBeVisible();
});

test("Hila (HR) sees only the initiatives HR takes part in", async ({ page }) => {
  await as(page, "Hila Dahan");
  await page.goto("/initiatives");
  const titles = await page.getByTestId("initiative-row").locator("a").allInnerTexts();
  expect(titles.sort()).toEqual(
    ["Holiday-season readiness", "Monthly budget review", "North DC recovery", "Wage-rule compliance"].sort(),
  );
  expect((await page.goto("/initiatives?i=I-POS"))?.status()).toBe(404);
});

test("the sponsor nudges HR; HR sees the reminder and marks the milestone done", async ({ page }) => {
  await as(page, "Oren Halevi");
  await page.goto("/initiatives?i=I-NORTH-DC");
  const nudge = page.getByTestId("your-item").filter({ hasText: "Nudge HR" }).first();
  await nudge.getByRole("button", { name: "Send reminder" }).click();
  await expect(page.getByText("Reminder sent inside VECTOR.")).toBeVisible();

  await as(page, "Hila Dahan");
  await page.goto("/initiatives?i=I-NORTH-DC");
  const yours = page.getByTestId("your-items");
  await expect(yours.getByText("Reminder from Oren Halevi")).toBeVisible();
  await yours
    .getByTestId("your-item")
    .filter({ hasText: "Temporary DC staff hired" })
    .getByRole("button", { name: "Mark done" })
    .click();
  await expect(page.getByText("Milestone marked done.")).toBeVisible();
  await expect(page.getByTestId("deviations").getByText(/Temporary DC staff hired: \d+ days late/)).toHaveCount(0);
});
