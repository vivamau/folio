const { test, expect } = require("@playwright/test");
test("item details compare manufacturers using personal filtered purchases", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const create = async (path, data) => {
    const response = await page.request.post("/api/" + path, { data });
    expect(response.status()).toBe(201);
    return (await response.json()).id;
  };
  const a = await create("manufacturers", { name: "Comparison Alpha" });
  const b = await create("manufacturers", { name: "Comparison Beta" });
  const first = await create("items", {
    name: "Comparison coffee",
    manufacturerId: a,
  });
  const second = await create("items", {
    name: "Comparison coffee",
    manufacturerId: b,
  });
  const shopId = await create("shops", { name: "Comparison market" });
  await create("invoices", {
    date: "2026-09-01",
    shopId,
    currency: "EUR",
    lines: [
      { itemId: first, quantity: 2, unitPrice: "3" },
      { itemId: second, quantity: 5, unitPrice: "4" },
    ],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Shops & items", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "View trends for Comparison coffee",
      exact: true,
    })
    .first()
    .click();
  await expect(page.getByText("Manufacturer: Comparison Alpha")).toBeVisible();
  const box = page.getByRole("region", { name: "Compare manufacturers" });
  await expect(box).toContainText("+€1.00");
  await expect(box).toContainText("+3");
  await page.getByLabel("Item start date").fill("2026-09-02");
  await expect(box).toContainText("No purchases");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/manufacturer-comparison-mobile.png",
    fullPage: true,
  });
});
