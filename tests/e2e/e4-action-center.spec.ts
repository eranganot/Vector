/**
 * Plan v2, E4 (action-center.md §3–§5): Dana acts on the competitor closing near Ramat Gan Ayalon from the Action
 * Center. VECTOR suggests Ronit (who owns the campaign) with reasons and a message; Dana edits it and approves. The
 * ₪35k campaign still needs Maya's approval (AP-3), so the message is held; once Maya approves, it reaches Ronit
 * inside VECTOR. (An approver granting their own routed approval on the same click is covered by the integration test.)
 * Changes the demo: runs on a fresh reset like the other story specs.
 */
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

async function as(page: Page, name: string) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const ITEM = "Competitor store near Ramat Gan Ayalon";
const STEP = "Local welcome campaign around Ramat Gan Ayalon";

test("Dana approves and sends; the message is held until the campaign is approved", async ({ page }) => {
  await as(page, "Dana Levi");
  await page.getByRole("link", { name: "Action Center" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Action Center" })).toBeVisible();
  await expect(page.getByTestId("money-header")).toBeVisible();
  const queue = page.getByTestId("queue-item");
  await expect(queue.first()).toContainText("Stock-outs on top-50 SKUs"); // ranked first: ₪ × urgency × level
  await queue.filter({ hasText: ITEM }).click();
  await expect(page).toHaveURL(/item=/);

  const sel = page.getByTestId("selected-item");
  await expect(sel.getByRole("heading", { name: new RegExp(ITEM) })).toBeVisible();
  await expect(sel.getByTestId("who-involved")).toBeVisible();
  const whom = sel.getByTestId("with-whom");
  await expect(whom.getByRole("combobox")).toHaveValue(/.+/);
  await expect(whom.getByRole("combobox").locator("option:checked")).toHaveText("Ronit Shapiro");
  await expect(whom.getByText(new RegExp(`suggested: owns ${STEP}`))).toBeVisible();
  const willDo = sel.getByTestId("will-do");
  await expect(willDo.getByText(/record your decision to go ahead/)).toBeVisible();
  await expect(willDo.getByText(new RegExp(`ask Maya Azulay to approve “${STEP}”`))).toBeVisible();

  const body = sel.getByRole("textbox", { name: "Message" });
  await expect(body).toHaveValue(/^Ronit,/);
  await body.fill(`${await body.inputValue()}\nPlease start with the flyers this week.`);
  await sel.getByRole("button", { name: "Approve and send" }).click();
  await expect(page.getByRole("status")).toContainText("Approved. The message goes out");
  const msgs = page.getByTestId("item-messages");
  await expect(msgs.getByText("waiting for approval")).toBeVisible();
  await expect(msgs.getByText("edited")).toBeVisible();
});

test("Ronit does not see the message before the approval; after Maya approves, she does", async ({ page }) => {
  await as(page, "Ronit Shapiro");
  await page.goto("/approvals");
  await expect(page.getByTestId("messages-for-you")).toHaveCount(0);

  await as(page, "Maya Azulay");
  await page.goto("/approvals");
  const card = page.locator("section", { has: page.getByRole("heading", { level: 2, name: STEP }) });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status")).toContainText("Approved");

  await as(page, "Ronit Shapiro");
  await page.goto("/approvals");
  const inbox = page.getByTestId("messages-for-you");
  await expect(inbox).toBeVisible();
  await expect(inbox.getByText("Please start with the flyers this week.")).toBeVisible();
  await expect(inbox.getByText(/from Dana Levi/)).toBeVisible();
});

test("Hebrew: the Action Center reads right-to-left with the suggestion in Hebrew", async ({ page, context }) => {
  await as(page, "Dana Levi");
  await context.addCookies([{ name: "vector_lang", value: "he", url: page.url() }]);
  await page.goto("/action-center");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "מרכז הפעולות" })).toBeVisible();
  const body = page.getByTestId("selected-item").getByRole("textbox", { name: "הודעה" });
  await expect(body).toHaveValue(/[֐-׿]/);
});
