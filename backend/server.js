const { createSnapshotService } = require("./snapshots");
const { startSnapshotScheduler } = require("./snapshot-scheduler");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { openDatabase, initialize } = require("./database");
const { createApp } = require("./app");
async function start({ installSignalHandlers = true } = {}) {
  if (fs.existsSync(path.resolve(".env"))) process.loadEnvFile(".env");
  const production = process.env.NODE_ENV === "production";
  if (
    production &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  )
    throw new Error(
      "Production requires JWT_SECRET with at least 32 characters",
    );
  const filename =
    process.env.DB_PATH || path.join(__dirname, "db", "expsense.sqlite");
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  const db = await openDatabase(filename);
  try {
    // SQLite creates a consistent snapshot, including committed WAL data.
    const backup = path.join(
      __dirname,
      "data",
      "before-expense-tracker.sqlite",
    );
    if (filename !== ":memory:" && !fs.existsSync(backup))
      await db.run("VACUUM INTO ?", [backup]);
    await initialize(db, { seedPassword: process.env.SEED_PASSWORD });
    const snapshotService = createSnapshotService(db, {
      timeZone: process.env.MONTH_END_TIMEZONE || "Africa/Nairobi",
    });
    const app = createApp(db, {
      secret: process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex"),
      origin: process.env.APP_ORIGIN || "http://127.0.0.1:5173",
      production,
      defaultCurrency: process.env.DEFAULT_CURRENCY,
      snapshotOptions: {
        timeZone: process.env.MONTH_END_TIMEZONE || "Africa/Nairobi",
      },
    });
    const dist = path.join(__dirname, "..", "dist");
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get("/{*path}", (_req, res) =>
        res.sendFile(path.join(dist, "index.html")),
      );
    }
    let server;
    await new Promise((resolve, reject) => {
      server = app.listen(
        Number(process.env.PORT) || 3001,
        "127.0.0.1",
        resolve,
      );
      server.once?.("error", reject);
    });
    console.log(`Folio is ready at http://127.0.0.1:${server.address().port}`);
    const scheduler = startSnapshotScheduler(snapshotService);
    const stop = async () => {
      await scheduler.stop();
      return new Promise((resolve, reject) =>
        server.close(() => db.close().then(resolve, reject)),
      );
    };
    if (installSignalHandlers) {
      const shutdown = () => stop().then(() => process.exit(0));
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    }
    return { server, stop };
  } catch (error) {
    await db.close();
    throw error;
  }
}
if (require.main === module)
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { start };
