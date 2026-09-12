import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Snapshots from "../frontend/src/Snapshots";
import { api } from "../frontend/src/api";
jest.mock("../frontend/src/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
const snapshot = {
  id: 1,
  month: "2026-08",
  status: "ready",
  capturedAt: "2026-09-01T00:00:00Z",
  completedAt: "2026-09-01T00:00:01Z",
  cutoffDate: "2026-08-31",
  timeZone: "Africa/Nairobi",
  catchUp: false,
  invoiceCount: 1,
  pricedCount: 1,
  unpricedCount: 0,
  originalTotals: { KES: 15000 },
  totals: {
    EUR: 100,
    USD: 120,
    KES: 15000,
    GBP: 80,
    CHF: 90,
    CAD: 150,
    AUD: 160,
  },
  rates: {
    source: "Frankfurter",
    rates: {
      EUR: 1,
      USD: 1.2,
      KES: 150,
      GBP: 0.8,
      CHF: 0.9,
      CAD: 1.5,
      AUD: 1.6,
    },
    dates: {
      EUR: "2026-08-31",
      USD: "2026-08-28",
      KES: "2026-08-31",
      GBP: "2026-08-31",
      CHF: "2026-08-31",
      CAD: "2026-08-31",
      AUD: "2026-08-31",
    },
  },
  invoices: [
    {
      id: 1,
      date: "2026-08-10",
      shop: "Market",
      notes: "Coffee",
      currency: "KES",
      totalCents: 15000,
      lines: [
        {
          name: "Coffee",
          category: "Food",
          quantity: 1,
          unitPriceCents: 15000,
        },
      ],
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url === "/snapshots" ? [snapshot] : snapshot }),
  );
});
test("shows saved month, all converted totals, rates and frozen expense details", async () => {
  render(<Snapshots />);
  fireEvent.click(await screen.findByRole("button", { name: /August 2026/ }));
  expect(await screen.findByText("Month-end conversions")).toBeVisible();
  for (const currency of ["EUR", "USD", "KES", "GBP", "CHF", "CAD", "AUD"])
    expect(screen.getAllByText(currency).length).toBeGreaterThan(0);
  expect(screen.getByText("Market")).toBeVisible();
  expect(screen.getByText("2026-08-28")).toBeVisible();
  expect(screen.getByRole("link", { name: "Frankfurter" })).toHaveAttribute(
    "href",
    "https://frankfurter.dev/",
  );
});
test("explains empty months and supports refreshing errors", async () => {
  api.get.mockRejectedValueOnce(new Error("offline"));
  render(<Snapshots />);
  expect(await screen.findByRole("alert")).toBeVisible();
  api.get.mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole("button", { name: "Refresh summaries" }));
  expect(
    await screen.findByText("Your first monthly picture is on its way"),
  ).toBeVisible();
});
test("pending rates retain captured expense data, catch-up and incomplete-pricing labels", async () => {
  const pending = {
    ...snapshot,
    status: "pending",
    totals: null,
    rates: null,
    catchUp: true,
    unpricedCount: 1,
    pricedCount: 0,
    invoices: [{ ...snapshot.invoices[0], totalCents: null }],
  };
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url === "/snapshots" ? [pending] : pending }),
  );
  render(<Snapshots />);
  fireEvent.click(await screen.findByRole("button", { name: /August 2026/ }));
  expect(await screen.findByText(/Exchange rates are pending/)).toBeVisible();
  expect(screen.getByText(/Captured after month-end/)).toBeVisible();
  expect(screen.getByText(/1 expense is missing prices/)).toBeVisible();
});
test("reports detail loading failures", async () => {
  render(<Snapshots />);
  await screen.findByRole("button", { name: /August 2026/ });
  api.get.mockRejectedValueOnce(new Error("failed"));
  fireEvent.click(screen.getByRole("button", { name: /August 2026/ }));
  expect(await screen.findByRole("alert")).toBeVisible();
});

test("creates and opens an ad hoc summary immediately and preserves input after failure", async () => {
  render(<Snapshots />);
  await screen.findByRole("button", { name: /August 2026/ });
  fireEvent.click(screen.getByRole("button", { name: "Create summary" }));
  fireEvent.change(screen.getByLabelText("Summary title"), {
    target: { value: "Trip costs" },
  });
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-08-01" },
  });
  fireEvent.change(screen.getByLabelText("End date"), {
    target: { value: "2026-08-15" },
  });
  api.post.mockRejectedValueOnce({
    response: { data: { error: "Rates request failed" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Rates request failed",
  );
  expect(screen.getByLabelText("Summary title")).toHaveValue("Trip costs");
  const saved = {
    ...snapshot,
    id: 2,
    kind: "ad_hoc",
    title: "Trip costs",
    fromDate: "2026-08-01",
    toDate: "2026-08-15",
  };
  api.post.mockResolvedValueOnce({ data: saved });
  fireEvent.click(screen.getByRole("button", { name: "Save summary" }));
  expect(
    await screen.findByRole("heading", { name: "Trip costs" }),
  ).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(api.post).toHaveBeenLastCalledWith("/snapshots", {
    title: "Trip costs",
    from: "2026-08-01",
    to: "2026-08-15",
  });
  expect(screen.getByText("Period-end conversions")).toBeVisible();
});
test("ad hoc dialog can be cancelled", async () => {
  render(<Snapshots />);
  await screen.findByRole("button", { name: /August 2026/ });
  fireEvent.click(screen.getByRole("button", { name: "Create summary" }));
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("ad hoc deletion supports cancellation, errors and successful removal", async () => {
  const data = {
    ...snapshot,
    kind: "ad_hoc",
    title: "Trip",
    fromDate: "2026-08-01",
    toDate: "2026-08-31",
  };
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url === "/snapshots" ? [data] : data }),
  );
  render(<Snapshots />);
  fireEvent.click(await screen.findByRole("button", { name: /Trip/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete summary" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep summary" }));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete summary" }));
  api.delete.mockRejectedValueOnce({
    response: { data: { error: "Please retry" } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
  api.delete.mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
  expect(
    await screen.findByText("Your first monthly picture is on its way"),
  ).toBeVisible();
  expect(api.delete).toHaveBeenLastCalledWith("/snapshots/1");
  expect(
    screen.queryByRole("heading", { name: "Trip" }),
  ).not.toBeInTheDocument();
});
