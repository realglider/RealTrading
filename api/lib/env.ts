import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  adminEmail: required("ADMIN_EMAIL").trim().toLowerCase(),
  adminPasswordHash: required("ADMIN_PASSWORD_HASH"),
  resetEmailApiKey: process.env.RESET_EMAIL_API_KEY ?? "",
  resetEmailFrom: process.env.RESET_EMAIL_FROM ?? "",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",
};
