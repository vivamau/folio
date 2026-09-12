import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ItemDashboard, { itemHistory } from "../frontend/src/ItemDashboard";
import Catalog from "../frontend/src/Catalog";
const invoices = [
  {
    id: 1,
    date: "2026-08-31",
    shopId: 1,
    shop: "Market",
    currency: "EUR",
    lines: [
      { itemId: 1, quantity: 2, unitPriceCents: 100 },
      { itemId: 2, quantity: 99, unitPriceCents: 999 },
    ],
  },
  {
    id: 2,
    date: "2026-09-06",
    shopId: 2,
    shop: "Corner",
    currency: "EUR",
    lines: [
      { itemId: 1, quantity: 1, unitPriceCents: 400 },
      { itemId: 1, quantity: 0.5, unitPriceCents: null },
    ],
  },
  {
    id: 3,
    date: "2026-09-07",
    shopId: 1,
    shop: "Market",
    currency: "KES",
    lines: [{ itemId: 1, quantity: 3, unitPriceCents: 500 }],
  },
];
test("item history uses matching lines, weighted prices, quantities, shops and Monday weeks", () => {
  const result = itemHistory(invoices, 1, "EUR", "weekly", "", "");
  expect(result.quantity).toBe(3.5);
  expect(result.spent).toBe(600);
  expect(result.average).toBe(200);
  expect(result.unpriced).toBe(1);
  expect(result.periods).toHaveLength(1);
  expect(result.periods[0]).toMatchObject({
    key: "2026-08-31",
    quantity: 3.5,
    average: 200,
  });
  expect(result.shops).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "Market", quantity: 2, spent: 200 }),
      expect.objectContaining({ name: "Corner", quantity: 1.5, spent: 400 }),
    ]),
  );
  expect(
    itemHistory(invoices, 1, "EUR", "daily", "2026-09-01", "2026-09-06")
      .periods,
  ).toHaveLength(1);
  expect(
    itemHistory(invoices, 1, "EUR", "monthly", "", "2026-08-31").quantity,
  ).toBe(2);
  expect(
    itemHistory(invoices, 99, "EUR", "monthly", "", "").average,
  ).toBeNull();
  const missing = itemHistory(
    [
      {
        ...invoices[0],
        lines: [{ itemId: 1, quantity: 1, unitPriceCents: null }],
      },
    ],
    1,
    "EUR",
    "daily",
    "",
    "",
  );
  expect(missing.periods[0].average).toBeNull();
});
test("item dashboard opens from catalog, filters, switches intervals and returns", () => {
  render(
    <Catalog
      catalog={{
        items: [{ id: 1, name: "Milk" }],
        shops: [],
        categories: [],
        manufacturers: [],
      }}
      invoices={invoices}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "View trends for Milk" }));
  expect(screen.getByRole("heading", { name: "Milk" })).toBeVisible();
  expect(
    screen.getByRole("img", { name: "Average unit price trend" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Daily" }));
  expect(screen.getAllByText("2026-08-31").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText("Item currency"), {
    target: { value: "KES" },
  });
  expect(screen.getByText("KES 15.00", { selector: "strong" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Item start date"), {
    target: { value: "2026-10-01" },
  });
  expect(screen.getByText("No purchases in this selection.")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to shops & items" }),
  );
  expect(
    screen.getByRole("button", { name: "View trends for Milk" }),
  ).toBeVisible();
});
test("unused items have a clear empty dashboard", () => {
  render(
    <ItemDashboard
      item={{ id: 9, name: "Unused" }}
      invoices={[]}
      onBack={() => {}}
    />,
  );
  expect(screen.getByText("No purchases in this selection.")).toBeVisible();
});

test("shop history isolates shop and currency, groups periods and purchased items", () => {
  const { shopHistory } = require("../frontend/src/ItemDashboard");
  const history = shopHistory(invoices, 1, "EUR", "weekly", "", "");
  expect(history.count).toBe(1);
  expect(history.quantity).toBe(101);
  expect(history.spent).toBe(99101);
  expect(history.periods[0].key).toBe("2026-08-31");
  expect(history.shops).toHaveLength(2);
  expect(shopHistory(invoices, 1, "KES", "daily", "", "").spent).toBe(1500);
  expect(
    shopHistory(invoices, 1, "EUR", "monthly", "2026-09-01", "2026-09-30")
      .count,
  ).toBe(0);
  expect(shopHistory(invoices, 2, "EUR", "daily", "", "").unpriced).toBe(1);
});
test("shop dashboard opens with spending and items, supports empty currency and back", () => {
  render(
    <Catalog
      catalog={{
        items: [],
        shops: [{ id: 1, name: "Market" }],
        categories: [],
        manufacturers: [],
      }}
      invoices={invoices}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View shop trends for Market" }),
  );
  expect(
    screen.getByRole("heading", { name: "Market", exact: true }),
  ).toBeVisible();
  expect(screen.getByRole("img", { name: "Spending trend" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Items purchased" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
  fireEvent.change(screen.getByLabelText("Shop currency"), {
    target: { value: "GBP" },
  });
  expect(screen.getByText("No purchases in this selection.")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to shops & items" }),
  );
  expect(
    screen.getByRole("button", { name: "View shop trends for Market" }),
  ).toBeVisible();
});

test("category history counts only matching item lines across shops", () => {
  const { categoryHistory } = require("../frontend/src/ItemDashboard");
  const items = [
    { id: 1, categoryId: 7 },
    { id: 2, categoryId: 8 },
  ];
  const result = categoryHistory(invoices, items, 7, "EUR", "weekly", "", "");
  expect(result.spent).toBe(600);
  expect(result.quantity).toBe(3.5);
  expect(result.count).toBe(2);
  expect(result.unpriced).toBe(1);
  expect(result.shops).toHaveLength(1);
  expect(result.periods[0].key).toBe("2026-08-31");
  expect(
    categoryHistory(invoices, items, 7, "KES", "daily", "", "").spent,
  ).toBe(1500);
  expect(
    categoryHistory(
      invoices,
      items,
      7,
      "EUR",
      "monthly",
      "2026-09-01",
      "2026-09-06",
    ).count,
  ).toBe(1);
  expect(
    categoryHistory(invoices, items, 9, "EUR", "monthly", "", "").count,
  ).toBe(0);
});
test("category dashboard opens, groups spending and returns to catalog", () => {
  render(
    <Catalog
      catalog={{
        items: [{ id: 1, categoryId: 7 }],
        shops: [],
        categories: [{ id: 7, name: "Food" }],
        manufacturers: [],
      }}
      invoices={invoices}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View category trends for Food" }),
  );
  expect(
    screen.getByRole("heading", { name: "Food", exact: true }),
  ).toBeVisible();
  expect(screen.getByRole("img", { name: "Spending trend" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Daily" }));
  fireEvent.change(screen.getByLabelText("Category currency"), {
    target: { value: "GBP" },
  });
  expect(screen.getByText("No purchases in this selection.")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to shops & items" }),
  );
  expect(
    screen.getByRole("button", { name: "View category trends for Food" }),
  ).toBeVisible();
});

test("manufacturer history includes only its items and supports dashboard navigation", () => {
  const { manufacturerHistory } = require("../frontend/src/ItemDashboard");
  const items = [
    { id: 1, manufacturerId: 5 },
    { id: 2, manufacturerId: null },
  ];
  const result = manufacturerHistory(
    invoices,
    items,
    5,
    "EUR",
    "weekly",
    "",
    "",
  );
  expect(result.spent).toBe(600);
  expect(result.quantity).toBe(3.5);
  expect(result.count).toBe(2);
  expect(result.unpriced).toBe(1);
  expect(result.shops).toHaveLength(1);
  expect(
    manufacturerHistory(invoices, items, 6, "EUR", "daily", "", "").count,
  ).toBe(0);
  render(
    <Catalog
      catalog={{
        items,
        shops: [],
        categories: [],
        manufacturers: [{ id: 5, name: "Dairy" }],
      }}
      invoices={invoices}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View manufacturer trends for Dairy" }),
  );
  expect(
    screen.getByRole("heading", { name: "Dairy", exact: true }),
  ).toBeVisible();
  expect(screen.getByRole("img", { name: "Spending trend" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Daily" }));
  fireEvent.change(screen.getByLabelText("Manufacturer currency"), {
    target: { value: "GBP" },
  });
  expect(screen.getByText("No purchases in this selection.")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Back to shops & items" }),
  );
  expect(
    screen.getByRole("button", { name: "View manufacturer trends for Dairy" }),
  ).toBeVisible();
});

test("catalog omits shop and category spending totals but keeps trend navigation", () => {
  render(
    <Catalog
      catalog={{
        items: [{ id: 1, categoryId: 1 }],
        shops: [{ id: 1, name: "Market" }],
        categories: [{ id: 1, name: "Food" }],
        manufacturers: [],
      }}
      invoices={invoices}
    />,
  );
  expect(
    screen.queryByLabelText("Your total spent at Market"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Your total spent in Food"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/spending · all time/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "View shop trends for Market" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "View category trends for Food" }),
  ).toBeVisible();
});

test("trend intervals are visible buttons with selected state", () => {
  render(
    <ItemDashboard
      item={{ id: 1, name: "Milk" }}
      invoices={invoices}
      onBack={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
  expect(screen.getByRole("button", { name: "Weekly" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Daily" }));
  expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
