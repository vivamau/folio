const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { openDatabase, initialize } = require("../backend/database");
test("migrates a copy of the supplied database without changing its existing records", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-migration-"));
  const filename = path.join(dir, "copy.sqlite");
  await fs.copyFile(path.resolve("backend/db/expsense.sqlite"), filename);
  const db = await openDatabase(filename);
  try {
    const beforeUsers = await db.all("SELECT * FROM Users");
    const beforeRoles = await db.all("SELECT * FROM UserRoles");
    await initialize(db);
    await initialize(db);
    expect(await db.all("SELECT * FROM Users")).toEqual(beforeUsers);
    expect(await db.all("SELECT * FROM UserRoles")).toEqual(beforeRoles);
    expect(
      (await db.all("PRAGMA table_info(ItemsInvoices)")).map((c) => c.name),
    ).toContain("unit_price_cents");
    expect(await db.all("PRAGMA foreign_key_check")).toEqual([]);
  } finally {
    await db.close();
    await fs.rm(dir, { recursive: true });
  }
});

test("creator migration preserves legacy catalog rows with an unknown creator", async () => {
  const db = await openDatabase(":memory:");
  try {
    await db.exec(
      await fs.readFile(
        path.resolve("backend/migrations/001_initial.sql"),
        "utf8",
      ),
    );
    const tables = [
      ["Shops", "shop_name"],
      ["ItemTypes", "itemtype_name"],
      ["Items", "item_name"],
      ["Manufactures", "manufacturer_name"],
    ];
    for (const [table, column] of tables)
      await db.run(`INSERT INTO ${table} (${column}) VALUES (?)`, [
        "Legacy entry",
      ]);
    await initialize(db, { seedPassword: "Migration-test-password" });
    await initialize(db);
    for (const [table, column] of tables) {
      expect(
        await db.get(`SELECT ${column} AS name,user_id FROM ${table}`),
      ).toEqual({ name: "Legacy entry", user_id: null });
    }
  } finally {
    await db.close();
  }
});

test("ad hoc migration preserves existing monthly pictures, rates and immutability", async () => {
  const db = await openDatabase(":memory:");
  try {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS SchemaMigrations (name TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)",
    );
    for (const name of [
      "001_initial.sql",
      "002_expense_amounts.sql",
      "003_catalog_creators.sql",
      "004_monthly_snapshots.sql",
    ]) {
      await db.exec(
        await fs.readFile(path.resolve("backend/migrations", name), "utf8"),
      );
      await db.run("INSERT INTO SchemaMigrations VALUES (?,0)", [name]);
    }
    await db.run(
      "INSERT INTO Users (ID,user_username,user_email) VALUES (1,'existing','existing@localhost')",
    );
    await db.run(
      "INSERT INTO MonthlySnapshots (ID,user_id,month,cutoff_date,timezone,captured_at,payload_json,status,rates_json,totals_json) VALUES (42,1,'2026-08','2026-08-31','Africa/Nairobi','2026-09-01T00:00:00Z','{\"invoiceCount\":1}','ready','{\"base\":\"EUR\"}','{\"EUR\":100}')",
    );
    await db.run(
      "INSERT INTO MonthlyExchangeRates VALUES ('2026-08','{\"base\":\"EUR\"}')",
    );
    await initialize(db);
    await initialize(db);
    const row = await db.get("SELECT * FROM MonthlySnapshots WHERE ID=42");
    expect(row).toMatchObject({
      kind: "monthly",
      from_date: "2026-08-01",
      to_date: "2026-08-31",
      payload_json: '{"invoiceCount":1}',
      totals_json: '{"EUR":100}',
    });
    expect(
      await db.get(
        "SELECT * FROM SnapshotExchangeRates WHERE reference_date='2026-08-31'",
      ),
    ).toEqual({ reference_date: "2026-08-31", rates_json: '{"base":"EUR"}' });
    await expect(
      db.run("UPDATE MonthlySnapshots SET title='Changed' WHERE ID=42"),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
