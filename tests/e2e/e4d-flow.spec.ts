/**
 * Plan v2, E4d (Eran's E4 review): the event → action plan says what each task is, who waits on it and the ₪ of
 * doing it late, with late tasks in red; and Cross-department shows how a delay travels between departments, with a
 * what-if. Read-only.
 */
import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("event → action plan: late tasks first and red, with who waits, the ₪ and a next step", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/action-center");
  const plan = page.getByTestId("event-plan");
  await expect(plan.getByText("Weekly ops meeting · 15 Oct")).toBeVisible();
  const tasks = plan.getByTestId("event-task");
  await expect(tasks).toHaveCount(4);
  await expect(tasks.first()).toHaveAttribute("data-status", "late");
  const status = tasks.first().getByTestId("event-task-status");
  await expect(status).toHaveText(/^Late · \d+ d past/);
  await expect(status).toHaveCSS("color", "rgb(248, 113, 113)");
  const signage = tasks.filter({
    has: page.locator("b", { hasText: "Holiday promo signage and shelf talkers for 60 branches" }),
  });
  await expect(signage.getByText("Who waits on it")).toBeVisible();
  await expect(signage.getByText(/Store Operations/).first()).toBeVisible();
  await expect(signage.getByTestId("event-task-money").getByText("Each week it slips")).toBeVisible();
  await expect(signage).toHaveCount(1);
  await expect(signage.getByText(/Next step:/)).toBeVisible();
});

test("cross-department: a what-if delay at Marketing reaches Store Operations and the regions", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/initiatives?i=I-HOLIDAY");
  const flow = page.getByTestId("dependency-flow");
  await expect(flow.getByTestId("flow-node")).toHaveCount(6);
  await expect(flow.getByTestId("flow-end")).toHaveCount(1);
  await flow
    .getByTestId("what-if")
    .locator("li", { hasText: "Holiday promo signage" })
    .getByRole("link", { name: "+7 d" })
    .click();
  await expect(page).toHaveURL(/wd=7/);
  await expect(flow.getByTestId("flow-summary")).toContainText(/Store Operations.*get it late/);
  await expect(flow.locator('[data-testid="flow-edge"][data-late="true"]').first()).toBeVisible();
  await expect(flow.getByTestId("knock-on-table")).toContainText("North, Coast, Center, Jerusalem, South");
});

test("Hebrew: the flow reads right to left", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/initiatives?i=I-HOLIDAY");
  await expect(page.getByTestId("dependency-flow").getByText("איך עיכוב עובר בין מחלקות")).toBeVisible();
});

test("E4e: the department map says who acts now, the order, and where the blockers are", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.goto("/initiatives?i=I-HOLIDAY");
  const map = page.getByTestId("progress-map");
  await expect(map.getByTestId("relay-now")).toContainText("Now: HR must act.");
  await expect(map.getByTestId("relay-step").first()).toContainText("Step 1 · starts");
  await expect(map.locator('[data-testid="relay-arrow"][data-late="true"]').first()).toContainText("held up");
  await expect(map.getByTestId("relay-blocker").first()).toContainText("Blocked:");
  await expect(map.getByText(/Order: when each department starts its part/)).toBeVisible();
});

test("E4e: in Hebrew the due date and the next step keep their space", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/initiatives?i=I-HOLIDAY");
  const due = page.getByTestId("work-row").first().locator("td").nth(2);
  await expect(due).toHaveCSS("direction", "rtl");
  await expect(due).toHaveCSS("padding-left", "16px");
  await expect(due).toHaveText(/^\d{1,2} \S+$/);
});
