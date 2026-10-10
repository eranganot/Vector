/**
 * Plan v2, E7 (mail-agent.md): the Inbox — decisions first, impact and recommendation, prepared follow-up answers,
 * a suggested reply approved and sent in VECTOR only; Hebrew; only the C-suite has one. Changes the demo (a reply).
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

test("Hebrew: the Inbox reads right to left, threads included", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/inbox");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "תיבת דואר" })).toBeVisible();
  await expect(page.getByTestId("inbox-decision")).toContainText("שעות נוספות למשמרת שנייה במרכז ההפצה בצפון");
});

test("Dana's Inbox: a decision with impact, a prepared answer, and a reply approved and sent", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.getByTestId("inbox-summary")).toContainText("2 wait for your reply · 1 need a decision");
  const decision = page.getByTestId("inbox-decision").getByTestId("inbox-thread");
  await expect(decision).toHaveCount(1);
  await decision.click();
  const sel = page.getByTestId("inbox-selected");
  await expect(sel).toContainText("Overtime for the North DC second shift");
  await expect(sel.getByTestId("inbox-impact")).toContainText("VECTOR recommends");
  await expect(sel.getByTestId("inbox-link")).toHaveAttribute("href", /\/insights\//);
  await sel.getByTestId("followup").filter({ hasText: "What does it cost?" }).click();
  await expect(page.getByTestId("followup-answer")).toContainText("pays back in about");
  const box = page.getByTestId("inbox-reply").getByRole("textbox");
  await box.fill("Michal, approved as an exception: ₪180k cap, two weeks, review on day 7. Thanks. Dana");
  await page.getByTestId("send-reply").click();
  await expect(page.getByRole("status")).toContainText("Reply sent");
  await expect(page.getByTestId("inbox-selected")).toContainText("sent from VECTOR");
  await expect(page.getByTestId("inbox-decision")).toHaveCount(0);
  await expect(page.getByTestId("inbox-done")).toContainText("Overtime for the North DC second shift");
});

test("Michal reads Dana's reply in Waiting on you; a branch manager has no Inbox", async ({ page }) => {
  await as(page, "Michal Golan");
  await page.goto("/approvals");
  await expect(page.getByTestId("messages-for-you")).toContainText("Re: Overtime for the North DC second shift");
  await as(page, "Avi Mizrahi");
  await expect(page.getByRole("link", { name: /^Inbox/ })).toHaveCount(0);
});
