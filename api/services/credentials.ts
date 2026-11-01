import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../lib/env";

function encryptionKey() {
  return createHash("sha256").update(`realtrading-kucoin:${env.appSecret}`).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Ungültige verschlüsselte Zugangsdaten");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskApiKey(key: string) {
  return key.length > 8 ? `${key.slice(0, 3)}…${key.slice(-4)}` : "••••••••";
}
