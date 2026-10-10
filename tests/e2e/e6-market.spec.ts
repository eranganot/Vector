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
  await expect(changed.getByTestId("market-change")).toHaveCount(3);
  await expect(changed).toContainText("Dairy in North is +13.2% above the market");
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

test("E6c: every card says what it means; we sit in the competitor comparison; growth & expansion", async ({
  page,
}) => {
  await as(page, "Dana Levi");
  await page.goto("/market");
  for (const id of [
    "food-vs-ours",
    "cbs-categories",
    "basket-by-chain",
    "basket-heatmap",
    "competitors",
    "growth-quarters",
    "market-share",
    "margins",
    "baskets",
    "growth-table",
  ])
    await expect(page.getByTestId(id).getByTestId("takeaway")).toContainText("What it means");
  await expect(page.getByTestId("cbs-legend")).toContainText("dearer than a year ago");
  await expect(page.getByTestId("competitor-us")).toContainText("VECTOR Retail Group");
  await expect(page.getByTestId("growth-table")).toContainText("not reported");
  await expect(page.getByTestId("growth-table")).toContainText("19.8%"); // Shufersal online share, Q1 2025 (reported)
  await expect(page.getByTestId("baskets")).toContainText("₪");
});

test("E6c: the price gap insight compares us with every chain", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/market");
  await page
    .getByTestId("market-changed")
    .getByRole("link", { name: /Dairy in North/ })
    .click();
  const ev = page.getByTestId("market-evidence").first();
  for (const chain of ["Shufersal", "Rami Levy", "Osher Ad", "Yohananof", "Tiv Taam"])
    await expect(ev).toContainText(chain);
});

test("E6d: Reports shows the Ask-your-data chat as a preview only", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/reports");
  const chat = page.getByTestId("report-chat-preview");
  await expect(chat).toContainText("Preview · not active yet");
  await expect(chat.getByRole("textbox")).toBeDisabled();
  await expect(chat.getByRole("button", { name: "Ask" })).toBeDisabled();
});
