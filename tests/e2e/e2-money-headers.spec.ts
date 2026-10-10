/**
 * Plan v2, E2c (FB-5; executive-home.md §6): a ₪ header on every list page, for the viewer's scope and filters.
 * Read-only.
 */
import { expect, type Page, test } from "@playwright/test";

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("Risks, Opportunities, Commitments and Actions each open with their ₪ figures", async ({ page }) => {
  await as(page, "Dana Levi");
  for (const [path, first] of [
    ["/risks", "at stake a week"],
    ["/opportunities", "upside a week"],
    ["/commitments", "a week riding on open commitments"],
    ["/actions", "committed cost"],
  ] as const) {
    await page.goto(path);
    const header = page.getByTestId("money-header");
    await expect(header, path).toBeVisible();
    await expect(header.getByText(first, { exact: true })).toBeVisible();
    await expect(header.getByText(/^₪[\d.,]+[kM]?$/).first()).toBeVisible();
  }
  // The band filter narrows the header with the list.
  await page.goto("/risks");
  const all = await page
    .getByTestId("money-header")
    .getByText(/^₪[\d.,]+[kM]?$/)
    .first()
    .innerText();
  await page.goto("/risks?band=P4");
  const p4 = await page
    .getByTestId("money-header")
    .getByText(/^₪[\d.,]+[kM]?$/)
    .first()
    .innerText();
  expect(p4).not.toBe(all);
});

test("E3a: the value map on Opportunities and Risks — every bubble opens its action item", async ({ page }) => {
  await as(page, "Dana Levi");
  for (const path of ["/opportunities", "/risks"]) {
    await page.goto(path);
    await expect(page.getByTestId("value-map")).toBeVisible();
    const bubbles = page.getByTestId("value-bubble");
    expect(await bubbles.count(), path).toBeGreaterThan(0);
    await expect(page.getByTestId("value-row").first()).toBeVisible();
    // E3c: who needs to act, and the action plan says the next step and who it waits on.
    await expect(page.getByTestId("who-acts")).toBeVisible();
    await expect(
      page
        .getByTestId("action-plan")
        .getByText(/waiting for (a decision|approval)|ready to run|executing/)
        .first(),
    ).toBeVisible();
  }
  await page.goto("/opportunities");
  await expect(page.getByText("Show by value band:")).toBeVisible();
  await expect(page.getByRole("link", { name: /O1\s*pursue now/ })).toBeVisible();
  const href = await page.getByTestId("value-bubble").first().getAttribute("href");
  expect(href).toMatch(/^\/insights\/[0-9a-f-]+#action-[0-9a-f-]+$/);
  await page.goto(href!);
  await expect(page.locator(`[id="${href!.split("#")[1]}"]`)).toBeVisible();
});
