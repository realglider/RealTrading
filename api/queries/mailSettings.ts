import { eq } from "drizzle-orm";
import { mailSettings } from "@db/schema";
import { getDb } from "./connection";
import { decryptSecret, encryptSecret } from "../services/credentials";

const SETTINGS_ID = 1;

export async function getMailSettings() {
  const rows = await getDb().select().from(mailSettings).where(eq(mailSettings.id, SETTINGS_ID)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    host: row.host,
    port: row.port,
    user: row.user,
    appPassword: decryptSecret(row.encryptedAppPassword),
  };
}

export async function getMailSettingsStatus() {
  const rows = await getDb().select().from(mailSettings).where(eq(mailSettings.id, SETTINGS_ID)).limit(1);
  const row = rows[0];
  return row ? { configured: true, host: row.host, port: row.port, user: row.user } : { configured: false, host: "smtp.gmail.com", port: 465, user: "" };
}

export async function saveMailSettings(input: { host: string; port: number; user: string; appPassword: string }) {
  await getDb().insert(mailSettings).values({
    id: SETTINGS_ID,
    host: input.host,
    port: input.port,
    user: input.user,
    encryptedAppPassword: encryptSecret(input.appPassword.replace(/\s/g, "")),
  }).onDuplicateKeyUpdate({
    set: {
      host: input.host,
      port: input.port,
      user: input.user,
      encryptedAppPassword: encryptSecret(input.appPassword.replace(/\s/g, "")),
    },
  });
}

