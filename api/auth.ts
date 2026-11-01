import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as cookie from "cookie";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { createUser, findUserByEmail, findUserByUnionId, updateLastSignIn, upsertUser } from "./queries/users";
import { signSessionToken, verifySessionToken } from "./kimi/session";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const registrationAttempts = new Map<string, { count: number; resetAt: number }>();

function validPassword(password: string) {
  const [scheme, saltHex, expectedHex] = env.adminPasswordHash.split("$");
  if (scheme !== "scrypt" || !/^[a-f\d]{32,128}$/i.test(saltHex ?? "") || !/^[a-f\d]{64,128}$/i.test(expectedHex ?? "")) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validStoredPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  const [scheme, saltHex, expectedHex] = hash.split("$");
  if (scheme !== "scrypt" || !/^[a-f\d]{32,128}$/i.test(saltHex ?? "") || !/^[a-f\d]{64,128}$/i.test(expectedHex ?? "")) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function passwordHash(password: string) {
  const salt = randomBytes(32);
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

function hitLimit(limits: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = limits.get(key);
  if (current && current.resetAt > now) {
    if (current.count >= max) return true;
    current.count += 1;
  } else {
    limits.set(key, { count: 1, resetAt: now + windowMs });
  }
  return false;
}

function issueSession(c: Context, unionId: string) {
  return signSessionToken({ unionId, clientId: "local" }).then((token) => {
    const opts = getSessionCookieOptions(c.req.raw.headers);
    setCookie(c, Session.cookieName, token, { ...opts, maxAge: Session.maxAgeMs / 1000 });
  });
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
  if (hitLimit(loginAttempts, ip, 10, 60_000)) {
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
  if (!email || password.length < 12 || password.length > 1024) {
    return c.json({ error: "E-Mail oder Passwort ist falsch." }, 401);
  }

  const user = await findUserByEmail(email);
  const isAdmin = email === env.adminEmail && validPassword(password);
  if (!isAdmin && !validStoredPassword(password, user?.passwordHash)) {
    return c.json({ error: "E-Mail oder Passwort ist falsch." }, 401);
  }

  const unionId = user?.unionId ?? `local:${email}`;
  if (isAdmin && !user) {
    await upsertUser({ unionId, email, name: email.split("@")[0], role: "admin", lastSignInAt: new Date() });
  } else if (user) {
    await updateLastSignIn(user.id);
  }
  loginAttempts.delete(ip);
  await issueSession(c, unionId);
  return c.json({ success: true });
}

export async function register(c: Context) {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (hitLimit(registrationAttempts, ip, 5, 60 * 60_000)) {
    return c.json({ error: "Zu viele Registrierungsversuche. Bitte später erneut versuchen." }, 429);
  }

  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return c.json({ error: "Ungültige Anfrage." }, 400);
  }
  if (!input || typeof input !== "object") return c.json({ error: "Ungültige Anfrage." }, 400);
  const body = input as { name?: unknown; email?: unknown; password?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return c.json({ error: "Bitte Namen und eine gültige E-Mail-Adresse eingeben." }, 400);
  }
  if (password.length < 12 || password.length > 1024) {
    return c.json({ error: "Das Passwort muss mindestens 12 Zeichen lang sein." }, 400);
  }
  if (email === env.adminEmail || await findUserByEmail(email)) {
    return c.json({ error: "Für diese E-Mail-Adresse besteht bereits ein Konto." }, 409);
  }

  const unionId = `local:${email}`;
  try {
    await createUser({
      unionId,
      email,
      name,
      passwordHash: passwordHash(password),
      role: "user",
      lastSignInAt: new Date(),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return c.json({ error: "Für diese E-Mail-Adresse besteht bereits ein Konto." }, 409);
    }
    throw error;
  }

  await issueSession(c, unionId);
  return c.json({ success: true });
}
