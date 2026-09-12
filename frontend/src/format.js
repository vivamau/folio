export const currencies = ["EUR", "USD", "KES", "GBP", "CHF", "CAD", "AUD"];
export const money = (cents, currency) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    cents / 100,
  );
export const lineTotal = (quantity, cents) =>
  Math.round((Math.round(quantity * 1000) * cents) / 1000);
export function summarize(invoices, currency) {
  const selected = invoices.filter(
    (i) => i.currency === currency && i.totalCents !== null,
  );
  const categories = {};
  const months = {};
  for (const invoice of selected) {
    const month = invoice.date.slice(0, 7);
    months[month] = (months[month] || 0) + invoice.totalCents;
    for (const line of invoice.lines) {
      const name = line.category || "Uncategorized";
      categories[name] =
        (categories[name] || 0) + lineTotal(line.quantity, line.unitPriceCents);
    }
  }
  const total = selected.reduce((sum, i) => sum + i.totalCents, 0);
  return {
    total,
    count: selected.length,
    average: selected.length ? Math.round(total / selected.length) : 0,
    shops: new Set(selected.map((i) => i.shopId)).size,
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]),
    months: Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6),
  };
}
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function initialCurrency(invoices, preferred = "EUR") {
  return invoices.some((invoice) => invoice.currency === preferred)
    ? preferred
    : invoices[0]?.currency || preferred;
}

export function spendingPeriods(invoices, currency, interval) {
  const totals = new Map();
  for (const invoice of invoices) {
    if (invoice.currency !== currency || invoice.totalCents === null) continue;
    const key = periodKey(invoice.date, interval);
    totals.set(key, (totals.get(key) || 0) + invoice.totalCents);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

export function periodKey(value, interval) {
  const date = new Date(`${value}T00:00:00Z`);
  if (interval === "monthly") date.setUTCDate(1);
  if (interval === "weekly")
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
