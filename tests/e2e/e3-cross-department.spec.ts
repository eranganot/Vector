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

test("E3c: status tiles filter the items; an item, a deviation or a Gantt bar opens its card with analysis and recommendation", async ({
  page,
}) => {
  await as(page, "Dana Levi");
  await page.goto("/initiatives?i=I-NORTH-DC");
  const rows = page.getByTestId("work-row");
  const all = await rows.count();
  await page.getByTestId("filter-done").click();
  await expect(page).toHaveURL(/f=done/);
  const done = await rows.count();
  expect(done).toBeGreaterThan(0);
  expect(done).toBeLessThan(all);
  await expect(rows.filter({ hasText: "late" })).toHaveCount(0);
  await page.getByTestId("filter-done").click(); // again: clears the filter
  await expect(rows).toHaveCount(all);

  await rows.filter({ hasText: "Temporary DC staff hired" }).getByRole("link").first().click();
  const card = page.getByTestId("item-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("Analysis")).toBeVisible();
  await expect(card.getByTestId("item-recommendation")).not.toBeEmpty();

  await page.getByTestId("deviation-link").filter({ hasText: "Decision between units" }).click();
  await expect(card.getByRole("heading", { name: /Overtime budget waits/ })).toBeVisible();
  await expect(card.getByRole("button", { name: "Resolve" })).toBeVisible();
});

test("E3c: the top bar and the sidebar stay on screen while the page scrolls", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/initiatives");
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(300);
  const header = await page.locator("header").first().boundingBox();
  const nav = await page.getByRole("navigation", { name: "Main", exact: true }).boundingBox();
  expect(header!.y).toBeLessThanOrEqual(1);
  expect(nav!.y).toBeLessThan(200);
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
