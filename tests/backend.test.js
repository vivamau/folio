const request = require("supertest");
const bcrypt = require("bcryptjs");
const { openDatabase, initialize } = require("../backend/database");
const { createApp } = require("../backend/app");
const { invoiceSchema } = require("../backend/validation");
let db, app, admin, reader;
beforeAll(async () => {
  db = await openDatabase(":memory:");
  await initialize(db, { seedPassword: "Test-password-123" });
  app = createApp(db, {
    secret: "test-secret-that-is-long-enough-for-tests",
    origin: "http://localhost:5173",
  });
  admin = request.agent(app);
  reader = request.agent(app);
  await admin
    .post("/api/login")
    .send({ username: "admin", password: "Test-password-123" })
    .expect(200);
  await reader
    .post("/api/login")
    .send({ username: "reader1", password: "Test-password-123" })
    .expect(200);
});
afterAll(async () => {
  if (db) await db.close();
});
test("migrations are repeatable and seeding preserves users", async () => {
  await initialize(db, { seedPassword: "Different-password-123" });
  expect((await db.all("SELECT * FROM Users")).length).toBe(3);
  expect(
    await bcrypt.compare(
      "Test-password-123",
      (await db.get("SELECT * FROM Users WHERE ID=1")).user_password,
    ),
  ).toBe(true);
});
test("authentication uses cookies and enforces backend permissions", async () => {
  await request(app).get("/api/me").expect(401);
  await request(app).get("/api/catalog").expect(401);
  await request(app).get("/api/me").set("Cookie", "session=bad").expect(401);
  await request(app)
    .post("/api/login")
    .send({ username: "admin", password: "wrong" })
    .expect(401);
  await request(app)
    .post("/api/login")
    .send({ username: "unknown", password: "wrong" })
    .expect(401);
  await request(app).post("/api/login").send({}).expect(400);
  const login = await request(app)
    .post("/api/login")
    .send({ username: "admin", password: "Test-password-123" })
    .expect(200);
  expect(login.body.token).toBeUndefined();
  expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly/);
  expect(login.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
  expect((await admin.get("/api/me")).body.username).toBe("admin");
  await reader.post("/api/shops").send({ name: "Denied" }).expect(403);
  await admin
    .post("/api/shops")
    .set("Origin", "https://evil.example")
    .send({ name: "Denied" })
    .expect(403);
  await request.agent(app).post("/api/logout").expect(204);
});
test("catalog validation, creation and permissions", async () => {
  await admin.post("/api/shops").send({ name: " " }).expect(400);
  const shop = await admin
    .post("/api/shops")
    .send({ name: "Corner Market", address: "Main Street" })
    .expect(201);
  expect(shop.body.id).toBeGreaterThan(0);
  await admin.post("/api/categories").send({ name: "Groceries" }).expect(201);
  await admin
    .post("/api/manufacturers")
    .send({ name: "Local farm" })
    .expect(201);
  await reader.post("/api/items").send({ name: "Denied" }).expect(403);
  await admin
    .post("/api/items")
    .send({ name: "Milk", categoryId: 999 })
    .expect(400);
  await admin
    .post("/api/items")
    .send({ name: "Milk", categoryId: 1, manufacturerId: 1 })
    .expect(201);
  await admin.post("/api/items").send({ name: "Bread" }).expect(201);
  const catalog = (await admin.get("/api/catalog").expect(200)).body;
  expect(catalog.shops[0].name).toBe("Corner Market");
  expect(catalog.items).toHaveLength(2);
  expect(catalog.categories[0].name).toBe("Groceries");
});
const invoice = () => ({
  date: "2026-09-06",
  shopId: 1,
  currency: "EUR",
  notes: "Weekly groceries",
  lines: [
    { itemId: 1, quantity: 2, unitPrice: "1.25" },
    { itemId: 2, quantity: 1, unitPrice: "3.10" },
  ],
});
test("invoice CRUD, exact totals, filters and ownership isolation", async () => {
  const created = await admin.post("/api/invoices").send(invoice()).expect(201);
  const id = created.body.id;
  let list = (await admin.get("/api/invoices").expect(200)).body;
  expect(list[0]).toMatchObject({
    id,
    totalCents: 560,
    currency: "EUR",
    notes: "Weekly groceries",
  });
  expect(list[0].lines).toHaveLength(2);
  expect((await reader.get("/api/invoices")).body).toEqual([]);
  await reader.put(`/api/invoices/${id}`).send(invoice()).expect(404);
  await reader.delete(`/api/invoices/${id}`).expect(404);
  expect(
    (
      await admin.get(
        "/api/invoices?search=corner&from=2026-09-01&to=2026-09-30",
      )
    ).body,
  ).toHaveLength(1);
  expect((await admin.get("/api/invoices?search=missing")).body).toEqual([]);
  expect((await admin.get("/api/invoices?from=2026-10-01")).body).toEqual([]);
  expect((await admin.get("/api/invoices?to=2026-08-01")).body).toEqual([]);
  expect((await admin.get("/api/invoices?currency=USD")).body).toEqual([]);
  await admin.get("/api/invoices?from=bad").expect(400);
  await admin.get("/api/invoices?from=2026-10-01&to=2026-09-01").expect(400);
  await admin
    .put(`/api/invoices/${id}`)
    .send({
      ...invoice(),
      lines: [{ itemId: 1, quantity: 0.5, unitPrice: "2.99" }],
    })
    .expect(200);
  list = (await admin.get("/api/invoices")).body;
  expect(list[0].totalCents).toBe(150);
  await admin.delete(`/api/invoices/${id}`).expect(204);
  await admin.delete(`/api/invoices/${id}`).expect(404);
  expect((await db.all("SELECT * FROM ItemsInvoices")).length).toBe(0);
});
test("rejects invalid expenses without partial writes", async () => {
  for (const data of [
    { ...invoice(), date: "2026-02-30" },
    { ...invoice(), currency: "BAD" },
    { ...invoice(), shopId: 999 },
    { ...invoice(), lines: [] },
    { ...invoice(), lines: [{ itemId: 999, quantity: 1, unitPrice: "2.00" }] },
    { ...invoice(), lines: [{ itemId: 1, quantity: 0, unitPrice: "2" }] },
    { ...invoice(), lines: [{ itemId: 1, quantity: 1, unitPrice: "-2" }] },
    { ...invoice(), lines: [{ itemId: 1, quantity: 1, unitPrice: "1.234" }] },
  ]) {
    await admin.post("/api/invoices").send(data).expect(400);
  }
  expect((await db.all("SELECT * FROM Invoices")).length).toBe(0);
  expect(invoiceSchema.safeParse(invoice()).success).toBe(true);
  await admin.put("/api/invoices/abc").send(invoice()).expect(400);
  await admin.put("/api/invoices/999").send(invoice()).expect(404);
});
test("database errors return a safe response", async () => {
  const broken = createApp(
    {
      get: async () => {
        throw new Error("sensitive database details");
      },
    },
    { secret: "test" },
  );
  const result = await request(broken)
    .post("/api/login")
    .send({ username: "admin", password: "password" })
    .expect(500);
  expect(result.body.error).toBe("Something went wrong. Please try again.");
});
test("fractional quantities round half cents correctly", async () => {
  const result = await admin
    .post("/api/invoices")
    .send({
      ...invoice(),
      lines: [{ itemId: 1, quantity: 0.575, unitPrice: "1.00" }],
    })
    .expect(201);
  const expense = (await admin.get("/api/invoices")).body.find(
    (v) => v.id === result.body.id,
  );
  expect(expense.totalCents).toBe(58);
});
test("session invalidates after password reset and production cookies are secure", async () => {
  const secure = createApp(db, {
    secret: "production-test-secret",
    production: true,
  });
  const result = await request(secure)
    .post("/api/login")
    .send({ username: "admin", password: "Test-password-123" })
    .expect(200);
  expect(result.headers["set-cookie"][0]).toMatch(/Secure/);
  await db.run("UPDATE Users SET user_update_date=? WHERE user_username=?", [
    Date.now(),
    "admin",
  ]);
  await admin.get("/api/me").expect(401);
  await admin
    .post("/api/login")
    .send({ username: "admin", password: "Test-password-123" })
    .expect(200);
  await admin.get("/api/missing").expect(404);
});

test("catalog creation attributes every entry to the authenticated user, ignoring spoofed IDs", async () => {
  const current = (await admin.get("/api/me")).body;
  for (const [route, table] of [
    ["shops", "Shops"],
    ["categories", "ItemTypes"],
    ["items", "Items"],
    ["manufacturers", "Manufactures"],
  ]) {
    const response = await admin
      .post(`/api/${route}`)
      .send({ name: `Attributed ${route}`, user_id: 2, userId: 2 })
      .expect(201);
    expect(response.body.userId).toBe(current.id);
    expect(
      (
        await db.get(`SELECT user_id FROM ${table} WHERE ID=?`, [
          response.body.id,
        ])
      ).user_id,
    ).toBe(current.id);
    const entry = (await admin.get("/api/catalog")).body[route].find(
      (e) => e.id === response.body.id,
    );
    expect(entry.userId).toBe(current.id);
    await expect(
      db.run(`UPDATE ${table} SET user_id=99999 WHERE ID=?`, [
        response.body.id,
      ]),
    ).rejects.toThrow();
  }
});

test("creator attribution follows another authorized account rather than a fixed admin ID", async () => {
  await db.run("UPDATE Users SET userrole_id=1 WHERE user_username='guest1'");
  const other = request.agent(app);
  const login = await other
    .post("/api/login")
    .send({ username: "guest1", password: "Test-password-123" })
    .expect(200);
  expect(login.body.id).not.toBe(1);
  for (const route of ["shops", "categories", "items", "manufacturers"]) {
    const result = await other
      .post(`/api/${route}`)
      .send({ name: `Other creator ${route}`, user_id: 1 })
      .expect(201);
    expect(result.body.userId).toBe(login.body.id);
    expect(
      (await other.get("/api/catalog")).body[route].find(
        (row) => row.id === result.body.id,
      ).userId,
    ).toBe(login.body.id);
  }
});

test("shop deletion requires permission and no expenses from any user", async () => {
  const shop = (await admin.post('/api/shops').send({name: 'Deletable shop'}).expect(201)).body;
  await request(app).delete(`/api/shops/${shop.id}`).expect(401);
  await reader.delete(`/api/shops/${shop.id}`).expect(403);
  await admin.delete('/api/shops/invalid').expect(400);
  await admin.delete('/api/shops/999999').expect(404);
  const invoice = (await reader.post('/api/invoices').send({date:'2026-09-06', currency:'EUR', shopId:shop.id, lines:[{itemId:1,quantity:1,unitPriceCents:100}]}).expect(201)).body;
  const blocked = await admin.delete(`/api/shops/${shop.id}`).expect(409);
  expect(blocked.body.error).toMatch(/expenses/);
  expect(await db.get('SELECT ID FROM Shops WHERE ID=?', [shop.id])).toBeDefined();
  expect(await db.get('SELECT ID FROM Invoices WHERE ID=?', [invoice.id])).toBeDefined();
  await reader.delete(`/api/invoices/${invoice.id}`).expect(204);
  await admin.delete(`/api/shops/${shop.id}`).expect(204);
  expect(await db.get('SELECT ID FROM Shops WHERE ID=?', [shop.id])).toBeUndefined();
  await admin.delete(`/api/shops/${shop.id}`).expect(404);
});
