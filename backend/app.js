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
  } = {},
) {
  if (!secret) throw new Error("A session secret is required");
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    if (req.headers.origin && req.headers.origin !== origin)
      return res.status(403).json({ error: "Origin not allowed" });
    next();
  });
  app.use(cors({ origin, credentials: true }));
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
  app.get("/api/invoices", async (req, res) => {
    const filter = parse(filterSchema, req.query);
    const clauses = ["v.user_id=?"];
    const params = [req.user.ID];
    if (filter.from) {
      clauses.push("v.invoice_date>=?");
      params.push(Date.parse(filter.from) / 1000);
    }
    if (filter.to) {
      clauses.push("v.invoice_date<?");
      params.push(Date.parse(filter.to) / 1000 + 86400);
    }
    if (filter.currency) {
      clauses.push("v.invoice_currency=?");
      params.push(filter.currency);
    }
    const invoices = await db.all(
      `SELECT v.*,s.shop_name FROM Invoices v LEFT JOIN Shops s ON s.ID=v.shop_id WHERE ${clauses.join(" AND ")} ORDER BY v.invoice_date DESC,v.ID DESC`,
      params,
    );
    const lines = await db.all(
      "SELECT l.*,i.item_name,t.itemtype_name FROM ItemsInvoices l JOIN Invoices v ON v.ID=l.invoice_id LEFT JOIN Items i ON i.ID=l.item_id LEFT JOIN ItemTypes t ON t.ID=i.itemtype_id WHERE v.user_id=?",
      [req.user.ID],
    );
    const results = invoices.map((v) => {
      const entries = lines
        .filter((l) => l.invoice_id === v.ID)
        .map((l) => ({
          itemId: l.item_id,
          name: l.item_name || "Unknown item",
          category: l.itemtype_name || "Uncategorized",
          quantity: l.quantity ?? l.iteminvoice_nr ?? 1,
          unitPriceCents: l.unit_price_cents,
        }));
      const unpriced =
        entries.length === 0 || entries.some((l) => l.unitPriceCents === null);
      return {
        id: v.ID,
        date: new Date(v.invoice_date * 1000).toISOString().slice(0, 10),
        shopId: v.shop_id,
        shop: v.shop_name || "Unknown shop",
        currency: v.invoice_currency,
        notes: v.invoice_notes,
        lines: entries,
        unpriced,
        totalCents: unpriced
          ? null
          : entries.reduce(
              (sum, l) =>
                sum +
                Math.round(
                  (Math.round(l.quantity * 1000) * l.unitPriceCents) / 1000,
                ),
              0,
            ),
      };
    });
    const query = filter.search.toLowerCase();
    res.json(
      results.filter((v) =>
        [v.shop, v.notes, ...v.lines.map((l) => l.name)]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    );
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
