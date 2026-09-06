jest.mock("../backend/snapshot-scheduler", () => ({
  startSnapshotScheduler: jest.fn(() => ({
    stop: jest.fn().mockResolvedValue(),
  })),
}));
const { EventEmitter } = require("node:events");
jest.mock("node:fs", () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
}));
jest.mock("../backend/database", () => ({
  openDatabase: jest.fn(),
  initialize: jest.fn(),
}));
jest.mock("../backend/app", () => ({ createApp: jest.fn() }));
const fs = require("node:fs");
const { openDatabase, initialize } = require("../backend/database");
const { createApp } = require("../backend/app");
const { start } = require("../backend/server");
const { reset, readPassword } = require("../backend/reset-password");
let db, app, server, environment;
beforeEach(() => {
  environment = { ...process.env };
  delete process.env.NODE_ENV;
  delete process.env.DB_PATH;
  delete process.env.JWT_SECRET;
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(false);
  db = {
    run: jest.fn().mockResolvedValue({ changes: 1 }),
    close: jest.fn().mockResolvedValue(),
  };
  openDatabase.mockResolvedValue(db);
  server = {
    address: () => ({ port: 3001 }),
    close: jest.fn((callback) => callback()),
  };
  app = {
    listen: jest.fn((_port, _host, callback) => {
      setImmediate(callback);
      return server;
    }),
    use: jest.fn(),
    get: jest.fn(),
  };
  createApp.mockReturnValue(app);
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.env = environment;
  jest.restoreAllMocks();
});
test("startup backs up before migrating and returns a shutdown function", async () => {
  const result = await start({ installSignalHandlers: false });
  expect(db.run).toHaveBeenCalledWith("VACUUM INTO ?", [
    expect.stringContaining("before-expense-tracker.sqlite"),
  ]);
  expect(initialize).toHaveBeenCalled();
  expect(createApp).toHaveBeenCalledWith(
    db,
    expect.objectContaining({ production: false }),
  );
  await result.stop();
  expect(db.close).toHaveBeenCalled();
});
test("production refuses a missing secret", async () => {
  process.env.NODE_ENV = "production";
  await expect(start({ installSignalHandlers: false })).rejects.toThrow(
    "JWT_SECRET",
  );
  expect(openDatabase).not.toHaveBeenCalled();
});
test("startup honors env config and an existing backup", async () => {
  fs.existsSync.mockReturnValue(true);
  const load = jest.spyOn(process, "loadEnvFile").mockImplementation(() => {});
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "a".repeat(40);
  process.env.APP_ORIGIN = "https://expenses.example";
  process.env.DB_PATH = ":memory:";
  process.env.PORT = "4000";
  await start({ installSignalHandlers: false });
  expect(load).toHaveBeenCalled();
  expect(db.run).not.toHaveBeenCalled();
  expect(app.use).toHaveBeenCalled();
  expect(app.listen).toHaveBeenCalledWith(
    4000,
    "127.0.0.1",
    expect.any(Function),
  );
  const handler = app.get.mock.calls[0][1],
    res = { sendFile: jest.fn() };
  handler({}, res);
  expect(res.sendFile).toHaveBeenCalled();
});
test("password reset updates only an existing user and closes the connection", async () => {
  await reset({ username: "admin", prompt: async () => "A-new-password-123" });
  expect(db.run).toHaveBeenCalledWith(expect.stringContaining("UPDATE Users"), [
    expect.stringMatching(/^\$2/),
    expect.any(Number),
    "admin",
  ]);
  expect(db.close).toHaveBeenCalled();
  db.run.mockResolvedValueOnce({ changes: 0 });
  await expect(
    reset({ username: "missing", prompt: async () => "A-new-password-123" }),
  ).rejects.toThrow("User not found");
  await expect(reset({ prompt: async () => "short" })).rejects.toThrow(
    "between 12 and 72",
  );
});
test("hidden password input handles enter, backspace, non-interactive and cancellation", async () => {
  const input = new EventEmitter();
  Object.assign(input, {
    isTTY: true,
    setRawMode: jest.fn(),
    resume: jest.fn(),
    pause: jest.fn(),
    setEncoding: jest.fn(),
  });
  const output = { write: jest.fn() };
  const result = readPassword(input, output);
  input.emit("data", "abc\u007fd\r");
  await expect(result).resolves.toBe("abd");
  expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  const cancelled = readPassword(input, output);
  input.emit("data", "\u0003");
  await expect(cancelled).rejects.toThrow("Cancelled");
  await expect(readPassword({ isTTY: false }, output)).rejects.toThrow(
    "interactive terminal",
  );
});

test("startup closes the database when migrations fail", async () => {
  initialize.mockRejectedValueOnce(new Error("Migration failed"));
  await expect(start({ installSignalHandlers: false })).rejects.toThrow(
    "Migration failed",
  );
  expect(db.close).toHaveBeenCalled();
});

test("startup registers a graceful termination handler", async () => {
  const once = jest.spyOn(process, "once").mockImplementation(() => process);
  const exit = jest.spyOn(process, "exit").mockImplementation(() => {});
  await start();
  const handler = once.mock.calls.find(([name]) => name === "SIGTERM")[1];
  await handler();
  expect(db.close).toHaveBeenCalled();
  expect(exit).toHaveBeenCalledWith(0);
});

test("startup connects the month-end scheduler", async () => {
  const { startSnapshotScheduler } = require("../backend/snapshot-scheduler");
  const result = await start({ installSignalHandlers: false });
  expect(startSnapshotScheduler).toHaveBeenCalledWith(
    expect.objectContaining({ run: expect.any(Function) }),
  );
  await result.stop();
  expect(startSnapshotScheduler.mock.results[0].value.stop).toHaveBeenCalled();
});
