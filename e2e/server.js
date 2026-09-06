const express = require("express");
const path = require("node:path");
const { openDatabase, initialize } = require("../backend/database");
const { createApp } = require("../backend/app");
(async () => {
  const db = await openDatabase(":memory:");
  await initialize(db, { seedPassword: "E2e-password-123" });
  const app = createApp(db, {
    secret: "e2e-only-secret-for-disposable-database",
    origin: "http://127.0.0.1:4173",
  });
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.listen(4173, "127.0.0.1");
})();
