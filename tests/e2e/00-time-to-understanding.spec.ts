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

test("CEO: the Command Center says what, how bad and what to do without scrolling", async ({ page }) => {
  await as(page, "Dana Levi");
  await aboveFold(page.getByRole("heading", { level: 1 }).filter({ hasText: /need attention|to watch|on track/ }));
  const first = page.locator("main a[href^='/insights/']").filter({ hasText: /Why:/ }).first();
  await aboveFold(first);
  await aboveFold(first.getByText(/^P[1-4] · \d+$/));
  await aboveFold(page.getByText(/Waiting on you · \d+/));
});

for (const [who, where] of [
  ["Yossi Cohen", "North"],
  ["Avi Mizrahi", "Haifa Grand Canyon"],
  ["Noa Friedman", "Supply Chain"],
] as const) {
  test(`${who}: home is ${where}, and the top item explains itself above the fold`, async ({ page }) => {
    await as(page, who);
    await aboveFold(page.getByRole("heading", { level: 1, name: where }));
    const first = page.locator("main a[href^='/insights/']").filter({ hasText: /Why:/ }).first();
    await aboveFold(first);
    await aboveFold(first.getByText(/^(P[1-4]|O[1-3]) · \d+$/));
    // What to do: a recommendation on the card, or something waiting on this person.
    const todo = first.getByText(/Recommended:|Play:/).or(page.getByText(/Waiting on you · \d+/));
    await aboveFold(todo.first());
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
