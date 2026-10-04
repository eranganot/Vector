/**
 * Phase 4 through the UI (docs/phases/PHASE_4.md demo): commitments, live conflicts, dependencies on dashboards.
 * Runs after phase2-story (files run in name order on one shared demo): the clock is then 8 days on, so the
 * dairy-response commitment is overdue and its dependents are blocked or at risk.
 */
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("Marketing records a weekend promotion; VECTOR flags the conflict with Trade's delisting at once", async ({
  page,
}) => {
  await as(page, "Ronit Shapiro");
  await page.getByRole("link", { name: "Commitments", exact: true }).click();
  await page.getByText("+ Record a commitment").click();
  const f = page.locator("form", { has: page.getByRole("button", { name: "Record commitment" }) });
  await f.locator('input[name="title"]').fill("Weekend dairy discount in South");
  await f.locator('select[name="ownerUnitId"]').selectOption({ label: "Marketing" });
  await f.locator('input[name="dueAt"]').fill("2026-10-31T06:00");
  await f.locator('input[name="source"]').fill("Promo calendar");
  await f.locator('select[name="beneficiaryUnitIds"]').selectOption({ label: "South" });
  await f.locator('input[name="impactIls"]').fill("40000");
  await f.locator('input[name="resource"]').fill("sku-set:south-dairy-6");
  await f.locator('select[name="effect"]').selectOption("promote");
  await f.locator('input[name="windowStart"]').fill("2026-10-31");
  await f.locator('input[name="windowEnd"]').fill("2026-11-02");
  await f.getByRole("button", { name: "Record commitment" }).click();
  await expect(page.getByText(/collides with another unit's plan/)).toBeVisible();

  await page.getByRole("link", { name: "See the conflict →" }).click();
  await page.waitForURL(/\/insights\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("collides with Trade & Commercial");
  await expect(page.getByText("The plans that collide")).toBeVisible();
  await expect(page.getByText("Delist 6 dairy items at South branches").first()).toBeVisible();
  await expect(page.getByText("Weekend dairy discount in South").first()).toBeVisible();
  // Q1: Marketing recorded second, so Marketing decides.
  await expect(page.getByRole("button", { name: "Accept recommendation" })).toBeVisible();

  // Trade's head is asked to confirm his plan (a task he owns).
  await as(page, "Eitan Rosen");
  await expect(page.getByText(/Confirm your plan with Marketing: Delist 6 dairy items/)).toBeVisible();
});

test("cancelling one side resolves the conflict; the trace says why", async ({ page }) => {
  await as(page, "Eitan Rosen");
  await page.goto("/commitments");
  const card = page.getByRole("article", { name: "Commitment: Delist 6 dairy items at South branches" });
  await card.getByText("Cancel", { exact: true }).click();
  const cancel = card.locator("form", { has: page.getByRole("button", { name: "Cancel the commitment" }) });
  await cancel.locator('input[name="rationale"]').fill("Keep the six items through the holiday");
  await cancel.getByRole("button", { name: "Cancel the commitment" }).click();
  await expect(page.getByText("Commitment cancelled.")).toBeVisible();

  await as(page, "Ronit Shapiro");
  await page.goto("/risks");
  await page
    .getByRole("link", { name: /Weekend dairy discount in South/ })
    .first()
    .click();
  await expect(page.getByText(/Conflict resolved \(a commitment was cancelled\)/)).toBeVisible();
});

test("dependencies on every home: the CEO's bottlenecks, Finance blocked on Trade's late dairy response", async ({
  page,
}) => {
  await as(page, "Dana Levi");
  await expect(page.getByText("Dependencies", { exact: true })).toBeVisible();
  await expect(page.getByText("Bottlenecks")).toBeVisible();
  await expect(page.getByText(/\d+% on time/).first()).toBeVisible();
  await page.goto("/commitments");
  await expect(page.getByText("Agree the response to Dairy Co.'s +7% price increase").first()).toBeVisible();
  await expect(page.getByText(/\d+ days? overdue/).first()).toBeVisible();

  await as(page, "Michal Golan");
  const deps = page
    .locator("section, div")
    .filter({ has: page.getByText("We're waiting on", { exact: false }) })
    .last();
  await expect(deps.getByText(/Finance waits on Trade & Commercial/).first()).toBeVisible();
  await expect(page.getByText(/Blocked|At risk/).first()).toBeVisible();
});

test("a unit's commitments outside your scope look missing (404)", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/org");
  const href = await page
    .locator("main a", { hasText: /^Marketing$/ })
    .first()
    .getAttribute("href");
  const id = href!.split("/units/")[1];
  await as(page, "Avi Mizrahi");
  expect((await page.goto(`/commitments?unit=${id}`))?.status()).toBe(404);
});

test("approval workflow: an amendment is a new revision; its author is not asked; the approver sees why, who else, and history", async ({
  page,
}) => {
  await as(page, "Yossi Cohen");
  await page.goto("/risks");
  await page
    .getByRole("link", { name: /Stock-outs on top-50 SKUs/ })
    .first()
    .click();
  await page.waitForURL(/\/insights\//);
  const box = page.locator("div.rounded-lg", {
    has: page.getByText("Weekend staffing uplift, 9 North branches", { exact: true }),
  });
  await box.getByText("Amend…").click();
  await box.locator('input[name="estimatedCost"]').fill("40000");
  await box.locator('input[name="note"]').fill("8 branches; Nazareth is already staffed");
  await box.getByRole("button", { name: /Save revision/ }).click();
  await expect(box.getByText(/cost ₪40,000/)).toBeVisible();
  await expect(box.getByText("Pending approval")).toBeVisible();
  // AZ-2: the author of a revision is never asked to approve it.
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { level: 2, name: "Weekend staffing uplift, 9 North branches" })).toHaveCount(
    0,
  );

  await as(page, "Dana Levi");
  await page.goto("/approvals");
  const card = page.locator("div", {
    has: page.getByRole("heading", { level: 2, name: "Weekend staffing uplift, 9 North branches" }),
  });
  await expect(card.last().getByText(/Nobody else is asked/)).toBeVisible();
  await expect(card.last().getByText(/revision 2/)).toBeVisible();
  await expect(card.last().getByText(/request expires in about \d+ h/)).toBeVisible();
  await card.last().getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. Execution started (simulated).")).toBeVisible();
  const history = page.locator("section", { has: page.getByText(/Your recent answers/) });
  await expect(history.getByText("Weekend staffing uplift, 9 North branches")).toBeVisible();
  await expect(history.getByText("Approved").first()).toBeVisible();
});

test("acknowledge and dismiss an insight from its trace (audited, with a reason)", async ({ page }) => {
  await as(page, "Maya Azulay");
  await page.goto("/risks");
  await page
    .getByRole("link", { name: /Labor cost 6% over plan/ })
    .first()
    .click();
  await page.waitForURL(/\/insights\//);
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("acknowledged", { exact: true })).toBeVisible();
  await page.getByText("Dismiss…").click();
  const dismiss = page.locator("form", { has: page.getByRole("button", { name: "Dismiss insight" }) });
  await dismiss.locator('input[name="rationale"]').fill("Seasonal hiring; plan updated next week");
  await dismiss.getByRole("button", { name: "Dismiss insight" }).click();
  await expect(page.getByText("dismissed", { exact: true })).toBeVisible();
  await expect(page.getByText(/insight\.dismissed/)).toBeVisible();
});

test("closed loop: Avi records the lesson of the Haifa transfer; the next stock transfer shows it", async ({
  page,
}) => {
  await as(page, "Avi Mizrahi");
  await page.getByRole("link", { name: "Actions & outcomes" }).click();
  await page.getByRole("link", { name: /Outcomes & lessons · 1 to review/ }).click();
  const card = page
    .locator("div", { has: page.getByRole("link", { name: /Transfer top-category stock Haifa Downtown/ }) })
    .filter({
      has: page.getByRole("button", { name: "Record lesson" }),
    });
  await expect(card.last().getByText("Worked", { exact: true }).first()).toBeVisible();
  await card
    .last()
    .locator('input[name="lesson"]')
    .fill("Move stock from a sister branch within 24 h; it beats waiting for the DC");
  await card.last().getByRole("button", { name: "Record lesson" }).click();
  await page.waitForURL(/\/insights\//);
  await expect(page.getByText(/Lesson: Move stock from a sister branch/)).toBeVisible();

  await as(page, "Yossi Cohen");
  await page.goto("/risks");
  await page
    .getByRole("link", { name: /Stock-outs on top-50 SKUs/ })
    .first()
    .click();
  await expect(page.getByText("Last time we did this")).toBeVisible();
  await expect(page.getByText(/Move stock from a sister branch within 24 h/)).toBeVisible();

  await page.goto("/actions?f=approval");
  await expect(page.getByRole("table")).toBeVisible();
  await page.goto("/actions?tab=outcomes");
  await expect(page.getByText(/“Move stock from a sister branch within 24 h/)).toBeVisible();
});
