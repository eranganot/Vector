/**
 * Phase 2 acceptance through the UI on two personas (plus Admin for the clock and Dana to review):
 * Avi accepts VECTOR's recommendation → Yossi approves → execution (simulated) → clock +8 days →
 * the outcome is 'worked', the insight resolves, and the audit trail shows every step.
 * Requires a freshly reset demo (pnpm demo:reset) and DEMO_PERSONAS=on.
 */
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function as(page: Page, name: string) {
  await page.goto("/login");
  if (await page.getByRole("button", { name: new RegExp(name) }).count()) {
    await page
      .getByRole("button", { name: new RegExp(name) })
      .first()
      .click();
  } else {
    await page.goto("/");
    await page.locator("summary").click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
  }
  await expect(page.locator("summary")).toContainText(name);
}

test("the Haifa story runs end to end", async ({ page }) => {
  await as(page, "Avi Mizrahi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1 insight needs attention");
  await page.getByRole("link", { name: /Haifa Grand Canyon net sales/ }).click();
  await page.waitForURL(/\/insights\//);
  await expect(page.getByRole("heading", { name: "Why am I seeing this?" })).toBeVisible();
  await expect(page.getByText("Priority breakdown")).toBeVisible();
  const trace = page.url();
  await page.getByLabel("Note").fill("Stock is the cause");
  await page.getByRole("button", { name: "Accept recommendation" }).click();
  await expect(page.getByText("Pending approval")).toBeVisible();
  // Evaluated at submission (A2): the policy names the rule and who may approve.
  await expect(page.getByText(/Needs approval: AP-4 inventory transfer/)).toBeVisible();

  // The owner of the transfer (Noa) gets no approval request: separation of duties.
  await as(page, "Noa Friedman");
  await page.goto("/approvals");
  await expect(page.getByText("Nothing is waiting for you.")).toBeVisible();

  await as(page, "Yossi Cohen");
  await page.goto("/approvals");
  await expect(page.getByText(/AP-4 Inventory transfer/)).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. Execution started (simulated).")).toBeVisible();

  await as(page, "Ops Admin");
  await page.goto("/admin/demo");
  await page.getByRole("button", { name: /\+8 days/ }).click();
  await expect(page.getByText("Clock advanced")).toBeVisible();

  await as(page, "Dana Levi");
  await page.goto(trace);
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
  await expect(page.getByText(/Outcome: worked/)).toBeVisible();
  for (const op of [
    "insight.created",
    "decision.decided",
    "approval.granted",
    "action.executed",
    "outcome.evaluated",
    "insight.resolved",
  ]) {
    await expect(page.getByText(op, { exact: true }).first()).toBeVisible();
  }
  await page.goto("/audit");
  await expect(page.getByText("Hash chain verified ✓")).toBeVisible();
});

test("out-of-scope insights look missing (404), and viewers get no decision buttons", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/");
  await page.getByRole("link", { name: /Haifa Grand Canyon net sales/ }).click();
  await page.waitForURL(/\/insights\//);
  const trace = page.url();
  await as(page, "Maya Azulay");
  const res = await page.goto(trace);
  expect(res?.status()).toBe(404);
  await expect(page.locator("main").getByText(/net sales/)).toHaveCount(0); // no insight data in the body
  await as(page, "Tal Ben-David");
  await page.goto(trace);
  await expect(page.getByRole("button", { name: "Accept recommendation" })).toHaveCount(0);
});
