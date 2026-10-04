/**
 * Time-to-Understanding, automated proxy (docs/specs/time-to-understanding.md): each role's home answers
 * what · how bad · what to do above the fold on a 1440×900 screen. Requires a fresh demo reset.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function aboveFold(l: Locator) {
  await expect(l).toBeVisible();
  const box = await l.boundingBox();
  expect(box, "element has a box").not.toBeNull();
  expect(box!.y + Math.min(box!.height, 24), "visible without scrolling").toBeLessThan(900);
}

// what = the headline; how bad = the KPI row and the band of the top item; what to do = Waiting on you (decisions,
// approvals, your tasks) or the recommendation on the top item.
for (const [who, where] of [
  ["Dana Levi", "VECTOR Retail Group"],
  ["Yossi Cohen", "North"],
  ["Avi Mizrahi", "Haifa Grand Canyon"],
  ["Noa Friedman", "Supply Chain"],
] as const) {
  test(`${who}: the home dashboard (${where}) says what, how bad and what to do without scrolling`, async ({
    page,
  }) => {
    await as(page, who);
    await aboveFold(page.getByText(new RegExp(`· ${where}$`)));
    await aboveFold(
      page.getByRole("heading", { level: 1 }).filter({ hasText: /attention|to watch|on track|off target/ }),
    );
    await aboveFold(page.getByText(/^(Key results|Department results)$/));
    const firstKpi = page
      .locator("main")
      .getByText(/^(Target|Usual) /)
      .first();
    await aboveFold(firstKpi);
    await aboveFold(page.getByText(/^Waiting on you · \d+$/));
  });
}

test("any branch is two clicks from the CEO's home", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.getByRole("link", { name: "North", exact: true }).first().click(); // 1: region from Health by region
  await page.waitForURL(/\/units\//);
  await page.getByRole("link", { name: "Haifa Grand Canyon", exact: true }).first().click(); // 2: branch
  await expect(page.getByRole("heading", { level: 1, name: "Haifa Grand Canyon" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Organization" })).toContainText("North");
});
