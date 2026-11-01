import { authRouter } from "./auth-router";
import { botRouter } from "./bot-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
