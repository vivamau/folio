const fs = require("node:fs/promises");
const sqlite3 = require("sqlite3");
const { openDatabase, initialize } = require("../backend/database");
jest.mock("node:fs/promises", () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));
jest.mock("sqlite3", () => ({ Database: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test("database adapters resolve results and propagate native errors", async () => {
  let failure = null;
  const native = {
    run: jest.fn(function (_sql, _params, cb) {
      cb.call({ lastID: 7, changes: 1 }, failure);
    }),
    get: jest.fn((_sql, _params, cb) => cb(failure, { id: 7 })),
    all: jest.fn((_sql, _params, cb) => cb(failure, [{ id: 7 }])),
    exec: jest.fn((_sql, cb) => cb(failure)),
    close: jest.fn((cb) => cb(failure)),
  };
  sqlite3.Database.mockImplementation(function (_filename, cb) {
    setImmediate(() => cb(null));
    return native;
  });
  const db = await openDatabase("mock.sqlite");
  expect(await db.run("insert")).toEqual({ id: 7, changes: 1 });
  expect(await db.get("select")).toEqual({ id: 7 });
  expect(await db.all("select")).toEqual([{ id: 7 }]);
  await db.transaction(async () => db.run("insert"));
  await expect(
    db.transaction(async () => {
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  failure = new Error("native failure");
  for (const method of ["run", "get", "all", "exec", "close"])
    await expect(db[method]("sql")).rejects.toThrow("native failure");
  failure = null;
  await db.close();
  sqlite3.Database.mockImplementation(function (_filename, cb) {
    setImmediate(() => cb(new Error("open failed")));
  });
  await expect(openDatabase("bad")).rejects.toThrow("open failed");
});
test("initialization rejects missing seed password without filesystem access beyond mocked migrations", async () => {
  fs.readdir.mockResolvedValue(["notes.txt"]);
  const db = {
    exec: jest.fn(),
    get: jest.fn().mockResolvedValue({ n: 0 }),
    run: jest.fn(),
    transaction: (work) => work(),
  };
  await expect(initialize(db)).rejects.toThrow("SEED_PASSWORD");
  await expect(initialize(db, { seedPassword: "short" })).rejects.toThrow(
    "SEED_PASSWORD",
  );
  db.all = jest.fn().mockResolvedValue([]);
  await expect(
    initialize(db, { seedPassword: "Long-password-123" }),
  ).rejects.toThrow("Expected admin and watcher");
});
