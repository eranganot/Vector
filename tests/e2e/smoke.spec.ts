import { expect, test } from "@playwright/test";

test("health endpoint reports ok with database and migrations", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db.ok).toBe(true);
  expect(body.migrations.pending).toBe(0);
});

test("home page renders with the product's full name (FB-2)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "VECTOR | Organizational Intelligence" })).toBeVisible();
  await expect(page).toHaveTitle("VECTOR | Organizational Intelligence");
});

test('in Hebrew the name is "VECTOR | אינטליגנציה ארגונית" (FB-2)', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "vector_lang", value: "he", url: baseURL ?? "http://localhost:3000" }]);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "VECTOR | אינטליגנציה ארגונית" })).toBeVisible();
  await expect(page).toHaveTitle("VECTOR | אינטליגנציה ארגונית");
});
