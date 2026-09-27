import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SummaryBreakdowns from "../frontend/src/SummaryBreakdowns";
const row = {
  name: "Saved name",
  quantity: 2,
  originalTotals: { KES: 15000, USD: 120 },
  totals: {
    EUR: 200,
    USD: 240,
    KES: 30000,
    GBP: 160,
    CHF: 180,
    CAD: 300,
    AUD: 320,
  },
};
test("report breakdown views switch grouping and currency using saved conversions", () => {
  render(
    <SummaryBreakdowns
      snapshot={{
        status: "ready",
        breakdowns: {
          items: [row],
          categories: [{ ...row, name: "Food" }],
          shops: [{ ...row, name: "Market" }],
        },
      }}
    />,
  );
  expect(screen.getByRole("cell", { name: "Saved name" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "€2.00" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Breakdown currency"), {
    target: { value: "KES" },
  });
  expect(screen.getByRole("cell", { name: "KES 300.00" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "By category" }));
  expect(screen.getByRole("cell", { name: "Food" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "By shop" }));
  expect(screen.getByRole("cell", { name: "Market" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Breakdown currency"), {
    target: { value: "original" },
  });
  expect(screen.getByRole("cell", { name: /KES 150.00/ })).toHaveTextContent(
    "US$1.20",
  );
});
test("pending breakdowns show original amounts and empty reports remain clear", () => {
  const { rerender } = render(
    <SummaryBreakdowns
      snapshot={{
        status: "pending",
        breakdowns: {
          items: [{ ...row, totals: null }],
          categories: [],
          shops: [],
        },
      }}
    />,
  );
  expect(screen.getByLabelText("Breakdown currency")).toBeDisabled();
  expect(screen.getByText(/Conversions will be available/)).toBeVisible();
  rerender(
    <SummaryBreakdowns
      snapshot={{
        status: "ready",
        breakdowns: { items: [], categories: [], shops: [] },
      }}
    />,
  );
  expect(
    screen.getByText("No priced expenses in this breakdown."),
  ).toBeVisible();
});

test("CSV export includes every grouping and currency with Excel-safe quoted names", async () => {
  const { breakdownCsv } = await import("../frontend/src/SummaryBreakdowns");
  const snapshot = {
    breakdowns: {
      items: [{ ...row, name: 'Coffee, "dark"\nblend' }],
      categories: [{ ...row, name: "=SUM(A1)" }],
      shops: [{ ...row, name: "Café" }],
    },
  };
  const csv = breakdownCsv(snapshot);
  expect(csv).toContain(
    "Breakdown,Name,Quantity,EUR,USD,KES,GBP,CHF,CAD,AUD\r\n",
  );
  expect(csv).toContain(
    'By item,"Coffee, ""dark""\nblend",2,2.00,2.40,300.00,1.60,1.80,3.00,3.20',
  );
  expect(csv).toContain("By category,'=SUM(A1)");
  expect(csv).toContain("By shop,Café");
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(breakdownCsv({ breakdowns: {} }).split("\r\n")).toHaveLength(2);
});

test("exports all tabs via a downloadable CSV and disables export while rates are pending", () => {
  URL.createObjectURL = jest.fn(() => "blob:csv");
  URL.revokeObjectURL = jest.fn();
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  const { rerender } = render(
    <SummaryBreakdowns
      snapshot={{ id: 7, status: "ready", breakdowns: { items: [row] } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export as CSV" }));
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  rerender(<SummaryBreakdowns snapshot={{ status: "pending" }} />);
  expect(screen.getByRole("button", { name: "Export as CSV" })).toBeDisabled();
  click.mockRestore();
});

test("each breakdown sorts names and numeric columns in both directions without mutating saved data", () => {
  const entries = [
    { ...row, name: "Zulu", quantity: 2, totals: { ...row.totals, EUR: 900 } },
    {
      ...row,
      name: "Alpha",
      quantity: 10,
      totals: { ...row.totals, EUR: 100 },
    },
  ];
  render(
    <SummaryBreakdowns
      snapshot={{
        status: "ready",
        breakdowns: { items: entries, categories: entries, shops: entries },
      }}
    />,
  );
  const first = () => screen.getAllByRole("row")[1].textContent;
  expect(first()).toContain("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Item" }));
  expect(first()).toContain("Zulu");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Quantity" }));
  expect(first()).toContain("Zulu");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Quantity" }));
  expect(first()).toContain("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Spent" }));
  expect(first()).toContain("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Spent" }));
  expect(first()).toContain("Zulu");
  expect(
    screen.getByRole("columnheader", { name: /Sort by Spent/ }),
  ).toHaveAttribute("aria-sort", "descending");
  fireEvent.click(screen.getByRole("button", { name: "By category" }));
  fireEvent.click(screen.getByRole("button", { name: "Sort by Category" }));
  expect(first()).toContain("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "By shop" }));
  expect(screen.getByRole("button", { name: "Sort by Shop" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Breakdown currency"), {
    target: { value: "original" },
  });
  expect(screen.getByRole("button", { name: "Sort by Spent" })).toBeDisabled();
  expect(entries[0].name).toBe("Zulu");
});
