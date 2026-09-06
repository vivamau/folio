const { currencies } = require("./validation");
async function getHistoricalRates(date, { fetchFn = fetch } = {}) {
  const url = new URL("https://api.frankfurter.dev/v2/rates");
  url.searchParams.set("base", "EUR");
  url.searchParams.set(
    "quotes",
    currencies.filter((c) => c !== "EUR").join(","),
  );
  url.searchParams.set("date", date);
  const response = await fetchFn(url.toString(), {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`Exchange rates unavailable (HTTP ${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid exchange rate response");
  const rates = { EUR: 1 },
    dates = { EUR: date };
  for (const currency of currencies.filter((c) => c !== "EUR")) {
    const matches = rows.filter(
      (r) => r.base === "EUR" && r.quote === currency,
    );
    const row = matches[0];
    const age = row
      ? (Date.parse(date) - Date.parse(row.date)) / 86400000
      : NaN;
    if (
      matches.length !== 1 ||
      !Number.isFinite(row.rate) ||
      row.rate < 1e-9 ||
      row.rate > 1e9 ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 10
    ) {
      throw new Error(`Missing or invalid month-end rate for ${currency}`);
    }
    rates[currency] = row.rate;
    dates[currency] = row.date;
  }
  return {
    source: "Frankfurter",
    url: url.toString(),
    base: "EUR",
    requestedDate: date,
    rates,
    dates,
  };
}
module.exports = { getHistoricalRates };
