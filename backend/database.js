const sqlite3 = require("sqlite3");
const fs = require("node:fs/promises");
const path = require("node:path");
const bcrypt = require("bcryptjs");

async function openDatabase(filename) {
  const native = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, (error) =>
      error ? reject(error) : resolve(connection),
    );
  });
  let queue = Promise.resolve();
  const db = {
    run: (sql, params = []) =>
      new Promise((resolve, reject) =>
        native.run(sql, params, function (error) {
          error
            ? reject(error)
            : resolve({ id: this.lastID, changes: this.changes });
        }),
      ),
    get: (sql, params = []) =>
      new Promise((resolve, reject) =>
        native.get(sql, params, (error, row) =>
          error ? reject(error) : resolve(row),
        ),
      ),
    all: (sql, params = []) =>
      new Promise((resolve, reject) =>
        native.all(sql, params, (error, rows) =>
          error ? reject(error) : resolve(rows),
        ),
      ),
    exec: (sql) =>
      new Promise((resolve, reject) =>
        native.exec(sql, (error) => (error ? reject(error) : resolve())),
      ),
    close: () =>
      new Promise((resolve, reject) =>
        native.close((error) => (error ? reject(error) : resolve())),
      ),
    transaction(work) {
      const result = queue.then(async () => {
        await db.exec("BEGIN IMMEDIATE");
        try {
          const value = await work();
          await db.exec("COMMIT");
          return value;
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  await db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return db;
}
async function initialize(db, { seedPassword } = {}) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS SchemaMigrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const dir = path.join(__dirname, "migrations");
  for (const name of (await fs.readdir(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (await db.get("SELECT name FROM SchemaMigrations WHERE name=?", [name]))
      continue;
    const sql = await fs.readFile(path.join(dir, name), "utf8");
    await db.transaction(async () => {
      await db.exec(sql);
      await db.run("INSERT INTO SchemaMigrations VALUES (?,?)", [
        name,
        Date.now(),
      ]);
    });
  }
  await db.transaction(async () => {
    if (!(await db.get("SELECT count(*) AS n FROM UserRoles")).n) {
      await db.run(
        "INSERT INTO UserRoles (userrole_name,userrole_description,userrole_manageusers,userrole_manageshops,userrole_managemanufactures) VALUES ('admin','Administrator',1,1,1),('watcher','Personal expense tracking',0,0,0)",
      );
    }
    if (!(await db.get("SELECT count(*) AS n FROM Users")).n) {
      if (!seedPassword || seedPassword.length < 12)
        throw new Error(
          "Set SEED_PASSWORD to at least 12 characters to initialize users.",
        );
      const hash = await bcrypt.hash(seedPassword, 12);
      const roles = await db.all("SELECT ID,userrole_name FROM UserRoles");
      const admin = roles.find((r) => r.userrole_name === "admin");
      const watcher = roles.find((r) => r.userrole_name === "watcher");
      if (!admin || !watcher)
        throw new Error("Expected admin and watcher roles for initial users.");
      for (const username of ["admin", "reader1", "guest1"])
        await db.run(
          "INSERT INTO Users (user_username,user_email,user_name,user_password,userrole_id,user_create_date) VALUES (?,?,?,?,?,?)",
          [
            username,
            `${username}@localhost`,
            username,
            hash,
            username === "admin" ? admin.ID : watcher.ID,
            Date.now(),
          ],
        );
    }
  });
}
module.exports = { openDatabase, initialize };
