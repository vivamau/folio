import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { currencies, money, lineTotal, periodKey } from "./format";

const empty = () => ({
  milli: 0,
  pricedMilli: 0,
  weighted: 0,
  spent: 0,
  unpriced: 0,
});
function add(target, line) {
  const milli = Math.round(line.quantity * 1000);
  target.milli += milli;
  if (line.unitPriceCents == null) target.unpriced += 1;
  else {
    target.pricedMilli += milli;
    target.weighted += line.unitPriceCents * milli;
    target.spent += lineTotal(line.quantity, line.unitPriceCents);
  }
}
const finish = (value) => ({
  ...value,
  quantity: value.milli / 1000,
  average: value.pricedMilli
    ? Math.round(value.weighted / value.pricedMilli)
    : null,
});

export function itemHistory(invoices, itemId, currency, interval, from, to) {
  const total = empty(),
    periods = new Map(),
    shops = new Map();
  for (const invoice of invoices) {
    if (
      invoice.currency !== currency ||
      (from && invoice.date < from) ||
      (to && invoice.date > to)
    )
      continue;
    for (const line of invoice.lines || []) {
      if (line.itemId !== itemId) continue;
      const key = periodKey(invoice.date, interval);
      if (!periods.has(key))
        periods.set(key, { ...empty(), key, shops: new Set() });
      if (!shops.has(invoice.shopId))
        shops.set(invoice.shopId, {
          ...empty(),
          id: invoice.shopId,
          name: invoice.shop,
        });
      add(total, line);
      add(periods.get(key), line);
      add(shops.get(invoice.shopId), line);
      periods.get(key).shops.add(invoice.shop);
    }
  }
  return {
    ...finish(total),
    periods: [...periods.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(finish),
    shops: [...shops.values()].map(finish).sort((a, b) => b.spent - a.spent),
  };
}
export function shopHistory(invoices, shopId, currency, interval, from, to) {
  const selected = invoices.filter(
    (invoice) =>
      (shopId === undefined || invoice.shopId === shopId) &&
      invoice.currency === currency &&
      (!from || invoice.date >= from) &&
      (!to || invoice.date <= to),
  );
  const total = empty(),
    periods = new Map(),
    items = new Map();
  for (const invoice of selected) {
    const key = periodKey(invoice.date, interval);
    if (!periods.has(key))
      periods.set(key, { ...empty(), key, shops: new Set(), count: 0 });
    const period = periods.get(key);
    period.count += 1;
    for (const line of invoice.lines || []) {
      if (!items.has(line.itemId))
        items.set(line.itemId, {
          ...empty(),
          id: line.itemId,
          name: line.name || "Unknown item",
        });
      add(total, line);
      add(period, line);
      add(items.get(line.itemId), line);
      period.shops.add(line.name || "Unknown item");
    }
  }
  return {
    ...finish(total),
    count: selected.length,
    periods: [...periods.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(finish),
    shops: [...items.values()].map(finish).sort((a, b) => b.spent - a.spent),
  };
}
function catalogInvoices(invoices, items, id, field) {
  const ids = new Set(
    items.filter((item) => item[field] === id).map((item) => item.id),
  );
  return invoices
    .map((invoice) => ({
      ...invoice,
      lines: (invoice.lines || []).filter((line) => ids.has(line.itemId)),
    }))
    .filter((invoice) => invoice.lines.length);
}
export function categoryHistory(
  invoices,
  items,
  categoryId,
  currency,
  interval,
  from,
  to,
) {
  return shopHistory(
    catalogInvoices(invoices, items, categoryId, "categoryId"),
    undefined,
    currency,
    interval,
    from,
    to,
  );
}
export function manufacturerHistory(
  invoices,
  items,
  manufacturerId,
  currency,
  interval,
  from,
  to,
) {
  return shopHistory(
    catalogInvoices(invoices, items, manufacturerId, "manufacturerId"),
    undefined,
    currency,
    interval,
    from,
    to,
  );
}
const quantity = (value) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(value);
const label = (key, interval) =>
  interval === "monthly"
    ? key.slice(0, 7)
    : interval === "weekly"
      ? `Week of ${key}`
      : key;

export default function ItemDashboard({
  item,
  shop,
  category,
  manufacturer,
  items = [],
  invoices,
  onBack,
}) {
  const catalogGroup = manufacturer || category;
  const grouped = !!(shop || catalogGroup);
  const groupPurchases = catalogGroup
    ? catalogInvoices(
        invoices,
        items,
        catalogGroup.id,
        manufacturer ? "manufacturerId" : "categoryId",
      )
    : [];
  const entity = catalogGroup || shop || item;
  const scope = manufacturer
    ? "Manufacturer"
    : category
      ? "Category"
      : shop
        ? "Shop"
        : "Item";
  const [interval, setInterval] = useState("monthly");
  const [currency, setCurrency] = useState(
    () =>
      (catalogGroup
        ? groupPurchases[0]?.currency
        : invoices.find((invoice) =>
            shop
              ? invoice.shopId === shop.id
              : invoice.lines?.some((line) => line.itemId === item.id),
          )?.currency) || "EUR",
  );
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const history = catalogGroup
    ? (manufacturer ? manufacturerHistory : categoryHistory)(
        invoices,
        items,
        catalogGroup.id,
        currency,
        interval,
        from,
        to,
      )
    : (shop ? shopHistory : itemHistory)(
        invoices,
        entity.id,
        currency,
        interval,
        from,
        to,
      );
  return (
    <div className="item-dashboard">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to shops &amp; items
      </button>
      <header className="item-heading">
        <span className="eyebrow">YOUR PURCHASE HISTORY</span>
        <h2>{entity.name}</h2>
        <p>
          {grouped
            ? "Follow your spending, quantities and purchased items."
            : "Follow unit prices, quantities and the places you buy."}
        </p>
      </header>
      <div className="item-filters">
        <fieldset className="trend-intervals" aria-label={`${scope} interval`}>
          <legend>Chart view</legend>
          <div>
            {["monthly", "weekly", "daily"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                onClick={() => setInterval(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Currency
          <select
            aria-label={`${scope} currency`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            aria-label={`${scope} start date`}
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            aria-label={`${scope} end date`}
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <p className="panel-subtitle">
        Your purchases only · {currency} · Weeks start Monday. Average unit
        prices are weighted by quantity; currencies are not converted.
      </p>
      {history.unpriced > 0 && (
        <p className="notice">
          {history.unpriced} purchase lines need pricing. Their quantities are
          included; prices and spending exclude them.
        </p>
      )}
      {!history.periods.length ? (
        <section className="panel chart-empty">
          <h3>No purchases in this selection.</h3>
          <p>
            Choose another currency or date range, or record a matching expense.
          </p>
        </section>
      ) : (
        <>
          <div className="stats-grid item-stats">
            {[
              ["Quantity purchased", quantity(history.quantity)],
              [
                grouped ? "Expenses recorded" : "Average unit price",
                grouped
                  ? history.count
                  : history.average === null
                    ? "Unpriced"
                    : money(history.average, currency),
              ],
              ["Total spent", money(history.spent, currency)],
              [
                grouped ? "Different items" : "Shops visited",
                history.shops.length,
              ],
            ].map(([title, value]) => (
              <section className="stat-card" key={title}>
                <span className="stat-label">{title}</span>
                <strong>{value}</strong>
              </section>
            ))}
          </div>
          <div className="insights-grid">
            <Trend
              title={grouped ? "Spending" : "Average unit price"}
              rows={history.periods}
              field={grouped ? "spent" : "average"}
              interval={interval}
              format={(v) => money(v, currency)}
            />
            <Trend
              title="Quantity purchased"
              rows={history.periods}
              field="quantity"
              interval={interval}
              format={quantity}
            />
          </div>
          <section className="panel">
            <h3>{grouped ? "Items purchased" : "Where you bought it"}</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{grouped ? "ITEM" : "SHOP"}</th>
                    <th>QUANTITY</th>
                    <th>AVG. UNIT PRICE</th>
                    <th>SPENT</th>
                  </tr>
                </thead>
                <tbody>
                  {history.shops.map((shop) => (
                    <tr key={shop.id}>
                      <td>{shop.name}</td>
                      <td>{quantity(shop.quantity)}</td>
                      <td>
                        {shop.average === null
                          ? "Unpriced"
                          : money(shop.average, currency)}
                      </td>
                      <td>{money(shop.spent, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h3>Purchases by period</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PERIOD</th>
                    <th>QUANTITY</th>
                    <th>{grouped ? "SPENT" : "AVG. UNIT PRICE"}</th>
                    <th>{grouped ? "ITEMS" : "SHOPS"}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.periods.map((period) => (
                    <tr key={period.key}>
                      <td>{label(period.key, interval)}</td>
                      <td>{quantity(period.quantity)}</td>
                      <td>
                        {grouped
                          ? money(period.spent, currency)
                          : period.average === null
                            ? "Unpriced"
                            : money(period.average, currency)}
                      </td>
                      <td>{[...period.shops].join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function Trend({ title, rows, field, interval, format }) {
  const max = Math.max(...rows.map((row) => row[field] || 0), 1);
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="bar-chart" role="img" aria-label={`${title} trend`}>
        {rows.map((row) => (
          <div className="bar-column" key={row.key}>
            <span>{row[field] === null ? "Unpriced" : format(row[field])}</span>
            <div className="bar-track">
              {row[field] !== null && (
                <div
                  className="bar"
                  style={{
                    height: `${Math.max((row[field] / max) * 100, 2)}%`,
                  }}
                />
              )}
            </div>
            <small>{label(row.key, interval)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
