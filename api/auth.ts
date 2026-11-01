import { scryptSync, timingSafeEqual } from "node:crypto";
import * as cookie from "cookie";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { findUserByUnionId, upsertUser } from "./queries/users";
import { signSessionToken, verifySessionToken } from "./kimi/session";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function validPassword(password: string) {
  const [scheme, saltHex, expectedHex] = env.adminPasswordHash.split("$");
  if (scheme !== "scrypt" || !/^[a-f\d]{32,128}$/i.test(saltHex ?? "") || !/^[a-f\d]{64,128}$/i.test(expectedHex ?? "")) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticateRequest(headers: Headers) {
  const token = cookie.parse(headers.get("cookie") || "")[Session.cookieName];
  if (!token) throw Errors.forbidden("Invalid authentication token.");
  const claim = await verifySessionToken(token);
  if (!claim) throw Errors.forbidden("Invalid authentication token.");
  const user = await findUserByUnionId(claim.unionId);
  if (!user) throw Errors.forbidden("User not found. Please sign in again.");
  return user;
}

export async function login(c: Context) {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) {
    return c.json({ error: "Too many login attempts. Try again in one minute." }, 429);
  }

  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  if (!input || typeof input !== "object") return c.json({ error: "Invalid request." }, 400);
  const body = input as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email !== env.adminEmail || password.length < 12 || password.length > 1024 || !validPassword(password)) {
    const next = attempt && attempt.resetAt > now ? { ...attempt, count: attempt.count + 1 } : { count: 1, resetAt: now + 60_000 };
    loginAttempts.set(ip, next);
    return c.json({ error: "E-Mail oder Passwort ist falsch." }, 401);
  }
  loginAttempts.delete(ip);

  const unionId = `local:${email}`;
  await upsertUser({ unionId, email, name: email.split("@")[0], role: "admin", lastSignInAt: new Date() });
  const token = await signSessionToken({ unionId, clientId: "local" });
  const opts = getSessionCookieOptions(c.req.raw.headers);
  setCookie(c, Session.cookieName, token, { ...opts, maxAge: Session.maxAgeMs / 1000 });
  return c.json({ success: true });
}
