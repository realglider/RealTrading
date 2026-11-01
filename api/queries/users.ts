import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function createUser(data: InsertUser) {
  await getDb().insert(schema.users).values(data);
}

export async function updateLastSignIn(userId: number) {
  await getDb()
    .update(schema.users)
    .set({ lastSignInAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export async function savePasswordReset(userId: number, tokenHash: string, expiresAt: Date) {
  await getDb()
    .update(schema.users)
    .set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt })
    .where(eq(schema.users.id, userId));
}

export async function consumePasswordReset(tokenHash: string, newPasswordHash: string) {
  const result = await getDb()
    .update(schema.users)
    .set({
      passwordHash: newPasswordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      sessionVersion: sql`${schema.users.sessionVersion} + 1`,
    })
    .where(and(
      eq(schema.users.passwordResetTokenHash, tokenHash),
      gt(schema.users.passwordResetExpiresAt, new Date()),
    ));
  return result[0].affectedRows > 0;
}

export async function clearPasswordReset(userId: number) {
  await getDb()
    .update(schema.users)
    .set({ passwordResetTokenHash: null, passwordResetExpiresAt: null })
    .where(eq(schema.users.id, userId));
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (values.email && values.email === env.adminEmail) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}
