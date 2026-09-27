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
  const categoryPanel = page.getByRole("region", { name: "By category" });
  const timePanel = page.locator(".overview-insights > section").first();
  const categoryBounds = await categoryPanel.boundingBox();
  const timeBounds = await timePanel.boundingBox();
  expect(categoryBounds.y).toBeGreaterThan(timeBounds.y + timeBounds.height);
  expect(categoryBounds.width).toBeCloseTo(timeBounds.width, 0);
  await page.getByLabel("Category period").selectOption("2026-09-01");
  await expect(categoryPanel).toContainText("€32.00");
  await page.getByLabel("Category interval").selectOption("daily");
  await page.getByLabel("Category period").selectOption("2026-07-12");
  await expect(categoryPanel).toContainText("€18.50");
  await expect(page.getByLabel("Spending interval")).toHaveValue("monthly");
  await page.getByLabel("Category interval").selectOption("monthly");
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

test("shops can be deleted only after their expenses are removed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const shop = await (
    await page.request.post("/api/shops", { data: { name: "Disposable shop" } })
  ).json();
  const catalog = await (await page.request.get("/api/catalog")).json();
  const response = await page.request.post("/api/invoices", {
    data: {
      date: "2026-09-06",
      currency: "EUR",
      shopId: shop.id,
      lines: [{ itemId: catalog.items[0].id, quantity: 1, unitPrice: "1.00" }],
    },
  });
  expect(response.status()).toBe(201);
  const invoice = await response.json();
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete shop Disposable shop", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep shop", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete shop Disposable shop", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Cannot delete a shop with related expenses.",
  );
  expect(
    (await page.request.delete(`/api/invoices/${invoice.id}`)).status(),
  ).toBe(204);
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Disposable shop", { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await expect(page.getByText("Disposable shop", { exact: true })).toHaveCount(
    0,
  );
});

test("shop catalog hides totals and retains trends", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const shopResponse = await page.request.post("/api/shops", {
    data: { name: "Spending totals shop" },
  });
  expect(shopResponse.status()).toBe(201);
  const shop = await shopResponse.json();
  const catalog = await (await page.request.get("/api/catalog")).json();
  for (const [currency, unitPrice] of [
    ["EUR", "3.75"],
    ["KES", "100.00"],
  ]) {
    const response = await page.request.post("/api/invoices", {
      data: {
        date: "2026-09-06",
        currency,
        shopId: shop.id,
        lines: [{ itemId: catalog.items[0].id, quantity: 1, unitPrice }],
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  const total = page.getByLabel("Your total spent at Spending totals shop");
  await expect(total).toHaveCount(0);
  await expect(total).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(total).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/shop-spending-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(total).toHaveCount(0);
});

test("category catalog hides totals and retains trends", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const category = await (
    await page.request.post("/api/categories", {
      data: { name: "Category totals" },
    })
  ).json();
  const itemResponse = await page.request.post("/api/items", {
    data: { name: "Category purchase", categoryId: category.id },
  });
  expect(itemResponse.status()).toBe(201);
  const item = await itemResponse.json();
  const catalog = await (await page.request.get("/api/catalog")).json();
  for (const [currency, unitPrice] of [
    ["EUR", "2.50"],
    ["KES", "100.00"],
  ]) {
    const response = await page.request.post("/api/invoices", {
      data: {
        date: "2026-09-06",
        currency,
        shopId: catalog.shops[0].id,
        lines: [
          { itemId: item.id, quantity: 2, unitPrice },
          {
            itemId: catalog.items.find((i) => i.id !== item.id).id,
            quantity: 1,
            unitPrice: "99.00",
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  const total = page.getByLabel("Your total spent in Category totals");
  await expect(total).toHaveCount(0);
  await expect(total).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Categories", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(total).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/category-spending-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(total).toHaveCount(0);
});

test("spending chart switches monthly weekly and daily on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Monthly spending" }),
  ).toBeVisible();
  await page.getByLabel("Spending interval").selectOption("weekly");
  await expect(
    page.getByRole("img", { name: "Weekly spending" }),
  ).toBeVisible();
  await page.getByLabel("Spending interval").selectOption("daily");
  await expect(page.getByRole("img", { name: "Daily spending" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Spending interval")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/daily-spending-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Spending interval").selectOption("monthly");
  await expect(
    page.getByRole("img", { name: "Monthly spending" }),
  ).toBeVisible();
});

test("item dashboard shows weighted prices, quantities and shops privately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const response = await page.request.post("/api/items", {
    data: { name: "Trend milk" },
  });
  expect(response.status()).toBe(201);
  const item = await response.json();
  await page.request.post("/api/shops", {
    data: { name: "Item trend test shop" },
  });
  const catalog = await (await page.request.get("/api/catalog")).json();
  for (const [index, date, quantity, unitPrice] of [
    [0, "2026-09-01", 2, "1.00"],
    [1, "2026-09-07", 1, "4.00"],
  ]) {
    expect(
      (
        await page.request.post("/api/invoices", {
          data: {
            date,
            currency: "EUR",
            shopId: catalog.shops[index].id,
            lines: [{ itemId: item.id, quantity, unitPrice }],
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  const itemName = await page
    .getByText("Trend milk", { exact: true })
    .boundingBox();
  const trendsLink = await page
    .getByRole("button", { name: "View trends for Trend milk" })
    .boundingBox();
  expect(trendsLink.y).toBeGreaterThanOrEqual(itemName.y + itemName.height);
  const categoryLink = await page
    .getByRole("button", { name: "Change category for Trend milk" })
    .boundingBox();
  expect(Math.abs(categoryLink.y - trendsLink.y)).toBeLessThan(2);
  expect(categoryLink.x).toBeGreaterThan(trendsLink.x + trendsLink.width);
  await expect(
    page
      .getByRole("button", { name: "View trends for Trend milk" })
      .locator(".."),
  ).toContainText("|");

  for (const padding of await page
    .locator(".item-trends-link")
    .evaluateAll((links) =>
      links.map((link) => getComputedStyle(link).paddingTop),
    )) {
    expect(padding).toBe("0px");
  }

  for (const gap of await page
    .locator(".item-trends-link")
    .evaluateAll((links) =>
      links.map((link) => parseFloat(getComputedStyle(link).marginTop)),
    )) {
    expect(gap).toBeLessThanOrEqual(2);
  }
  await page
    .getByRole("button", { name: "View trends for Trend milk" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trend milk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Average unit price trend" }),
  ).toContainText("€2.00");
  await expect(
    page.getByRole("img", { name: "Quantity purchased trend" }),
  ).toContainText("3");
  await page
    .getByRole("group", { name: "Item interval" })
    .getByRole("button", { name: "Weekly" })
    .click();
  await expect(
    page.getByRole("img", { name: "Average unit price trend" }),
  ).toContainText("Week of 2026-08-31");
  await page
    .getByRole("group", { name: "Item interval" })
    .getByRole("button", { name: "Daily" })
    .click();
  await expect(
    page.getByRole("img", { name: "Average unit price trend" }),
  ).toContainText("€4.00");
  await expect(page.getByRole("table").first()).toContainText(
    catalog.shops[0].name,
  );
  await expect(page.getByRole("table").first()).toContainText(
    catalog.shops[1].name,
  );
  await page.screenshot({
    path: "artifacts/item-dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/item-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Item start date").fill("2026-09-07");
  await expect(
    page.getByRole("img", { name: "Quantity purchased trend" }),
  ).toContainText("1");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "View trends for Trend milk" })
    .click();
  await expect(page.getByText("No purchases in this selection.")).toBeVisible();
});

test("expense item dropdown includes manufacturer names", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const manufacturer = await (
    await page.request.post("/api/manufacturers", {
      data: { name: "Test Dairy" },
    })
  ).json();
  const response = await page.request.post("/api/items", {
    data: { name: "Branded milk", manufacturerId: manufacturer.id },
  });
  expect(response.status()).toBe(201);
  const item = await response.json();
  await page.reload();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page
    .getByLabel("Item 1", { exact: true })
    .selectOption({ label: "Branded milk (Test Dairy)" });
  await expect(page.getByLabel("Item 1", { exact: true })).toHaveValue(
    String(item.id),
  );
});

test("shop trends show personal spending, quantities and items across intervals", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const shop = await (
    await page.request.post("/api/shops", { data: { name: "Trend shop" } })
  ).json();
  const item = await (
    await page.request.post("/api/items", {
      data: { name: "Shop trend purchase" },
    })
  ).json();
  for (const date of ["2026-09-01", "2026-09-07"])
    expect(
      (
        await page.request.post("/api/invoices", {
          data: {
            date,
            currency: "EUR",
            shopId: shop.id,
            lines: [{ itemId: item.id, quantity: 2, unitPrice: "3.00" }],
          },
        })
      ).status(),
    ).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View shop trends for Trend shop" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trend shop", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€12.00",
  );
  await expect(page.getByRole("table").first()).toContainText(
    "Shop trend purchase",
  );
  await page
    .getByRole("group", { name: "Shop interval" })
    .getByRole("button", { name: "Weekly" })
    .click();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "Week of 2026-08-31",
  );
  await page
    .getByRole("group", { name: "Shop interval" })
    .getByRole("button", { name: "Daily" })
    .click();
  await expect(
    page.getByRole("img", { name: "Quantity purchased trend" }),
  ).toContainText("2");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/shop-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Shop start date").fill("2026-09-07");
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€6.00",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "View shop trends for Trend shop" })
    .click();
  await expect(page.getByText("No purchases in this selection.")).toBeVisible();
});

test("category trends allocate mixed purchases and keep history private", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const category = await (
    await page.request.post("/api/categories", {
      data: { name: "Trend category" },
    })
  ).json();
  const item = await (
    await page.request.post("/api/items", {
      data: { name: "Category trend item", categoryId: category.id },
    })
  ).json();
  const other = await (
    await page.request.post("/api/items", {
      data: { name: "Outside category" },
    })
  ).json();
  const shop = await (
    await page.request.post("/api/shops", {
      data: { name: "Category trend shop" },
    })
  ).json();
  for (const date of ["2026-09-01", "2026-09-07"])
    expect(
      (
        await page.request.post("/api/invoices", {
          data: {
            date,
            currency: "EUR",
            shopId: shop.id,
            lines: [
              { itemId: item.id, quantity: 2, unitPrice: "3.00" },
              { itemId: other.id, quantity: 1, unitPrice: "99.00" },
            ],
          },
        })
      ).status(),
    ).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View category trends for Trend category" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trend category", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€12.00",
  );
  await expect(page.getByRole("table").first()).toContainText(
    "Category trend item",
  );
  await expect(page.getByRole("table").first()).not.toContainText(
    "Outside category",
  );
  await page
    .getByRole("group", { name: "Category interval" })
    .getByRole("button", { name: "Weekly" })
    .click();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "Week of 2026-08-31",
  );
  await page
    .getByRole("group", { name: "Category interval" })
    .getByRole("button", { name: "Daily" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/category-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Category start date").fill("2026-09-07");
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€6.00",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "View category trends for Trend category" })
    .click();
  await expect(page.getByText("No purchases in this selection.")).toBeVisible();
});

test("manufacturer trends isolate branded items and support intervals and privacy", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const manufacturer = await (
    await page.request.post("/api/manufacturers", {
      data: { name: "Trend maker" },
    })
  ).json();
  const item = await (
    await page.request.post("/api/items", {
      data: { name: "Maker item", manufacturerId: manufacturer.id },
    })
  ).json();
  const other = await (
    await page.request.post("/api/items", { data: { name: "Unbranded item" } })
  ).json();
  const shop = await (
    await page.request.post("/api/shops", { data: { name: "Maker shop" } })
  ).json();
  for (const date of ["2026-09-01", "2026-09-07"])
    expect(
      (
        await page.request.post("/api/invoices", {
          data: {
            date,
            currency: "EUR",
            shopId: shop.id,
            lines: [
              { itemId: item.id, quantity: 2, unitPrice: "3.00" },
              { itemId: other.id, quantity: 1, unitPrice: "99.00" },
            ],
          },
        })
      ).status(),
    ).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View manufacturer trends for Trend maker" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trend maker", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€12.00",
  );
  await expect(page.getByRole("table").first()).toContainText("Maker item");
  await expect(page.getByRole("table").first()).not.toContainText(
    "Unbranded item",
  );
  await page
    .getByRole("group", { name: "Manufacturer interval" })
    .getByRole("button", { name: "Weekly" })
    .click();
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "Week of 2026-08-31",
  );
  await page
    .getByRole("group", { name: "Manufacturer interval" })
    .getByRole("button", { name: "Daily" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/manufacturer-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Manufacturer start date").fill("2026-09-07");
  await expect(page.getByRole("img", { name: "Spending trend" })).toContainText(
    "€6.00",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Username").fill("reader1");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "View manufacturer trends for Trend maker" })
    .click();
  await expect(page.getByText("No purchases in this selection.")).toBeVisible();
});

test("modal backdrop dismisses without saving and restores focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const add = page.getByRole("button", { name: "Add expense", exact: true });
  await add.click();
  await page.getByLabel("Notes").fill("Unsaved expense");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
  await add.click();
  await expect(page.getByLabel("Notes")).toHaveValue("");
});

test("duplicate manufacturers show a clear error and preserve the entered name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add manufacturer", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Distinct Maker");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add manufacturer", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("  distinct maker  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "A manufacturer with this name already exists.",
  );
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "  distinct maker  ",
  );
  const catalog = await (await page.request.get("/api/catalog")).json();
  expect(
    catalog.manufacturers.filter(
      (m) => m.name.toLowerCase() === "distinct maker",
    ),
  ).toHaveLength(1);
  await page.getByLabel("Name", { exact: true }).fill("Another Distinct Maker");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("item category reassignment updates existing expenses and persists", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const category = await (
    await page.request.post("/api/categories", {
      data: { name: "Changed category" },
    })
  ).json();
  const item = await (
    await page.request.post("/api/items", { data: { name: "Reclassify item" } })
  ).json();
  const shop = await (
    await page.request.post("/api/shops", { data: { name: "Reclassify shop" } })
  ).json();
  expect(
    (
      await page.request.post("/api/invoices", {
        data: {
          date: "2026-09-01",
          currency: "EUR",
          shopId: shop.id,
          lines: [{ itemId: item.id, quantity: 1, unitPrice: "2.00" }],
        },
      })
    ).status(),
  ).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Change category for Reclassify item" })
    .click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(String(category.id));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const invoices = await (await page.request.get("/api/invoices")).json();
  expect(
    invoices.find((invoice) => invoice.shopId === shop.id).lines[0].category,
  ).toBe("Changed category");
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Change category for Reclassify item" })
    .click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    String(category.id),
  );
  await page.getByLabel("Category", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const catalog = await (await page.request.get("/api/catalog")).json();
  expect(
    catalog.items.find((entry) => entry.id === item.id).categoryId,
  ).toBeNull();
});
