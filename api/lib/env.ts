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
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number.parseInt(process.env.SMTP_PORT ?? "465", 10),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpAppPassword: process.env.SMTP_APP_PASSWORD ?? "",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",
};

