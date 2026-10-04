import { expect, test } from "@playwright/test";

test("health endpoint reports ok with database and migrations", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db.ok).toBe(true);
  expect(body.migrations.pending).toBe(0);
});

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "VECTOR" })).toBeVisible();
});
