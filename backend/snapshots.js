const { currencies, summarySchema, parse } = require("./validation");
const { readInvoices } = require("./ledger");
const { getHistoricalRates } = require("./exchange-rates");
function monthAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
}
function nextMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return number === 12
    ? `${year + 1}-01`
    : `${year}-${String(number + 1).padStart(2, "0")}`;
}
function monthEnd(month) {
  return new Date(Date.parse(`${nextMonth(month)}-01T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
}
// Treat the provider's decimal rates as fractions. No floating-point money rounding.
function fraction(rate) {
  if (!Number.isFinite(rate) || rate <= 0)
    throw new Error("Invalid conversion rate");
  const [mantissa, exponent = "0"] = String(rate).toLowerCase().split("e");
  const [whole, decimal = ""] = mantissa.split(".");
  const scale = decimal.length - Number(exponent);
  return scale >= 0
    ? [BigInt(whole + decimal), 10n ** BigInt(scale)]
    : [BigInt(whole + decimal) * 10n ** BigInt(-scale), 1n];
}
function convertTotals(originalTotals, rates) {
  return Object.fromEntries(
    currencies.map((target) => {
      const [tn, td] = fraction(rates[target]);
      let numerator = 0n,
        denominator = 1n;
      for (const [source, cents] of Object.entries(originalTotals)) {
        if (!Number.isSafeInteger(cents) || cents < 0)
          throw new Error("Invalid expense total");
        const [sn, sd] = fraction(rates[source]);
        const n = BigInt(cents) * tn * sd,
          d = td * sn;
        numerator = numerator * d + n * denominator;
        denominator *= d;
      }
      const rounded = (numerator * 2n + denominator) / (2n * denominator);
      if (rounded > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("Converted total exceeds supported precision");
      return [target, Number(rounded)];
    }),
  );
}
function snapshotPayload(invoices) {
  const originalTotals = {};
  let pricedCount = 0;
  for (const invoice of invoices) {
    if (invoice.totalCents === null) continue;
    pricedCount++;
    originalTotals[invoice.currency] =
      (originalTotals[invoice.currency] || 0) + invoice.totalCents;
    if (!Number.isSafeInteger(originalTotals[invoice.currency]))
      throw new Error("Monthly total exceeds supported precision");
  }
  return {
    invoices,
    invoiceCount: invoices.length,
    pricedCount,
    unpricedCount: invoices.length - pricedCount,
    originalTotals,
  };
}
// Build from frozen invoices only, including for reports saved before breakdowns existed.
function snapshotBreakdowns(invoices, rates) {
  const groups = { items: new Map(), categories: new Map(), shops: new Map() };
  function add(group, key, name, currency, cents, quantity) {
    if (!group.has(key))
      group.set(key, { name, quantity: 0, originalTotals: {} });
    const entry = group.get(key);
    entry.quantity += quantity;
    entry.originalTotals[currency] =
      (entry.originalTotals[currency] || 0) + cents;
  }
  for (const invoice of invoices) {
    if (invoice.totalCents === null) continue;
    add(
      groups.shops,
      invoice.shopId ?? invoice.shop,
      invoice.shop,
      invoice.currency,
      invoice.totalCents,
      invoice.lines.reduce((sum, line) => sum + line.quantity, 0),
    );
    for (const line of invoice.lines) {
      const cents = Math.round(
        (Math.round(line.quantity * 1000) * line.unitPriceCents) / 1000,
      );
      add(
        groups.items,
        line.itemId ?? line.name,
        line.name,
        invoice.currency,
        cents,
        line.quantity,
      );
      const category = line.category || "Uncategorized";
      add(
        groups.categories,
        category,
        category,
        invoice.currency,
        cents,
        line.quantity,
      );
    }
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, group]) => [
      key,
      [...group.values()]
        .map((entry) => ({
          ...entry,
          quantity: Math.round(entry.quantity * 1000) / 1000,
          totals: rates
            ? convertTotals(entry.originalTotals, rates.rates)
            : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );
}
function decode(row, details) {
  if (!row) return null;
  const payload = JSON.parse(row.payload_json);
  const rates = row.rates_json ? JSON.parse(row.rates_json) : null;
  if (details) payload.breakdowns = snapshotBreakdowns(payload.invoices, rates);
  else delete payload.invoices;
  return {
    id: row.ID,
    month: row.month,
    kind: row.kind,
    title: row.title,
    fromDate: row.from_date,
    toDate: row.to_date,
    cutoffDate: row.cutoff_date,
    timeZone: row.timezone,
    capturedAt: row.captured_at,
    catchUp: !!row.catch_up,
    status: row.status,
    completedAt: row.completed_at,
    nextRetryAt: row.next_retry_at,
    ...payload,
    rates,
    totals: row.totals_json ? JSON.parse(row.totals_json) : null,
  };
}
function createSnapshotService(
  db,
  {
    now = () => new Date(),
    timeZone = "Africa/Nairobi",
    fetchRates = getHistoricalRates,
  } = {},
) {
  // Fail early on invalid configuration, before scheduling work.
  monthAt(now(), timeZone);
  let running = null;
  async function capture(date) {
    const current = monthAt(date, timeZone);
    const day = Number(
      new Intl.DateTimeFormat("en", { timeZone, day: "2-digit" }).format(date),
    );
    await db.transaction(async () => {
      const users = await db.all("SELECT ID FROM Users");
      for (const user of users) {
        let cursor = await db.get(
          "SELECT next_month FROM MonthlySnapshotCursors WHERE user_id=?",
          [user.ID],
        );
        if (!cursor) {
          const first = await db.get(
            "SELECT strftime('%Y-%m',min(invoice_date),'unixepoch') AS month FROM Invoices WHERE user_id=?",
            [user.ID],
          );
          const start =
            first.month && first.month < current ? first.month : current;
          await db.run(
            "INSERT INTO MonthlySnapshotCursors (user_id,next_month) VALUES (?,?)",
            [user.ID, start],
          );
          cursor = { next_month: start };
        }
        let month = cursor.next_month;
        // Bound downtime catch-up work; the next tick continues where this leaves off.
        for (let count = 0; month < current && count < 24; count++) {
          const cutoff = monthEnd(month);
          const invoices = await readInvoices(db, user.ID, {
            from: `${month}-01`,
            to: cutoff,
          });
          await db.run(
            "INSERT OR IGNORE INTO MonthlySnapshots (user_id,month,cutoff_date,timezone,captured_at,catch_up,payload_json,from_date,to_date) VALUES (?,?,?,?,?,?,?,?,?)",
            [
              user.ID,
              month,
              cutoff,
              timeZone,
              date.toISOString(),
              nextMonth(month) !== current || day !== 1 ? 1 : 0,
              JSON.stringify(snapshotPayload(invoices)),
              `${month}-01`,
              cutoff,
            ],
          );
          month = nextMonth(month);
        }
        await db.run(
          "UPDATE MonthlySnapshotCursors SET next_month=? WHERE user_id=?",
          [month, user.ID],
        );
      }
    });
  }
  async function complete(date, id) {
    const pending = await db.all(
      `SELECT * FROM MonthlySnapshots WHERE status='pending' AND next_retry_at<=? ${id ? "AND ID=?" : ""} ORDER BY month,ID LIMIT 500`,
      id ? [date.getTime(), id] : [date.getTime()],
    );
    const perDate = new Map();
    async function ratesFor(row) {
      if (!perDate.has(row.cutoff_date))
        perDate.set(
          row.cutoff_date,
          (async () => {
            const cached = await db.get(
              "SELECT rates_json FROM SnapshotExchangeRates WHERE reference_date=?",
              [row.cutoff_date],
            );
            if (cached) return JSON.parse(cached.rates_json);
            const rates = await fetchRates(row.cutoff_date);
            await db.transaction(() =>
              db.run(
                "INSERT OR IGNORE INTO SnapshotExchangeRates (reference_date,rates_json) VALUES (?,?)",
                [row.cutoff_date, JSON.stringify(rates)],
              ),
            );
            return JSON.parse(
              (
                await db.get(
                  "SELECT rates_json FROM SnapshotExchangeRates WHERE reference_date=?",
                  [row.cutoff_date],
                )
              ).rates_json,
            );
          })(),
        );
      return perDate.get(row.cutoff_date);
    }
    for (const row of pending) {
      try {
        const rates = await ratesFor(row);
        const totals = convertTotals(
          JSON.parse(row.payload_json).originalTotals,
          rates.rates,
        );
        await db.transaction(() =>
          db.run(
            "UPDATE MonthlySnapshots SET status='ready',rates_json=?,totals_json=?,completed_at=? WHERE ID=? AND status='pending'",
            [
              JSON.stringify(rates),
              JSON.stringify(totals),
              date.toISOString(),
              row.ID,
            ],
          ),
        );
      } catch {
        await db.transaction(() =>
          db.run(
            "UPDATE MonthlySnapshots SET next_retry_at=? WHERE ID=? AND status='pending'",
            [date.getTime() + 3600000, row.ID],
          ),
        );
      }
    }
  }
  return {
    async create(userId, input) {
      const data = parse(summarySchema, input);
      const date = now();
      const day = new Intl.DateTimeFormat("en", {
        timeZone,
        day: "2-digit",
      }).format(date);
      const today = `${monthAt(date, timeZone)}-${day}`;
      if (data.to > today)
        throw Object.assign(new Error("End date cannot be in the future"), {
          status: 400,
        });
      const result = await db.transaction(async () => {
        const invoices = await readInvoices(db, userId, {
          from: data.from,
          to: data.to,
        });
        return db.run(
          "INSERT INTO MonthlySnapshots (user_id,month,cutoff_date,timezone,captured_at,payload_json,kind,from_date,to_date,title) VALUES (?,?,?,?,?,?,'ad_hoc',?,?,?)",
          [
            userId,
            data.to.slice(0, 7),
            data.to,
            timeZone,
            date.toISOString(),
            JSON.stringify(snapshotPayload(invoices)),
            data.from,
            data.to,
            data.title,
          ],
        );
      });
      await complete(date, result.id);
      return decode(
        await db.get(
          "SELECT * FROM MonthlySnapshots WHERE ID=? AND user_id=?",
          [result.id, userId],
        ),
        true,
      );
    },
    run() {
      if (!running)
        running = (async () => {
          const date = now();
          await capture(date);
          await complete(date);
        })().finally(() => {
          running = null;
        });
      return running;
    },
    async list(userId) {
      return (
        await db.all(
          "SELECT * FROM MonthlySnapshots WHERE user_id=? ORDER BY captured_at DESC,ID DESC",
          [userId],
        )
      ).map((row) => decode(row, false));
    },
    async get(userId, id) {
      return decode(
        await db.get(
          "SELECT * FROM MonthlySnapshots WHERE user_id=? AND ID=?",
          [userId, id],
        ),
        true,
      );
    },
  };
}
module.exports = { createSnapshotService, monthAt, monthEnd, convertTotals };
