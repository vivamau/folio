import React, { useState } from "react";
import {
  ArrowUpRight,
  Receipt,
  Store,
  Wallet,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import { money, summarize, spendingPeriods } from "./format";
export default function Dashboard({ invoices, currency }) {
  const [interval, setInterval] = useState("monthly");
  const intervalName = interval[0].toUpperCase() + interval.slice(1);
  const periods = spendingPeriods(invoices, currency, interval);
  const stats = summarize(invoices, currency);
  const cards = [
    [
      "Total spending",
      money(stats.total, currency),
      Wallet,
      "Across the selected period",
    ],
    [
      "Expenses recorded",
      String(stats.count).padStart(2, "0"),
      Receipt,
      "Every purchase, accounted for",
    ],
    [
      "Average expense",
      money(stats.average, currency),
      ChartNoAxesColumnIncreasing,
      "Per recorded expense",
    ],
    [
      "Shops visited",
      String(stats.shops).padStart(2, "0"),
      Store,
      "Places in your ledger",
    ],
  ];
  const max = Math.max(...periods.map((m) => m[1]), 1);
  return (
    <>
      <div className="stats-grid">
        {cards.map(([label, value, Icon, hint], i) => (
          <section
            className={`stat-card ${i === 0 ? "featured" : ""}`}
            key={label}
          >
            <div className="stat-label">
              {label}
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </section>
        ))}
      </div>
      <div className="insights-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE BIG PICTURE</span>
              <h2>Spending over time</h2>
            </div>
            <label className="trend-control">
              <span>{currency}</span>
              <select
                aria-label="Spending interval"
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
          </div>
          {periods.length ? (
            <div
              className="bar-chart"
              role="img"
              aria-label={`${intervalName} spending`}
            >
              {periods.map(([month, value]) => (
                <div className="bar-column" key={month}>
                  <span>{money(value, currency)}</span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ height: `${Math.max((value / max) * 100, 2)}%` }}
                    />
                  </div>
                  <small>
                    {interval === "weekly" && "Week of "}
                    {new Date(`${month}T00:00:00Z`).toLocaleDateString(
                      "en-GB",
                      {
                        timeZone: "UTC",
                        ...(interval !== "monthly" && { day: "2-digit" }),
                        month: "short",
                        year: "2-digit",
                      },
                    )}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">
              <div className="empty-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <p>Your spending story starts here.</p>
              <small>Add your first expense to see {interval} trends.</small>
            </div>
          )}
        </section>
        <section className="panel category-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">WHERE IT GOES</span>
              <h2>By category</h2>
            </div>
            <ArrowUpRight size={21} />
          </div>
          {stats.categories.length ? (
            <div className="category-list">
              {stats.categories.map(([name, value], i) => (
                <div className="category" key={name}>
                  <div>
                    <span>
                      <i
                        style={{
                          background: [
                            "#315d57",
                            "#d69760",
                            "#8d9fba",
                            "#b8aa85",
                          ][i % 4],
                        }}
                      />
                      {name}
                    </span>
                    <strong>{money(value, currency)}</strong>
                  </div>
                  <div className="category-track">
                    <i
                      style={{
                        width: `${stats.total ? (value / stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="category-empty">
              <TagIllustration />
              <p>A little more clarity.</p>
              <small>
                Categories help you understand
                <br />
                where your money goes.
              </small>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function TagIllustration() {
  return (
    <div className="tag-illustration" aria-hidden="true">
      ↗
    </div>
  );
}
