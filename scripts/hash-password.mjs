import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const password = await terminal.question("Admin-Passwort eingeben (mindestens 12 Zeichen): ");
  if (password.length < 12) throw new Error("Das Passwort muss mindestens 12 Zeichen lang sein.");
  const salt = randomBytes(32);
  const derivedKey = scryptSync(password, salt, 64);
  console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`);
} finally {
  terminal.close();
}
