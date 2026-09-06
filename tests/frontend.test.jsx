import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../frontend/src/App";
import { money, summarize } from "../frontend/src/format";
import { api } from "../frontend/src/api";
jest.mock("../frontend/src/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
const catalog = {
  shops: [{ id: 1, name: "Market", address: "Main Street" }],
  items: [{ id: 1, name: "Milk", categoryId: 1 }],
  categories: [{ id: 1, name: "Groceries" }],
  manufacturers: [],
};
const invoices = [
  {
    id: 1,
    date: "2026-09-06",
    shopId: 1,
    shop: "Market",
    currency: "EUR",
    notes: "Weekly",
    totalCents: 250,
    lines: [
      {
        itemId: 1,
        name: "Milk",
        category: "Groceries",
        quantity: 2,
        unitPriceCents: 125,
      },
    ],
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data:
        url === "/me"
          ? { username: "admin", name: "Admin", canManage: true }
          : url === "/catalog"
            ? catalog
            : invoices,
    }),
  );
  api.post.mockResolvedValue({ data: {} });
  api.put.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
});
test("formats and summarizes each currency independently", () => {
  expect(money(12345, "EUR")).toContain("123.45");
  expect(summarize(invoices, "EUR")).toMatchObject({ total: 250, count: 1 });
  expect(summarize(invoices, "USD")).toMatchObject({ total: 0, count: 0 });
});
test("login and logout flow with errors", async () => {
  api.get.mockRejectedValueOnce(new Error("Unauthorized"));
  render(<App />);
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "admin" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password" },
  });
  api.post.mockRejectedValueOnce({
    response: { data: { error: "Invalid credentials" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid credentials",
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Spending overview")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeVisible();
});
test("renders dashboard and switches between views", async () => {
  render(<App />);
  expect(await screen.findByText("Spending overview")).toBeVisible();
  expect(screen.getAllByText("Market").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
  expect(screen.getByText("Your expense ledger")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search expenses"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No expenses found")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search expenses"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Currency"), {
    target: { value: "USD" },
  });
  expect(screen.getByText("No expenses found")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Shops & items" }));
  expect(screen.getByText("Your everyday essentials")).toBeVisible();
});
test("creates, edits and deletes an expense", async () => {
  render(<App />);
  await screen.findByText("Spending overview");
  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Shop"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Unit price 1"), {
    target: { value: "1.25" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add line" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove line 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/invoices",
      expect.objectContaining({ shopId: 1 }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit expense 1" }));
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Updated" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete expense 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep expense" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete expense 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/invoices/1"));
});
test("catalog creation and cancel", async () => {
  render(<App />);
  await screen.findByText("Spending overview");
  fireEvent.click(screen.getByRole("button", { name: "Shops & items" }));
  for (const kind of ["shop", "item", "category", "manufacturer"]) {
    fireEvent.click(screen.getByRole("button", { name: `Add ${kind}` }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New entry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  }
  fireEvent.click(screen.getByRole("button", { name: "Add shop" }));
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("shows loading and save failures", async () => {
  api.get.mockRejectedValueOnce({ response: { status: 500 } });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to connect",
  );
});
test("filters dates, opens overview from brand, and shows all expenses", async () => {
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data:
        url === "/me"
          ? { name: "Admin", username: "admin", canManage: true }
          : url === "/catalog"
            ? catalog
            : Array.from({ length: 6 }, (_, i) => ({
                ...invoices[0],
                id: i + 1,
              })),
    }),
  );
  render(<App />);
  await screen.findByText("Spending overview");
  fireEvent.click(screen.getByRole("button", { name: "View all expenses" }));
  expect(screen.getByText("Your expense ledger")).toBeVisible();
  fireEvent.change(screen.getByLabelText("From date"), {
    target: { value: "2026-10-01" },
  });
  expect(screen.getByText("No expenses found")).toBeVisible();
  fireEvent.change(screen.getByLabelText("From date"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("To date"), {
    target: { value: "2026-08-01" },
  });
  expect(screen.getByText("No expenses found")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Record an expense" }));
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("link", { name: /folio/ }));
  expect(screen.getByText("Spending overview")).toBeVisible();
});
test("preserves form after a failed save, reports logout failure, and retries reload", async () => {
  render(<App />);
  await screen.findByText("Spending overview");
  fireEvent.click(screen.getByRole("button", { name: "Edit expense 1" }));
  api.put.mockRejectedValueOnce({
    response: { data: { error: "Save unavailable" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Save unavailable",
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  api.post.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to connect",
  );
  api.get.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to connect",
  );
});
test("read-only catalog and unpriced legacy expenses", async () => {
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data:
        url === "/me"
          ? { name: "Reader", username: "reader1", canManage: false }
          : url === "/catalog"
            ? { shops: [], items: [], categories: [], manufacturers: [] }
            : [{ ...invoices[0], notes: "", totalCents: null }],
    }),
  );
  render(<App />);
  await screen.findByText("Spending overview");
  expect(screen.getByText("Needs pricing")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Shops & items" }));
  expect(
    screen.queryByRole("button", { name: "Add shop" }),
  ).not.toBeInTheDocument();
});

test("shows existing KES expenses when the default EUR ledger is empty", async () => {
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data:
        url === "/me"
          ? {
              name: "Admin",
              username: "admin",
              canManage: true,
              defaultCurrency: "EUR",
            }
          : url === "/catalog"
            ? catalog
            : invoices.map((i) => ({ ...i, currency: "KES" })),
    }),
  );
  render(<App />);
  await screen.findByText("Spending overview");
  await waitFor(() =>
    expect(screen.getByLabelText("Currency")).toHaveValue("KES"),
  );
  expect(screen.getByText("Market")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
  expect(screen.getByText("Market")).toBeVisible();
});

test("saving an expense selects its currency and clears filters that would hide it", async () => {
  render(<App />);
  await screen.findByText("Spending overview");
  fireEvent.change(screen.getByLabelText("Search expenses"), {
    target: { value: "not found" },
  });
  fireEvent.change(screen.getByLabelText("From date"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("To date"), {
    target: { value: "2026-10-31" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Shop"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Unit price 1"), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText("Expense currency"), {
    target: { value: "KES" },
  });
  api.get.mockImplementation((url) =>
    Promise.resolve({
      data:
        url === "/catalog"
          ? catalog
          : invoices.map((i) => ({ ...i, currency: "KES" })),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Currency")).toHaveValue("KES");
  expect(screen.getByLabelText("Search expenses")).toHaveValue("");
  expect(screen.getByLabelText("From date")).toHaveValue("");
  expect(screen.getByLabelText("To date")).toHaveValue("");
  expect(await screen.findByText("Market")).toBeVisible();
});

test('shop deletion confirms, handles linked expenses and refreshes the catalog', async () => {
  render(<App />);
  await screen.findByText('Spending overview');
  fireEvent.click(screen.getByRole('button', {name:'Shops & items'}));
  fireEvent.click(screen.getByRole('button', {name:'Delete shop Market'}));
  fireEvent.click(screen.getByRole('button', {name:'Keep shop'}));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Delete shop Market'}));
  api.delete.mockRejectedValueOnce({response:{data:{error:'Cannot delete a shop with related expenses.'}}});
  fireEvent.click(screen.getByRole('button', {name:'Delete permanently'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot delete a shop with related expenses.');
  expect(screen.getByRole('dialog')).toBeVisible();
  const previousGet = api.get.getMockImplementation();
  api.get.mockImplementation(url => url === '/catalog' ? Promise.resolve({data:{...catalog,shops:[]}}) : previousGet(url));
  fireEvent.click(screen.getByRole('button', {name:'Delete permanently'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.delete).toHaveBeenLastCalledWith('/shops/1');
  await waitFor(() => expect(screen.queryByRole('button', {name:'Delete shop Market'})).not.toBeInTheDocument());
});
