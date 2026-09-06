const { createSnapshotService } = require("../backend/snapshots");
const express = require("express");
const path = require("node:path");
const { openDatabase, initialize } = require("../backend/database");
const { createApp } = require("../backend/app");
(async () => {
  const db = await openDatabase(":memory:");
  await initialize(db, { seedPassword: "E2e-password-123" });
  const user = await db.run(
    "INSERT INTO Users (user_username,user_email,user_password,userrole_id) SELECT 'archive-reader','archive@localhost',user_password,userrole_id FROM Users WHERE user_username='reader1'",
  );
  const shop = await db.run(
    "INSERT INTO Shops (shop_name) VALUES ('Archive café')",
  );
  const item = await db.run("INSERT INTO Items (item_name) VALUES ('Lunch')");
  const invoice = await db.run(
    "INSERT INTO Invoices (invoice_date,shop_id,user_id,invoice_currency) VALUES (?,?,?,'KES')",
    [Date.parse("2026-08-10") / 1000, shop.id, user.id],
  );
  await db.run(
    "INSERT INTO ItemsInvoices (invoice_id,item_id,quantity,unit_price_cents) VALUES (?,?,1,15000)",
    [invoice.id, item.id],
  );
  const rates = {
    EUR: 1,
    USD: 1.2,
    KES: 150,
    GBP: 0.8,
    CHF: 0.9,
    CAD: 1.5,
    AUD: 1.6,
  };
  await createSnapshotService(db, {
    now: () => new Date("2026-09-01T00:00:00Z"),
    fetchRates: async (date) => ({
      source: "Frankfurter",
      base: "EUR",
      requestedDate: date,
      rates,
      dates: Object.fromEntries(Object.keys(rates).map((c) => [c, date])),
    }),
  }).run();
  await db.run("UPDATE Shops SET shop_name='Renamed café' WHERE ID=?", [
    shop.id,
  ]);
  await db.run("DELETE FROM ItemsInvoices WHERE invoice_id=?", [invoice.id]);
  await db.run("DELETE FROM Invoices WHERE ID=?", [invoice.id]);
  const app = createApp(db, {
    secret: "e2e-only-secret-for-disposable-database",
    origin: "http://127.0.0.1:4173",
    snapshotOptions: {
      now: () => new Date("2026-09-06T12:00:00Z"),
      fetchRates: async (date) => ({
        source: "Frankfurter",
        base: "EUR",
        requestedDate: date,
        rates,
        dates: Object.fromEntries(Object.keys(rates).map((c) => [c, date])),
      }),
    },
  });
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.listen(4173, "127.0.0.1");
})();
