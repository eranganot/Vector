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
    await page.locator("summary").first().click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
  }
  await expect(page.locator("summary").first()).toContainText(name);
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
  // Phase 3: a branch manager's home is their branch's dashboard.
  await expect(page.getByText(/Good (morning|afternoon|evening), Avi · Haifa Grand Canyon/)).toBeVisible();
  await expect(page.getByText(/Risks · 1/)).toBeVisible();
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
  // The Haifa insight resolved in the story above: it is listed under "Recently resolved" on Avi's Risks tab.
  await as(page, "Avi Mizrahi");
  await page.goto("/risks");
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

test("every home is a dashboard: KPIs, actions, risk and opportunity summary, dependencies (Eran, 2026-10-04)", async ({
  page,
}) => {
  // Plan v2, E2: the C-suite home (executive-home.md) carries the same summaries, more visually.
  await as(page, "Dana Levi");
  for (const t of ["Organization pulse", "Today's priorities", "Risks & opportunities", "Money vs budget"])
    await expect(page.getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByText(/^Waiting on you · \d+$/)).toBeVisible();
  await expect(page.getByText("Dependencies", { exact: true })).toBeVisible();
  // Summaries only: the full lists are the Risks and Opportunities tabs.
  await page.getByRole("link", { name: "All →" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Risks · VECTOR Retail Group" })).toBeVisible();
  await page.getByRole("link", { name: /^P1/ }).first().click();
  await expect(page).toHaveURL(/band=P1/);
  await page.getByRole("link", { name: "Opportunities", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Opportunities · VECTOR Retail Group" })).toBeVisible();

  await as(page, "Maya Azulay");
  await expect(page.getByText(/Maya · Center$/)).toBeVisible();
  await expect(page.getByText("Branches in Center")).toBeVisible();
  await page.goto("/risks");
  await expect(page.getByText("P2 for Center")).toBeVisible(); // R11: P3 group-wide, P2 for the region (Eran, 2026-10-04)

  await as(page, "Lior Ben-Ami");
  await expect(page.getByText(/Lior · Tel Aviv Dizengoff$/)).toBeVisible();
  await expect(page.getByText("Dependencies", { exact: true })).toBeVisible();

  await as(page, "Noa Friedman");
  await expect(page.getByRole("heading", { level: 1, name: "Supply Chain" })).toBeVisible();
  await expect(page.getByText("By region", { exact: true })).toBeVisible();
  await expect(page.getByText(/Waiting on us|Others depend on us/).first()).toBeVisible();
  await expect(page.getByText(/tasks? you own/)).toBeVisible(); // actions she must take, not only approvals
  await page.goto("/performance"); // the Phase 2 address now leads to your dashboard
  await expect(page).toHaveURL(/\/$/);
});

test("a unit outside your scope looks missing (404), on its page and its Risks tab", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/org");
  // Branches sit inside a collapsed region; read the link without opening it.
  const href = await page
    .locator("main a", { hasText: /^Haifa Grand Canyon$/ })
    .first()
    .getAttribute("href");
  const unit = new URL(href!, page.url()).toString();
  const id = unit.split("/units/")[1];
  await as(page, "Maya Azulay");
  expect((await page.goto(unit))?.status()).toBe(404);
  expect((await page.goto(`/risks?unit=${id}`))?.status()).toBe(404);
});

test("every insight page renders for the CEO and the board observer (regression: 2 pages returned 500)", async ({
  page,
}) => {
  for (const who of ["Dana Levi", "Tal Ben-David"]) {
    await as(page, who);
    const links: string[] = [];
    for (const tab of ["/risks", "/opportunities"]) {
      await page.goto(tab);
      links.push(
        ...(await page
          .locator("main a[href^='/insights/']")
          // Value-map bubbles link to an action on the same pages (#action-…): check each page once.
          .evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("#")[0]))),
      );
    }
    links.splice(0, links.length, ...new Set(links));
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
  // 3 catalog decisions, plus (Phase 4) his overdue dairy-response commitment, minus the R12 conflict, which escalated
  // to the CEO (Q1: undecided 2 days before its overlap) when the story advanced the clock 8 days; plus MK2 (E6b).
  await expect(page.getByText(/Decisions to make · 4/)).toBeVisible();
  await expect(page.getByText(/Agree the response to Dairy Co.*overdue/).first()).toBeVisible();
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
