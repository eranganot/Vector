/**
 * Plan v2, E1b (ADR-008): the CFO and the COO land on the whole group; the C-suite navigation puts what waits on
 * you right after Home; a VP still sees only their department. Requires a fresh demo reset.
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

const navLabels = async (page: Page) =>
  (await page.getByRole("navigation", { name: "Main" }).getByRole("link").allInnerTexts()).map((t) =>
    t.replace(/\s*\d+$/, "").trim(),
  );

test.use({ viewport: { width: 1440, height: 900 } });

for (const who of ["Michal Golan", "Oren Halevi"]) {
  test(`${who} reads the whole group and has the C-suite navigation`, async ({ page }) => {
    await as(page, who);
    await expect(page.getByText(/· VECTOR Retail Group$/)).toBeVisible();
    expect((await navLabels(page)).slice(0, 2)).toEqual(["Home", "Waiting on you"]);
  });
}

test("a VP (Hila, HR) stays on her department", async ({ page }) => {
  await as(page, "Hila Dahan");
  await expect(page.getByText(/· HR$/)).toBeVisible();
  expect((await navLabels(page)).slice(0, 2)).toEqual(["Home", "Waiting on you"]);
});

test("a regional manager keeps the original navigation", async ({ page }) => {
  await as(page, "Yossi Cohen");
  expect((await navLabels(page))[1]).toBe("Risks");
});
