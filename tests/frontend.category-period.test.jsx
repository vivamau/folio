import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Dashboard from "../frontend/src/Dashboard";
test("category periods filter independently of the spending chart", () => {
  const invoices = [
    {
      date: "2026-08-31",
      currency: "EUR",
      totalCents: 100,
      lines: [{ category: "Food", quantity: 1, unitPriceCents: 100 }],
    },
    {
      date: "2026-09-02",
      currency: "EUR",
      totalCents: 300,
      lines: [{ category: "Food", quantity: 1, unitPriceCents: 300 }],
    },
  ];
  render(<Dashboard invoices={invoices} currency="EUR" />);
  const panel = screen.getByRole("region", { name: "By category" });
  expect(panel).toHaveTextContent("€4.00");
  fireEvent.change(screen.getByLabelText("Category period"), {
    target: { value: "2026-09-01" },
  });
  expect(panel).toHaveTextContent("€3.00");
  fireEvent.change(screen.getByLabelText("Category interval"), {
    target: { value: "weekly" },
  });
  expect(
    within(panel).getByRole("option", { name: "Week of 2026-08-31" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Category period"), {
    target: { value: "2026-08-31" },
  });
  expect(panel).toHaveTextContent("€4.00");
  fireEvent.change(screen.getByLabelText("Category interval"), {
    target: { value: "daily" },
  });
  fireEvent.change(screen.getByLabelText("Category period"), {
    target: { value: "2026-08-31" },
  });
  expect(panel).toHaveTextContent("€1.00");
  expect(screen.getByLabelText("Spending interval")).toHaveValue("monthly");
});
