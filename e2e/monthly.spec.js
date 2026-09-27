const { test, expect } = require("@playwright/test");
const { readFile } = require("node:fs/promises");
test("saved monthly picture shows all currencies and survives source deletion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("archive-reader");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await page.getByRole("button", { name: /August 2026/ }).click();
  await expect(page.getByText("Month-end conversions")).toBeVisible();
  for (const currency of ["EUR", "USD", "KES", "GBP", "CHF", "CAD", "AUD"])
    await expect(
      page.locator(".snapshot-totals").getByText(currency, { exact: true }),
    ).toBeVisible();
  await expect(page.getByText("Archive café", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Renamed café", { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport({
    ratio: 1,
  });
  const breakdown = page.getByRole("region", { name: "Spending breakdown" });
  await expect(
    breakdown.getByRole("cell", { name: "Lunch", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Breakdown currency").selectOption("KES");
  await expect(breakdown.getByRole("cell", { name: /KES/ })).toBeVisible();
  await breakdown.getByRole("button", { name: "By category" }).click();
  await expect(
    breakdown.getByRole("table", { name: "Spending by categories" }),
  ).toBeVisible();
  await breakdown.getByRole("button", { name: "By shop" }).click();
  await expect(
    breakdown.getByRole("cell", { name: "Archive café" }),
  ).toBeVisible();
  await page.getByLabel("Breakdown currency").selectOption("USD");
  await expect(breakdown.getByRole("cell", { name: /US\$/ })).toBeVisible();
  await breakdown.getByRole("button", { name: "Sort by Spent" }).click();
  await expect(
    breakdown.getByRole("columnheader", { name: /Sort by Spent/ }),
  ).toHaveAttribute("aria-sort", "ascending");
  await breakdown.getByRole("button", { name: "Sort by Spent" }).click();
  await expect(
    breakdown.getByRole("columnheader", { name: /Sort by Spent/ }),
  ).toHaveAttribute("aria-sort", "descending");
  const downloading = page.waitForEvent("download");
  await breakdown.getByRole("button", { name: "Export as CSV" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^spending-breakdown-2026-08-.*\.csv$/,
  );
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("Breakdown,Name,Quantity,EUR,USD,KES,GBP,CHF,CAD,AUD");
  expect(csv).toContain("By item,Lunch,1,1.00,1.20,150.00,0.80,0.90,1.50,1.60");
  expect(csv).toContain("By category,");
  expect(csv).toContain("By shop,Archive café,1,1.00,1.20,150.00");
  expect(csv).not.toContain("Renamed café");
  await page.screenshot({
    path: "artifacts/monthly-summary.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await page.getByRole("button", { name: /August 2026/ }).click();
  await expect(page.getByText("Archive café", { exact: true })).toBeVisible();
});

test("creates a current-period ad hoc summary immediately and retains it after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("archive-reader");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const catalog = await (await page.request.get("/api/catalog")).json();
  const response = await page.request.post("/api/invoices", {
    data: {
      date: "2026-09-05",
      shopId: catalog.shops[0].id,
      currency: "KES",
      notes: "Current-period purchase",
      lines: [{ itemId: catalog.items[0].id, quantity: 1, unitPrice: "250" }],
    },
  });
  expect(response.status()).toBe(201);
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create summary", exact: true })
    .click();
  await page.getByLabel("Summary title").fill("September so far");
  await page.getByLabel("Start date").fill("2026-09-01");
  await page.getByLabel("End date").fill("2026-09-06");
  await page.getByRole("button", { name: "Save summary", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "September so far" }),
  ).toBeVisible();
  await expect(page.getByText("Period-end conversions")).toBeVisible();
  await expect(
    page.getByText("2026-09-05 · Current-period purchase"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /August 2026/ })).toBeVisible();
  await page.screenshot({
    path: "artifacts/ad-hoc-summary.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await page.getByRole("button", { name: /September so far/ }).click();
  await expect(
    page.getByRole("heading", { name: "September so far" }),
  ).toBeVisible();
});

test("deletes an ad hoc summary while preserving monthly summaries and expenses", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("archive-reader");
  await page.getByLabel("Password").fill("E2e-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Spending overview")).toBeVisible();
  const before = await (await page.request.get("/api/invoices")).json();
  const created = await page.request.post("/api/snapshots", {
    data: { title: "Temporary report", from: "2026-09-01", to: "2026-09-06" },
  });
  expect(created.status()).toBe(201);
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await page.getByRole("button", { name: /Temporary report/ }).click();
  await page
    .getByRole("button", { name: "Delete summary", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep summary", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Temporary report" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete summary", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Temporary report/ }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Monthly summaries", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Temporary report/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /August 2026/ }).click();
  await expect(
    page.getByRole("heading", { name: "August 2026" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete summary", exact: true }),
  ).toHaveCount(0);
  expect(await (await page.request.get("/api/invoices")).json()).toEqual(
    before,
  );
});
