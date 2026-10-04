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

test("the recall is approved inside Legal; the CEO is informed (runs first: approvals expire after 72 h)", async ({
  page,
}) => {
  await as(page, "Yael Barak");
  await page.goto("/approvals");
  await expect(page.getByText(/Approvals to give · 4/)).toBeVisible();
  await as(page, "Dana Levi");
  await page.goto("/approvals");
  await expect(page.getByText("Quarantine batch 4471", { exact: false })).toHaveCount(0);
});

test("the Haifa story runs end to end", async ({ page }) => {
  await as(page, "Avi Mizrahi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Avi");
  await expect(page.getByText(/1 risk .*in your scope/)).toBeVisible();
  await expect(page.getByText("P1 for Haifa Grand Canyon")).toBeVisible(); // local priority (group-wide P2)
  await page
    .getByRole("link", { name: /Haifa Grand Canyon net sales/ })
    .first()
    .click();
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
  await expect(page.getByText("No approval request is waiting for you.")).toBeVisible();

  await as(page, "Yossi Cohen");
  await page.goto("/approvals");
  const card = page.locator("section").filter({ hasText: /Transfer top-category stock .*Haifa Grand Canyon/ });
  await expect(card.getByText(/AP-4 Inventory transfer/)).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
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
  await page
    .getByRole("link", { name: /Haifa Grand Canyon net sales/ })
    .first()
    .click();
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

test("both workstreams, local priority and the performance dashboards by position", async ({ page }) => {
  await as(page, "Dana Levi");
  await expect(page.getByText(/1\d risks \(4 P1\) and 5 opportunities/)).toBeVisible();
  await expect(page.getByText(/Opportunities · 5/)).toBeVisible();
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "Group performance" })).toBeVisible();
  await expect(page.getByText("Health by region")).toBeVisible();
  await expect(page.getByText("Organization pulse")).toBeVisible();

  await as(page, "Maya Azulay");
  await expect(page.getByText("P2 for Center")).toBeVisible(); // R11: P3 group-wide, P2 for the region (Eran, 2026-10-04)
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "Region performance" })).toBeVisible();
  await expect(page.getByText("Branches in Center")).toBeVisible();

  await as(page, "Lior Ben-Ami");
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "Branch performance" })).toBeVisible();
  await expect(page.getByText("Dependencies on other departments")).toBeVisible();

  await as(page, "Noa Friedman");
  await page.goto("/performance");
  await expect(page.getByRole("heading", { name: "Department performance" })).toBeVisible();
  await expect(page.getByText(/Others depend on us/)).toBeVisible();
});

test("every insight page renders for the CEO and the board observer (regression: 2 pages returned 500)", async ({
  page,
}) => {
  for (const who of ["Dana Levi", "Tal Ben-David"]) {
    await as(page, who);
    await page.goto("/");
    const links = await page
      .locator("main a[href^='/insights/']")
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    expect(links.length).toBeGreaterThanOrEqual(19);
    for (const l of links) {
      const res = await page.goto(l);
      expect(res?.status(), `${who} ${l}`).toBe(200);
      await expect(page.getByRole("heading", { name: "Why am I seeing this?" })).toBeVisible();
    }
  }
});

test("Accept/Decline appears only for people who may decide; decisions are listed in Waiting on you", async ({
  page,
}) => {
  await as(page, "Eitan Rosen");
  await page.goto("/approvals");
  await expect(page.getByText(/Decisions to make · 3/)).toBeVisible();
  await page
    .locator("main a[href^='/insights/']")
    .filter({ hasText: /dairy supplier/ })
    .first()
    .click();
  await page.waitForURL(/\/insights\//);
  await expect(page.getByRole("button", { name: "Accept recommendation" })).toBeVisible();
  const open = page.url();
  // A department manager outside the decision's scope sees who decides, not a button that would be refused.
  await as(page, "Shira Katz");
  await page.goto(open);
  await expect(page.getByRole("button", { name: "Accept recommendation" })).toHaveCount(0);
  await expect(page.getByText(/Waiting for a decision by the manager of Trade & Commercial/)).toBeVisible();
  await as(page, "Tal Ben-David");
  await page.goto(open);
  await expect(page.getByRole("button", { name: "Accept recommendation" })).toHaveCount(0);
});
