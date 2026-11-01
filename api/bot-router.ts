import { z } from "zod";
import { MARKETS, TIMEFRAMES } from "@contracts/trading";
import { adminQuery, createRouter } from "./middleware";
import { getCoinDirectory } from "./services/coinDirectory";
import {
  emergencyStop,
  getOverview,
  removeCredentials,
  runMarketForUser,
  runValidation,
  saveCredentials,
  saveSettings,
  setLiveEnabled,
} from "./services/botService";

const market = z.enum(MARKETS);
const symbol = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, "Ungültiges KuCoin-Symbol");

export const botRouter = createRouter({
  overview: adminQuery.query(({ ctx }) => getOverview(ctx.user.id)),

  coinOptions: adminQuery.input(z.object({ market })).query(({ input }) => getCoinDirectory(input.market)),

  saveSettings: adminQuery.input(z.object({
    market,
    symbol,
    timeframe: z.enum(TIMEFRAMES),
    riskPct: z.number().min(0.01).max(5),
    maxPositionUsd: z.number().min(1).max(1_000_000),
    maxDailyLossUsd: z.number().min(0.01).max(1_000_000),
    leverage: z.number().int().min(1).max(20),
  })).mutation(({ ctx, input }) => saveSettings(ctx.user.id, input)),

  saveCredentials: adminQuery.input(z.object({
    market,
    key: z.string().trim().min(10).max(128),
    secret: z.string().trim().min(10).max(256),
    passphrase: z.string().trim().min(1).max(128),
    keyVersion: z.enum(["2", "3"]),
  })).mutation(({ ctx, input }) => saveCredentials(ctx.user.id, input.market, input)),

  removeCredentials: adminQuery.input(z.object({ market })).mutation(({ ctx, input }) =>
    removeCredentials(ctx.user.id, input.market),
  ),

  validate: adminQuery.input(z.object({ market })).mutation(({ ctx, input }) =>
    runValidation(ctx.user.id, input.market),
  ),

  setLive: adminQuery.input(z.object({ market, enabled: z.boolean() })).mutation(({ ctx, input }) =>
    setLiveEnabled(ctx.user.id, input.market, input.enabled),
  ),

  runNow: adminQuery.input(z.object({ market })).mutation(({ ctx, input }) =>
    runMarketForUser(ctx.user.id, input.market),
  ),

  emergencyStop: adminQuery.mutation(({ ctx }) => emergencyStop(ctx.user.id)),
});
