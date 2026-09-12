import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Modal from "../frontend/src/Modal";
import Dashboard from "../frontend/src/Dashboard";
import ExpenseForm from "../frontend/src/ExpenseForm";
import Catalog, { CatalogForm } from "../frontend/src/Catalog";
import { money, summarize, today } from "../frontend/src/format";
import { api } from "../frontend/src/api";
test("API is configured for cookie authentication", () => {
  expect(api.defaults.withCredentials).toBe(true);
  expect(api.defaults.baseURL).toBe("/api");
});
test("modal traps keyboard focus, closes with escape and restores focus", () => {
  const close = jest.fn();
  const previous = document.createElement("button");
  document.body.append(previous);
  previous.focus();
  const { unmount } = render(
    <Modal title="Test dialog" onClose={close}>
      <input aria-label="Example" />
      <button>Last</button>
    </Modal>,
  );
  const first = screen.getByRole("button", { name: "Close dialog" }),
    last = screen.getByRole("button", { name: "Last" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab" });
  fireEvent.keyDown(first, { key: "a" });
  fireEvent.keyDown(first, { key: "Escape" });
  expect(close).toHaveBeenCalled();
  unmount();
  expect(previous).toHaveFocus();
  previous.remove();
});
test("empty and zero amount dashboard keeps meaningful labels", () => {
  const { rerender } = render(<Dashboard invoices={[]} currency="EUR" />);
  expect(screen.getByText("Your spending story starts here.")).toBeVisible();
  expect(screen.getByText("A little more clarity.")).toBeVisible();
  const invoices = [
    {
      date: "2026-01-01",
      totalCents: 0,
      currency: "EUR",
      shopId: 1,
      lines: [{ quantity: 1, unitPriceCents: 0 }],
    },
  ];
  rerender(<Dashboard invoices={invoices} currency="EUR" />);
  expect(screen.getByText("Uncategorized")).toBeVisible();
  expect(
    summarize([...invoices, { ...invoices[0], date: "2026-02-01" }], "EUR")
      .months,
  ).toHaveLength(2);
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(money(0, "USD")).toContain("0.00");
});
test("missing catalog disables save and unknown prices can be entered", () => {
  const { rerender } = render(
    <ExpenseForm
      catalog={{ shops: [], items: [] }}
      currency="EUR"
      onSave={jest.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Save expense" })).toBeDisabled();
  const save = jest.fn();
  rerender(
    <ExpenseForm
      key="existing"
      invoice={{
        date: "2026-01-01",
        shopId: 1,
        currency: "USD",
        notes: "",
        lines: [{ itemId: 1, quantity: 1, unitPriceCents: null }],
      }}
      catalog={{
        shops: [{ id: 1, name: "Shop" }],
        items: [{ id: 1, name: "Item" }],
      }}
      currency="EUR"
      onSave={save}
    />,
  );
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-02-01" },
  });
  fireEvent.change(screen.getByLabelText("Expense currency"), {
    target: { value: "GBP" },
  });
  fireEvent.change(screen.getByLabelText("Quantity 1"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Unit price 1"), {
    target: { value: "2.50" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ currency: "GBP", date: "2026-02-01" }),
  );
});
test("catalog form submits selected relationships and shop address", () => {
  const save = jest.fn(),
    catalog = {
      categories: [{ id: 1, name: "Food" }],
      manufacturers: [{ id: 2, name: "Farm" }],
    };
  const { rerender } = render(
    <CatalogForm kind="item" catalog={catalog} onSave={save} />,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Milk" },
  });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Manufacturer"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ categoryId: 1, manufacturerId: 2 }),
  );
  rerender(<CatalogForm kind="shop" catalog={catalog} onSave={save} saving />);
  fireEvent.change(screen.getByLabelText("Address"), {
    target: { value: "Street" },
  });
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
});
test("root entry mounts the application", async () => {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  const renderRoot = jest.fn();
  jest.doMock("react-dom/client", () => ({
    createRoot: () => ({ render: renderRoot }),
  }));
  jest.mock("../frontend/src/styles.css", () => ({}));
  require("../frontend/src/main");
  await waitFor(() => expect(renderRoot).toHaveBeenCalled());
  root.remove();
});
test("fractional quantity rounds decimal half cents correctly", () => {
  const invoice = {
    currency: "EUR",
    date: "2026-01-01",
    shopId: 1,
    totalCents: 58,
    lines: [{ category: "Food", quantity: 0.575, unitPriceCents: 100 }],
  };
  expect(summarize([invoice], "EUR").categories[0][1]).toBe(58);
  const catalog = {
    shops: [{ id: 1, name: "Shop" }],
    items: [{ id: 1, name: "Item" }],
  };
  render(<ExpenseForm catalog={catalog} currency="EUR" onSave={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Quantity 1"), {
    target: { value: "0.575" },
  });
  fireEvent.change(screen.getByLabelText("Unit price 1"), {
    target: { value: "1" },
  });
  expect(screen.getByText("€0.58")).toBeVisible();
});

test("initial currency prefers a populated default and falls back to an existing currency", () => {
  const { initialCurrency } = require("../frontend/src/format");
  expect(initialCurrency([], "KES")).toBe("KES");
  expect(initialCurrency([])).toBe("EUR");
  expect(initialCurrency([{ currency: "KES" }], "EUR")).toBe("KES");
  expect(
    initialCurrency([{ currency: "KES" }, { currency: "EUR" }], "EUR"),
  ).toBe("EUR");
});

test("spending periods group by calendar month, Monday week and day across year boundaries", () => {
  const { spendingPeriods } = require("../frontend/src/format");
  const invoices = [
    { date: "2025-12-31", currency: "EUR", totalCents: 100 },
    { date: "2026-01-04", currency: "EUR", totalCents: 200 },
    { date: "2026-01-05", currency: "EUR", totalCents: 300 },
    { date: "2026-01-05", currency: "EUR", totalCents: 50 },
    { date: "2026-01-05", currency: "KES", totalCents: 999 },
    { date: "2026-01-06", currency: "EUR", totalCents: null },
    { date: "2026-01-07", currency: "EUR", totalCents: 0 },
  ];
  expect(spendingPeriods(invoices, "EUR", "monthly")).toEqual([
    ["2025-12-01", 100],
    ["2026-01-01", 550],
  ]);
  expect(spendingPeriods(invoices, "EUR", "weekly")).toEqual([
    ["2025-12-29", 300],
    ["2026-01-05", 350],
  ]);
  expect(spendingPeriods(invoices, "EUR", "daily")).toEqual([
    ["2025-12-31", 100],
    ["2026-01-04", 200],
    ["2026-01-05", 350],
    ["2026-01-07", 0],
  ]);
});

test("spending chart switches granularity without changing summary cards", () => {
  const invoices = ["2026-09-06", "2026-09-07"].map((date) => ({
    date,
    currency: "EUR",
    totalCents: 100,
    shopId: 1,
    lines: [],
  }));
  render(<Dashboard invoices={invoices} currency="EUR" />);
  expect(screen.getByRole("img", { name: "Monthly spending" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Spending interval"), {
    target: { value: "weekly" },
  });
  expect(screen.getByRole("img", { name: "Weekly spending" })).toBeVisible();
  expect(screen.getByText("Week of 31 Aug 26")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Spending interval"), {
    target: { value: "daily" },
  });
  expect(screen.getByRole("img", { name: "Daily spending" })).toBeVisible();
  expect(screen.getByText("06 Sept 26")).toBeVisible();
  expect(screen.getByText("€2.00")).toBeVisible();
});

test("expense item options show manufacturers while retaining item IDs", () => {
  render(
    <ExpenseForm
      catalog={{
        shops: [{ id: 1, name: "Market" }],
        manufacturers: [{ id: 5, name: "Dairy Co" }],
        items: [
          { id: 1, name: "Milk", manufacturerId: 5 },
          { id: 2, name: "Milk", manufacturerId: null },
        ],
      }}
      currency="EUR"
      onSave={jest.fn()}
    />,
  );
  expect(screen.getByRole("option", { name: "Milk (Dairy Co)" })).toHaveValue(
    "1",
  );
  expect(screen.getByRole("option", { name: "Milk", exact: true })).toHaveValue(
    "2",
  );
  fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: "1" } });
  expect(screen.getByLabelText("Item 1")).toHaveValue("1");
});

test("modal closes on backdrop click only", () => {
  const close = jest.fn();
  const { container } = render(
    <Modal title="Example" onClose={close}>
      <input aria-label="Inside" />
    </Modal>,
  );
  fireEvent.click(screen.getByLabelText("Inside"));
  fireEvent.click(screen.getByRole("dialog"));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(container.querySelector(".modal-backdrop"));
  expect(close).toHaveBeenCalledTimes(1);
});
