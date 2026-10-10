/**
 * Plan v2, E6 (market-intelligence.md §5): the Market & competitors tab — CBS food prices, the basket vs the chains,
 * the category heatmap, competitors with sources and labelled estimates, region filter; Hebrew. Read-only.
 */
import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("Dana reads the market: real CBS and chains, our synthetic prices, sources and estimates", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.getByRole("link", { name: "Market & competitors" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Market & competitors" })).toBeVisible();
  await expect(page.getByTestId("money-header")).toContainText("food prices y/y, CBS");
  await expect(page.getByTestId("basket-by-chain")).toContainText("Shufersal");
  await expect(page.getByTestId("basket-by-chain")).toContainText("Rami Levy");
  await expect(page.getByTestId("basket-heatmap").getByTestId("heat-cell")).toHaveCount(6 * 7);
  const table = page.getByTestId("competitor-table");
  await expect(table.getByRole("link", { name: "Globes, 27 Aug 2026" })).toHaveAttribute("href", /globes\.co\.il/);
  await expect(table.getByText("Estimate").first()).toBeVisible();
  await page.getByTestId("market-regions").getByRole("link", { name: "North" }).click();
  await expect(page).toHaveURL(/r=NORTH/);
  await expect(page.getByTestId("money-header")).toContainText("North");
});

test("Hebrew: the market tab reads right to left", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/market");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "שוק ומתחרים" })).toBeVisible();
});

test("What changed outside: MK2 and MK3 link to insights with their real sources (E6b)", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/market");
  const changed = page.getByTestId("market-changed");
  await expect(changed.getByTestId("market-change")).toHaveCount(2);
  await expect(changed).toContainText("Our prices rose while food prices fell (July and August)");
  await changed.getByRole("link", { name: /Shufersal is shrinking/ }).click();
  await expect(page).toHaveURL(/\/insights\//);
  await expect(page.getByTestId("market-evidence").first()).toContainText("Same-store sales");
  await expect(page.getByRole("link", { name: "Open the source" }).first()).toHaveAttribute("href", /globes\.co\.il/);
});

test("Hebrew: market insights and chain names are translated", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/market");
  const changed = page.getByTestId("market-changed");
  await expect(changed).toContainText("המחירים שלנו עלו בזמן שמחירי המזון ירדו (יולי ואוגוסט)");
  await expect(changed).toContainText("שופרסל מצטמקת");
  await expect(page.getByTestId("basket-by-chain")).toContainText("רמי לוי");
});
