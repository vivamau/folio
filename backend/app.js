const { readInvoices } = require("./ledger");
const { createSnapshotService } = require("./snapshots");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const {
  invoiceSchema,
  catalogSchema,
  filterSchema,
  parse,
  z,
  currencies,
} = require("./validation");
const fail = (status, message) => Object.assign(new Error(message), { status });
function createApp(
  db,
  {
    secret,
    origin = "http://127.0.0.1:5173",
    production = false,
    defaultCurrency = "EUR",
    snapshotOptions = {},
  } = {},
) {
  if (!secret) throw new Error("A session secret is required");
  function allowedOrigin(value) {
    if (!value || value === origin) return true;
    try {
      const url = new URL(value);
      return (
        url.origin === value &&
        ["http:", "https:"].includes(url.protocol) &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      );
    } catch {
      return false;
    }
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    if (!allowedOrigin(req.headers.origin))
      return res.status(403).json({ error: "Origin not allowed" });
    next();
  });
  app.use(
    cors({
      origin: (value, callback) => callback(null, allowedOrigin(value)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "128kb" }));
  app.use(cookieParser());
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60 * 1000,
  };
  const publicUser = (user) => ({
    id: user.ID,
    username: user.user_username,
    name: user.user_name || user.user_username,
    canManage: !!user.userrole_manageshops,
    defaultCurrency: currencies.includes(defaultCurrency)
      ? defaultCurrency
      : "EUR",
  });
  app.post(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { username, password } = parse(
        z.object({
          username: z.string().min(1).max(200),
          password: z.string().min(1).max(200),
        }),
        req.body,
      );
      const user = await db.get(
        "SELECT u.*,r.userrole_manageshops FROM Users u JOIN UserRoles r ON r.ID=u.userrole_id WHERE user_username=?",
        [username],
      );
      if (
        !user ||
        !user.user_password ||
        !(await bcrypt.compare(password, String(user.user_password)))
      )
        throw fail(401, "Invalid credentials");
      res
        .cookie(
          "session",
          jwt.sign(
            { sub: String(user.ID), version: user.user_update_date || 0 },
            secret,
            { expiresIn: "2h", algorithm: "HS256" },
          ),
          cookie,
        )
        .json(publicUser(user));
    },
  );
  app.post("/api/logout", (_req, res) =>
    res
      .clearCookie("session", { ...cookie, maxAge: undefined })
      .status(204)
      .end(),
  );
  app.use("/api", async (req, _res, next) => {
    let payload;
    try {
      payload = jwt.verify(req.cookies.session, secret, {
        algorithms: ["HS256"],
      });
    } catch {
      throw fail(401, "Please sign in");
    }
    const user = await db.get(
      "SELECT u.*,r.userrole_manageshops FROM Users u JOIN UserRoles r ON r.ID=u.userrole_id WHERE u.ID=?",
      [payload.sub],
    );
    if (!user || payload.version !== (user.user_update_date || 0))
      throw fail(401, "Please sign in");
    req.user = user;
    next();
  });
  app.get("/api/me", (req, res) => res.json(publicUser(req.user)));
  const snapshots = createSnapshotService(db, snapshotOptions);
  app.post("/api/snapshots", async (req, res) => {
    res.status(201).json(await snapshots.create(req.user.ID, req.body));
  });
  app.get("/api/snapshots", async (req, res) =>
    res.json(await snapshots.list(req.user.ID)),
  );
  app.delete("/api/snapshots/:id", async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    const result = await db.transaction(() =>
      db.run(
        "DELETE FROM MonthlySnapshots WHERE ID=? AND user_id=? AND kind='ad_hoc'",
        [id, req.user.ID],
      ),
    );
    if (!result.changes) throw fail(404, "Ad hoc summary not found");
    res.status(204).end();
  });
  app.get("/api/snapshots/:id", async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    const snapshot = await snapshots.get(req.user.ID, id);
    if (!snapshot) throw fail(404, "Monthly snapshot not found");
    res.json(snapshot);
  });
  app.get("/api/catalog", async (_req, res) => {
    const [shops, items, categories, manufacturers] = await Promise.all([
      db.all(
        "SELECT ID AS id,shop_name AS name,shop_address AS address,user_id AS userId FROM Shops ORDER BY shop_name",
      ),
      db.all(
        "SELECT ID AS id,item_name AS name,itemtype_id AS categoryId,manufacturer_id AS manufacturerId,user_id AS userId FROM Items ORDER BY item_name",
      ),
      db.all(
        "SELECT ID AS id,itemtype_name AS name,user_id AS userId FROM ItemTypes ORDER BY itemtype_name",
      ),
      db.all(
        "SELECT ID AS id,manufacturer_name AS name,user_id AS userId FROM Manufactures ORDER BY manufacturer_name",
      ),
    ]);
    res.json({ shops, items, categories, manufacturers });
  });
  const catalogRoutes = {
    shops: ["Shops", "shop_name", "shop_address"],
    categories: ["ItemTypes", "itemtype_name"],
    manufacturers: ["Manufactures", "manufacturer_name"],
    items: ["Items", "item_name"],
  };
  for (const [route, [table, column, address]] of Object.entries(catalogRoutes))
    app.post(`/api/${route}`, async (req, res) => {
      if (!req.user.userrole_manageshops)
        throw fail(403, "Catalog management requires administrator access");
      const data = parse(catalogSchema, req.body);
      const result = await db.transaction(async () => {
        if (route === "items")
          return db.run(
            "INSERT INTO Items (item_name,itemtype_id,manufacturer_id,item_create_date,user_id) VALUES (?,?,?,?,?)",
            [
              data.name,
              data.categoryId ?? null,
              data.manufacturerId ?? null,
              Date.now(),
              req.user.ID,
            ],
          );
        return db.run(
          `INSERT INTO ${table} (${column}${address ? `,${address}` : ""},user_id) VALUES (?${address ? ",?" : ""},?)`,
          address
            ? [data.name, data.address, req.user.ID]
            : [data.name, req.user.ID],
        );
      });
      res.status(201).json({ id: result.id, userId: req.user.ID });
    });
  app.delete("/api/shops/:id", async (req, res) => {
    if (!req.user.userrole_manageshops)
      throw fail(403, "Catalog management requires administrator access");
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    await db.transaction(async () => {
      if (!(await db.get("SELECT ID FROM Shops WHERE ID=?", [id])))
        throw fail(404, "Shop not found");
      if (await db.get("SELECT ID FROM Invoices WHERE shop_id=? LIMIT 1", [id]))
        throw fail(409, "Cannot delete a shop with related expenses.");
      await db.run("DELETE FROM Shops WHERE ID=?", [id]);
    });
    res.status(204).end();
  });
  app.get("/api/invoices", async (req, res) => {
    const filter = parse(filterSchema, req.query);
    res.json(await db.transaction(() => readInvoices(db, req.user.ID, filter)));
  });
  async function saveInvoice(req, res) {
    const data = parse(invoiceSchema, req.body);
    const id =
      req.params.id === undefined
        ? null
        : parse(z.coerce.number().int().positive(), req.params.id);
    const result = await db.transaction(async () => {
      if (
        id &&
        !(await db.get("SELECT ID FROM Invoices WHERE ID=? AND user_id=?", [
          id,
          req.user.ID,
        ]))
      )
        throw fail(404, "Expense not found");
      if (!(await db.get("SELECT ID FROM Shops WHERE ID=?", [data.shopId])))
        throw fail(400, "Choose an existing shop");
      for (const line of data.lines)
        if (!(await db.get("SELECT ID FROM Items WHERE ID=?", [line.itemId])))
          throw fail(400, "Choose existing items");
      const date = Date.parse(data.date) / 1000;
      const now = Date.now();
      let invoiceId = id;
      if (id) {
        await db.run(
          "UPDATE Invoices SET invoice_date=?,shop_id=?,invoice_currency=?,invoice_notes=?,invoice_update_date=? WHERE ID=?",
          [date, data.shopId, data.currency, data.notes, now, id],
        );
        await db.run("DELETE FROM ItemsInvoices WHERE invoice_id=?", [id]);
      } else {
        invoiceId = (
          await db.run(
            "INSERT INTO Invoices (invoice_date,shop_id,user_id,invoice_currency,invoice_notes,invoice_create_date,invoice_update_date) VALUES (?,?,?,?,?,?,?)",
            [
              date,
              data.shopId,
              req.user.ID,
              data.currency,
              data.notes,
              now,
              now,
            ],
          )
        ).id;
      }
      for (const line of data.lines) {
        const [whole, fraction = ""] = line.unitPrice.split(".");
        const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
        await db.run(
          "INSERT INTO ItemsInvoices (item_id,invoice_id,quantity,unit_price_cents,iteminvoice_create_date,iteminvoice_update_date) VALUES (?,?,?,?,?,?)",
          [line.itemId, invoiceId, line.quantity, cents, now, now],
        );
      }
      return invoiceId;
    });
    res.status(id ? 200 : 201).json({ id: result });
  }
  app.post("/api/invoices", saveInvoice);
  app.put("/api/invoices/:id", saveInvoice);
  app.delete("/api/invoices/:id", async (req, res) => {
    const id = parse(z.coerce.number().int().positive(), req.params.id);
    await db.transaction(async () => {
      if (
        !(await db.get("SELECT ID FROM Invoices WHERE ID=? AND user_id=?", [
          id,
          req.user.ID,
        ]))
      )
        throw fail(404, "Expense not found");
      await db.run("DELETE FROM ItemsInvoices WHERE invoice_id=?", [id]);
      await db.run("DELETE FROM Invoices WHERE ID=?", [id]);
    });
    res.status(204).end();
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use((error, _req, res, _next) => {
    const status =
      error.status || (error.code === "SQLITE_CONSTRAINT" ? 400 : 500);
    res.status(status).json({
      error:
        status === 500
          ? "Something went wrong. Please try again."
          : error.code === "SQLITE_CONSTRAINT"
            ? "Invalid reference or duplicate entry"
            : error.message,
    });
  });
  return app;
}
module.exports = { createApp };
