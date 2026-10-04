/**
 * Hebrew and right-to-left (Eran, 2026-10-05: "add Hebrew as a language … make the dashboard also RTL (let the user
 * choose the language)"). Read-only: holds on any demo state, so it can run anywhere in the suite.
 */
import { expect, test } from "@playwright/test";

const HEBREW = /[֐-׿]/;

test("the reader chooses Hebrew: the whole app turns right-to-left, names and data included, and back", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "עברית" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.getByRole("heading", { name: "כניסה" })).toBeVisible();

  // Persona names are in Hebrew too.
  await page.getByRole("button", { name: /איתן רוזן/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const nav = page.getByRole("navigation", { name: "ניווט ראשי", exact: true });
  for (const label of ["בית", "סיכונים", "הזדמנויות", "התחייבויות", "פעולות ותוצאות", "ארגון", "ממתין לך"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  // The headline is a Hebrew sentence; the department is named in Hebrew.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEBREW);
  await expect(page.getByText("סחר ומסחר").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "תוצאות המחלקה" })).toBeVisible();

  // An insight: title, story and recommendation in Hebrew.
  await nav.getByRole("link", { name: "סיכונים" }).click();
  await page.locator('a[href^="/insights/"]').first().click();
  await page.waitForURL(/\/insights\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEBREW);
  await expect(page.getByText("למה אני רואה את זה?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "מה צריך לקרות" })).toBeVisible();

  // Back to English, on the same page.
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Why am I seeing this?")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Home" }),
  ).toBeVisible();
});
