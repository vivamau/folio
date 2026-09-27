import React, { useState } from "react";
import { currencies, money } from "./format";

const breakdownMoney = (cents, currency) =>
  money(cents, currency).replace(/([A-Z]{3})\s*(?=\d)/, "$1 ");

const breakdownGroups = [
  ["items", "By item"],
  ["categories", "By category"],
  ["shops", "By shop"],
];
function csvCell(value) {
  let text = String(value);
  // Prevent catalog names from becoming spreadsheet formulas.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
export function breakdownCsv(snapshot) {
  const rows = [["Breakdown", "Name", "Quantity", ...currencies]];
  for (const [key, label] of breakdownGroups) {
    for (const row of snapshot.breakdowns?.[key] || []) {
      rows.push([
        label,
        row.name,
        row.quantity,
        ...currencies.map((code) =>
          row.totals?.[code] == null ? "" : (row.totals[code] / 100).toFixed(2),
        ),
      ]);
    }
  }
  // UTF-8 BOM preserves accented names when opened directly in Excel.
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
function exportBreakdown(snapshot) {
  const url = URL.createObjectURL(
    new Blob([breakdownCsv(snapshot)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `spending-breakdown-${snapshot.month || snapshot.fromDate || "report"}-${snapshot.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SummaryBreakdowns({ snapshot }) {
  const [group, setGroup] = useState("items");
  const [currency, setCurrency] = useState("EUR");
  const pending = snapshot.status !== "ready";
  const selectedCurrency = pending ? "original" : currency;
  const [sort, setSort] = useState({ column: "name", direction: "ascending" });
  const sortColumn =
    sort.column === "spent" && selectedCurrency === "original"
      ? "name"
      : sort.column;
  const rows = [...(snapshot.breakdowns?.[group] || [])].sort((a, b) => {
    const compared =
      sortColumn === "name"
        ? a.name.localeCompare(b.name, "en", {
            numeric: true,
            sensitivity: "base",
          })
        : sortColumn === "quantity"
          ? a.quantity - b.quantity
          : a.totals[selectedCurrency] - b.totals[selectedCurrency];
    return (
      (sort.direction === "ascending" ? compared : -compared) ||
      a.name.localeCompare(b.name)
    );
  });
  function sortBy(column) {
    setSort({
      column,
      direction:
        sortColumn === column && sort.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  }
  return (
    <section className="summary-breakdowns" aria-label="Spending breakdown">
      <h3>Spending breakdown</h3>
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => exportBreakdown(snapshot)}
      >
        Export as CSV
      </button>
      <p className="breakdown-note">
        Exports all three breakdowns with EUR, USD, KES, GBP, CHF, CAD and AUD
        columns for Excel.
      </p>
      <div className="breakdown-controls">
        <div
          className="trend-intervals"
          role="group"
          aria-label="Breakdown grouping"
        >
          {breakdownGroups.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={group === value}
              onClick={() => setGroup(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Breakdown currency
          <select
            value={selectedCurrency}
            disabled={pending}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="original">Original currencies</option>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="breakdown-note">
        {pending
          ? "Conversions will be available when this report’s exchange rates are saved."
          : "Uses this report’s saved expenses and exchange rates. Rounded group totals may differ slightly from the overall total."}{" "}
        Expenses with missing prices are excluded.
        {selectedCurrency === "original" &&
          " Select a single currency to sort by spending."}
      </p>
      {rows.length ? (
        <div className="table-scroll">
          <table aria-label={`Spending by ${group}`}>
            <thead>
              <tr>
                {[
                  [
                    "name",
                    group === "items"
                      ? "Item"
                      : group === "categories"
                        ? "Category"
                        : "Shop",
                  ],
                  ["quantity", "Quantity"],
                  ["spent", "Spent"],
                ].map(([column, label]) => (
                  <th
                    key={column}
                    scope="col"
                    aria-label={`Sort by ${label}`}
                    aria-sort={sortColumn === column ? sort.direction : "none"}
                  >
                    <button
                      type="button"
                      className="breakdown-sort"
                      aria-label={`Sort by ${label}`}
                      disabled={
                        column === "spent" && selectedCurrency === "original"
                      }
                      onClick={() => sortBy(column)}
                    >
                      {label}{" "}
                      <span aria-hidden="true">
                        {sortColumn === column
                          ? sort.direction === "ascending"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>{row.name}</td>
                  <td>{row.quantity}</td>
                  <td>
                    {selectedCurrency === "original"
                      ? Object.entries(row.originalTotals).map(
                          ([code, cents]) => (
                            <span className="breakdown-amount" key={code}>
                              {breakdownMoney(cents, code)}
                            </span>
                          ),
                        )
                      : breakdownMoney(
                          row.totals[selectedCurrency],
                          selectedCurrency,
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="breakdown-note">No priced expenses in this breakdown.</p>
      )}
    </section>
  );
}
