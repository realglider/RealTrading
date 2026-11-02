import * as cookie from "cookie";
import { z } from "zod";
import nodemailer from "nodemailer";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, adminQuery, authedQuery } from "./middleware";
import { getMailSettingsStatus, saveMailSettings } from "./queries/mailSettings";

export const authRouter = createRouter({
  me: authedQuery.query(({ ctx }) => {
    const { id, name, email, avatar, role, createdAt, lastSignInAt } = ctx.user;
    return { id, name, email, avatar, role, createdAt, lastSignInAt };
  }),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
  gmailSettings: adminQuery.query(() => getMailSettingsStatus()),
  saveGmailSettings: adminQuery.input(z.object({
    user: z.string().trim().email().max(320),
    appPassword: z.string().trim().min(16).max(64),
  })).mutation(async ({ input }) => {
    const appPassword = input.appPassword.replace(/\s/g, "");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: input.user, pass: appPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.verify();
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Google-Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse, App-Passwort und die 2-Schritt-Bestätigung." });
    }
    await saveMailSettings({ host: "smtp.gmail.com", port: 465, user: input.user, appPassword });
    return { success: true };
  }),
});

