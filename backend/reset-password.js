const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { openDatabase } = require("./database");
// Never echo passwords or pass them through shell arguments.
async function readPassword(input = process.stdin, output = process.stdout) {
  if (!input.isTTY)
    throw new Error("Run this command in an interactive terminal.");
  return new Promise((resolve, reject) => {
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const finish = (error) => {
      input.removeListener("data", read);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      error ? reject(error) : resolve(value);
    };
    const read = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(new Error("Cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", read);
  });
}
async function reset({
  username = "admin",
  prompt = readPassword,
} = {}) {
  if (fs.existsSync(".env")) process.loadEnvFile(".env");
  process.stdout.write(
    `New password for ${username} (minimum 12 characters): `,
  );
  const password = await prompt();
  if (password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error("Use a password between 12 and 72 bytes.");
  const db = await openDatabase(
    process.env.DB_PATH || path.join(__dirname, "db", "expsense.sqlite"),
  );
  try {
    const result = await db.run(
      "UPDATE Users SET user_password=?,user_update_date=? WHERE user_username=?",
      [await bcrypt.hash(password, 12), Date.now(), username],
    );
    if (!result.changes) throw new Error("User not found");
    console.log("Password updated. You can now sign in.");
  } finally {
    await db.close();
  }
}
if (require.main === module)
  reset({ username: process.argv[2] || "admin" }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { reset, readPassword };
