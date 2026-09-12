const request = require("supertest");
const { openDatabase, initialize } = require("../backend/database");
const { createApp } = require("../backend/app");
const {
  createSnapshotService,
  monthAt,
  monthEnd,
  convertTotals,
} = require("../backend/snapshots");
const { getHistoricalRates } = require("../backend/exchange-rates");
const { startSnapshotScheduler } = require("../backend/snapshot-scheduler");
const rates = {
  source: "Frankfurter",
  url: "https://api.frankfurter.dev/v2/rates",
  base: "EUR",
  requestedDate: "2026-08-31",
  rates: { EUR: 1, USD: 1.2, KES: 150, GBP: 0.8, CHF: 0.9, CAD: 1.5, AUD: 1.6 },
  dates: Object.fromEntries(
    ["EUR", "USD", "KES", "GBP", "CHF", "CAD", "AUD"].map((c) => [
      c,
      "2026-08-31",
    ]),
  ),
};
let db, clock, fetchRates, service, app, admin;
beforeEach(async () => {
  db = await openDatabase(":memory:");
  await initialize(db, { seedPassword: "Test-password-123" });
  clock = new Date("2026-08-31T20:59:00Z");
  fetchRates = jest.fn().mockResolvedValue(rates);
  service = createSnapshotService(db, {
    now: () => clock,
    fetchRates,
    timeZone: "Africa/Nairobi",
  });
  app = createApp(db, { secret: "snapshot-test-secret" });
  admin = request.agent(app);
  await admin
    .post("/api/login")
    .send({ username: "admin", password: "Test-password-123" });
  await admin.post("/api/shops").send({ name: "Market" });
  await admin.post("/api/items").send({ name: "Coffee" });
});
afterEach(async () => {
  await db.close();
});
const invoice = (currency = "KES", price = "150.00", date = "2026-08-31") => ({
  date,
  shopId: 1,
  currency,
  lines: [{ itemId: 1, quantity: 1, unitPrice: price }],
});
test("month boundaries use Nairobi time and handle leap years", () => {
  expect(monthAt(new Date("2026-08-31T21:00:00Z"), "Africa/Nairobi")).toBe(
    "2026-09",
  );
  expect(monthEnd("2024-02")).toBe("2024-02-29");
  expect(monthEnd("2026-12")).toBe("2026-12-31");
  expect(() => monthAt(new Date(), "Invalid/Zone")).toThrow();
  expect(convertTotals({ KES: 15000, USD: 120 }, rates.rates)).toEqual({
    EUR: 200,
    USD: 240,
    KES: 30000,
    GBP: 160,
    CHF: 180,
    CAD: 300,
    AUD: 320,
  });
  expect(convertTotals({ EUR: 1 }, { ...rates.rates, USD: 0.5 }).USD).toBe(1);
  expect(() => convertTotals({ BAD: 1 }, rates.rates)).toThrow();
});
test("captures exactly once at month rollover with all currency totals and frozen details", async () => {
  const inserted = await admin.post("/api/invoices").send(invoice());
  await admin.post("/api/invoices").send(invoice("USD", "1.20"));
  await admin.post("/api/invoices").send(invoice("EUR", "50", "2026-09-01"));
  await service.run();
  expect(await service.list(1)).toEqual([]);
  clock = new Date("2026-08-31T21:00:00Z");
  await Promise.all([service.run(), service.run()]);
  const list = await service.list(1);
  expect(list).toHaveLength(1);
  let saved = await service.get(1, list[0].id);
  expect(saved).toMatchObject({
    month: "2026-08",
    status: "ready",
    invoiceCount: 2,
    catchUp: false,
    totals: { EUR: 200, KES: 30000, USD: 240 },
    originalTotals: { KES: 15000, USD: 120 },
    cutoffDate: "2026-08-31",
  });
  expect(saved.invoices[0].shop).toBe("Market");
  expect(saved.rates).toEqual(rates);
  await admin
    .put(`/api/invoices/${inserted.body.id}`)
    .send(invoice("KES", "900"));
  await db.run("UPDATE Shops SET shop_name='Changed'");
  await db.run("UPDATE Items SET item_name='Renamed'");
  await admin.delete(`/api/invoices/${inserted.body.id}`);
  await service.run();
  expect(await service.get(1, list[0].id)).toEqual(saved);
  expect(fetchRates).toHaveBeenCalledTimes(1);
  await expect(
    db.run("UPDATE MonthlySnapshots SET payload_json='{}' WHERE ID=?", [
      saved.id,
    ]),
  ).rejects.toThrow();
});
test("captures expense data before rate failure, retries without recapturing and survives restart", async () => {
  await admin.post("/api/invoices").send(invoice());
  clock = new Date("2026-09-06T12:00:00Z");
  fetchRates.mockRejectedValueOnce(new Error("Network unavailable"));
  await service.run();
  const pending = (await service.list(1))[0];
  expect(pending.status).toBe("pending");
  expect(pending.catchUp).toBe(true);
  await db.run("DELETE FROM ItemsInvoices");
  await db.run("DELETE FROM Invoices");
  await service.run();
  expect(fetchRates).toHaveBeenCalledTimes(1);
  clock = new Date("2026-09-06T13:01:00Z");
  service = createSnapshotService(db, {
    now: () => clock,
    fetchRates,
    timeZone: "Africa/Nairobi",
  });
  await service.run();
  const saved = await service.get(1, pending.id);
  expect(saved.status).toBe("ready");
  expect(saved.invoices).toHaveLength(1);
  expect(saved.totals.KES).toBe(15000);
});
test("catches up missing months including empty months and reports unpriced legacy entries", async () => {
  await admin.post("/api/invoices").send(invoice("EUR", "10", "2026-06-15"));
  await db.run("UPDATE ItemsInvoices SET unit_price_cents=NULL");
  clock = new Date("2026-09-06T12:00:00Z");
  await service.run();
  const list = await service.list(1);
  expect(list.map((s) => s.month)).toEqual(["2026-08", "2026-07", "2026-06"]);
  const june = await service.get(1, list[2].id);
  expect(june.unpricedCount).toBe(1);
  expect(june.pricedCount).toBe(0);
  expect(june.totals.EUR).toBe(0);
  expect((await service.get(1, list[0].id)).invoiceCount).toBe(0);
});
test("snapshot API is read-only and scoped to the signed-in user", async () => {
  await admin.post("/api/invoices").send(invoice());
  clock = new Date("2026-09-01T00:00:00Z");
  await service.run();
  await request(app).get("/api/snapshots").expect(401);
  const list = (await admin.get("/api/snapshots").expect(200)).body;
  expect(list).toHaveLength(1);
  expect(list[0].invoices).toBeUndefined();
  await admin.get(`/api/snapshots/${list[0].id}`).expect(200);
  await admin.get("/api/snapshots/bad").expect(400);
  await admin.get("/api/snapshots/999").expect(404);
  const reader = request.agent(app);
  await reader
    .post("/api/login")
    .send({ username: "reader1", password: "Test-password-123" });
  expect((await reader.get("/api/snapshots")).body).toEqual([]);
  await reader.get(`/api/snapshots/${list[0].id}`).expect(404);
  await admin.delete(`/api/snapshots/${list[0].id}`).expect(404);
});
test("validates historical provider data and does not substitute current or missing rates", async () => {
  const rows = Object.entries(rates.rates)
    .filter(([c]) => c !== "EUR")
    .map(([quote, rate]) => ({ base: "EUR", quote, rate, date: "2026-08-28" }));
  const fetchFn = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => rows });
  const result = await getHistoricalRates("2026-08-31", { fetchFn });
  expect(result.rates).toEqual(rates.rates);
  expect(result.dates.KES).toBe("2026-08-28");
  expect(fetchFn.mock.calls[0][0]).toContain("date=2026-08-31");
  for (const invalid of [
    [],
    {},
    rows.slice(1),
    rows.map((r) => ({ ...r, date: "2026-09-01" })),
    rows.map((r) => ({ ...r, date: "2026-07-01" })),
    rows.map((r) => ({ ...r, rate: 0 })),
    rows.map((r) => ({ ...r, rate: Infinity })),
  ]) {
    await expect(
      getHistoricalRates("2026-08-31", {
        fetchFn: async () => ({ ok: true, json: async () => invalid }),
      }),
    ).rejects.toThrow();
  }
  await expect(
    getHistoricalRates("2026-08-31", {
      fetchFn: async () => ({ ok: false, status: 503 }),
    }),
  ).rejects.toThrow("503");
  await expect(
    getHistoricalRates("2026-08-31", {
      fetchFn: async () => {
        throw new Error("timeout");
      },
    }),
  ).rejects.toThrow("timeout");
});
test("scheduler starts immediately, prevents overlap, retries on ticks, and drains on stop", async () => {
  jest.useFakeTimers();
  try {
    let finish;
    const run = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue();
    const onError = jest.fn();
    const scheduler = startSnapshotScheduler(
      { run },
      { intervalMs: 1000, onError },
    );
    expect(run).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await jest.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    run.mockRejectedValueOnce(new Error("Failed"));
    await jest.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalled();
    await scheduler.stop();
    const count = run.mock.calls.length;
    await jest.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(count);
  } finally {
    jest.useRealTimers();
  }
});

test("snapshot arithmetic rejects unsafe totals and supports very small decimal rates", () => {
  expect(() => convertTotals({ EUR: -1 }, rates.rates)).toThrow(
    "Invalid expense total",
  );
  expect(() =>
    convertTotals(
      { EUR: Number.MAX_SAFE_INTEGER },
      { ...rates.rates, KES: 1e8 },
    ),
  ).toThrow("precision");
  expect(convertTotals({ EUR: 100 }, { ...rates.rates, USD: 1e-7 }).USD).toBe(
    0,
  );
  expect(() =>
    convertTotals({ EUR: 1 }, { ...rates.rates, USD: 1e21 }),
  ).toThrow("precision");
});

test("ad hoc captures support repeated date ranges without replacing monthly snapshots or moving cursors", async () => {
  await admin.post("/api/invoices").send(invoice());
  const input = {
    title: "August so far",
    from: "2026-08-01",
    to: "2026-08-31",
  };
  const first = await service.create(1, input);
  expect(first).toMatchObject({
    kind: "ad_hoc",
    title: "August so far",
    fromDate: input.from,
    toDate: input.to,
    status: "ready",
    invoiceCount: 1,
    totals: { KES: 15000 },
  });
  expect(
    await db.get("SELECT * FROM MonthlySnapshotCursors WHERE user_id=1"),
  ).toBeUndefined();
  await admin.post("/api/invoices").send(invoice("KES", "50"));
  const second = await service.create(1, input);
  expect(second.id).not.toBe(first.id);
  expect(second.totals.KES).toBe(20000);
  expect((await service.get(1, first.id)).totals.KES).toBe(15000);
  await expect(
    db.run("UPDATE MonthlySnapshots SET title='Changed' WHERE ID=?", [
      first.id,
    ]),
  ).rejects.toThrow();
  clock = new Date("2026-09-01T00:00:00Z");
  await service.run();
  const list = await service.list(1);
  expect(list.filter((s) => s.kind === "monthly")).toHaveLength(1);
  expect(list.filter((s) => s.kind === "ad_hoc")).toHaveLength(2);
});
test("ad hoc ranges use their end-date rates and preserve data during a provider outage", async () => {
  await admin.post("/api/invoices").send(invoice("KES", "150", "2026-08-10"));
  fetchRates.mockRejectedValueOnce(new Error("Unavailable"));
  const saved = await service.create(1, {
    from: "2026-08-01",
    to: "2026-08-15",
  });
  expect(saved.status).toBe("pending");
  expect(fetchRates).toHaveBeenCalledWith("2026-08-15");
  await db.run("DELETE FROM ItemsInvoices");
  await db.run("DELETE FROM Invoices");
  clock = new Date("2026-09-01T01:00:00Z");
  await service.run();
  expect((await service.get(1, saved.id)).invoiceCount).toBe(1);
  expect((await service.get(1, saved.id)).status).toBe("ready");
});
test("ad hoc API validates dates, uses the signed-in user and supports current-month snapshots", async () => {
  const apiApp = createApp(db, {
    secret: "ad-hoc-tests",
    snapshotOptions: {
      now: () => clock,
      fetchRates,
      timeZone: "Africa/Nairobi",
    },
  });
  const user = request.agent(apiApp);
  await user
    .post("/api/login")
    .send({ username: "reader1", password: "Test-password-123" });
  await request(apiApp)
    .post("/api/snapshots")
    .send({ from: "2026-08-01", to: "2026-08-31" })
    .expect(401);
  for (const data of [
    { from: "2026-08-31", to: "2026-08-01" },
    { from: "2026-02-30", to: "2026-08-31" },
    { from: "2026-08-01", to: "2026-09-01" },
    {},
  ])
    await user.post("/api/snapshots").send(data).expect(400);
  const result = await user
    .post("/api/snapshots")
    .send({
      title: "My summary",
      from: "2026-08-01",
      to: "2026-08-31",
      userId: 1,
      kind: "monthly",
    })
    .expect(201);
  expect(result.body).toMatchObject({
    kind: "ad_hoc",
    title: "My summary",
    invoiceCount: 0,
  });
  expect(
    (
      await db.get("SELECT user_id FROM MonthlySnapshots WHERE ID=?", [
        result.body.id,
      ])
    ).user_id,
  ).toBe(2);
  await user.get(`/api/snapshots/${result.body.id}`).expect(200);
});

test("only owners can delete ad hoc summaries without affecting expenses or monthly captures", async () => {
  await admin.post("/api/invoices").send(invoice()).expect(201);
  const saved = await service.create(1, {
    from: "2026-08-01",
    to: "2026-08-31",
  });
  const reader = request.agent(app);
  await reader
    .post("/api/login")
    .send({ username: "reader1", password: "Test-password-123" });
  await request(app).delete(`/api/snapshots/${saved.id}`).expect(401);
  await reader.delete(`/api/snapshots/${saved.id}`).expect(404);
  await admin.delete("/api/snapshots/bad").expect(400);
  await admin.delete(`/api/snapshots/${saved.id}`).expect(204);
  await admin.get(`/api/snapshots/${saved.id}`).expect(404);
  await admin.delete(`/api/snapshots/${saved.id}`).expect(404);
  expect((await admin.get("/api/invoices")).body).toHaveLength(1);
  fetchRates.mockRejectedValue(new Error("offline"));
  const pending = await service.create(1, {
    from: "2026-08-01",
    to: "2026-08-30",
  });
  expect(pending.status).toBe("pending");
  await admin.delete(`/api/snapshots/${pending.id}`).expect(204);
  await service.run();
  expect(await service.get(1, pending.id)).toBeNull();
});
