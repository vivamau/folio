const { test, expect } = require("@playwright/test");
test("login, create catalog and expense, edit, reload, delete, logout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page.getByRole("button", { name: "Add shop", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Test Market");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Coffee");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page
    .getByLabel("Shop", { exact: true })
    .selectOption({ label: "Test Market" });
  await page
    .getByLabel("Item 1", { exact: true })
    .selectOption({ label: "Coffee" });
  await page.getByLabel("Unit price 1").fill("4.50");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Edit expense/ }).click();
  await page.getByLabel("Notes").fill("Morning coffee");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByText("Morning coffee")).toBeVisible();
  await page.getByRole("button", { name: /Delete expense/ }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("No expenses found")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("dashboard works at desktop and mobile sizes without overflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const category = await (
    await page.request.post("/api/categories", {
      data: { name: "Food & drink" },
    })
  ).json();
  const item = await (
    await page.request.post("/api/items", {
      data: { name: "Lunch", categoryId: category.id },
    })
  ).json();
  const shop = await (
    await page.request.post("/api/shops", {
      data: { name: "The Green Table", address: "City centre" },
    })
  ).json();
  for (const [date, price] of [
    ["2026-07-12", "18.50"],
    ["2026-08-14", "24.90"],
    ["2026-09-03", "32.00"],
  ]) {
    const response = await page.request.post("/api/invoices", {
      data: {
        date,
        shopId: shop.id,
        currency: "EUR",
        notes: "Lunch with friends",
        lines: [{ itemId: item.id, quantity: 1, unitPrice: price }],
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.reload();
  await expect(page.getByText("€75.40").first()).toBeVisible();
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("a KES expense is visible after save, on both pages, and after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  await page.getByLabel("Search expenses").fill("hide this");
  await page.getByLabel("From date").fill("2030-01-01");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page
    .getByLabel("Shop", { exact: true })
    .selectOption({ label: "Test Market" });
  await page
    .getByLabel("Item 1", { exact: true })
    .selectOption({ label: "Coffee" });
  await page
    .getByLabel("Expense currency", { exact: true })
    .selectOption("KES");
  await page.getByLabel("Unit price 1").fill("100");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("KES");
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("KES");
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();
});
