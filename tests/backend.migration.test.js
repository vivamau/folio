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
