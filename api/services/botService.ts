import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { STRATEGIES, TIMEFRAMES } from "@contracts/trading";
import type {
  BotOverviewDto,
  BotSettingsDto,
  CoinRankingDto,
  Market,
  PositionDto,
  RecommendationDto,
  Timeframe,
  ValidationDto,
  ValidationFoldDto,
} from "@contracts/trading";
import { apiCredentials, botEvents, botSettings, coinRankings, orders, positions, validationRuns, type Position } from "@db/schema";
import { getDb } from "../queries/connection";
import { log } from "../lib/logger";
import { decryptSecret, encryptSecret, maskApiKey } from "./credentials";
import { getCoinDirectory } from "./coinDirectory";
import {
  getAvailableEquity,
  getInstrumentRules,
  getKlines,
  getOrderFill,
  hasOpenFuturesPosition,
  isClosedCandle,
  placeMarketOrder,
  testCredentials,
  timeframeSeconds,
  type KucoinCredentials,
} from "./kucoin";
import { calculatePositionSize, estimateRealizedPnl } from "./risk";
import { selectCoinRecommendation, selectTimeframeRecommendation } from "./recommendation";
import { coinUniverse, preferredValidationSymbols, rankCoinMarketData } from "./marketResearch";
import { evaluateLatestActionableSignal, runWalkForward } from "./strategyEngine";

const VALIDATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const runningMarkets = new Set<string>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (date: Date | null) => date?.toISOString() ?? null;

function keyFor(userId: number, market: Market) {
  return `${userId}:${market}`;
}

async function recordEvent(userId: number, market: Market, level: "info" | "warn" | "error" | "success", message: string) {
  await getDb().insert(botEvents).values({ userId, market, level, message: message.slice(0, 4000) });
}

export async function ensureSettings(userId: number) {
  const db = getDb();
  const existing = await db.select().from(botSettings).where(eq(botSettings.userId, userId));
  for (const market of ["spot", "futures"] as const) {
    if (existing.some((row) => row.market === market)) continue;
    await db.insert(botSettings).values({
      userId,
      market,
      symbol: market === "spot" ? "BTC-USDT" : "XBTUSDTM",
      timeframe: "15m",
      riskPct: "0.500",
      maxPositionUsd: "250.00",
      maxDailyLossUsd: "25.00",
      leverage: market === "futures" ? 2 : 1,
      liveEnabled: false,
    }).onDuplicateKeyUpdate({ set: { userId } });
  }
  return db.select().from(botSettings).where(eq(botSettings.userId, userId)).orderBy(botSettings.market);
}

function toSettingsDto(
  rows: Awaited<ReturnType<typeof ensureSettings>>,
  credentials: Array<{ market: Market; keyHint: string }>,
): BotSettingsDto[] {
  return rows.map((row) => {
    const credential = credentials.find((item) => item.market === row.market);
    return {
      market: row.market,
      symbol: row.symbol,
      timeframe: row.timeframe as Timeframe,
      riskPct: Number(row.riskPct),
      maxPositionUsd: Number(row.maxPositionUsd),
      maxDailyLossUsd: Number(row.maxDailyLossUsd),
      leverage: row.leverage,
      liveEnabled: row.liveEnabled,
      hasCredentials: Boolean(credential),
      keyHint: credential?.keyHint ?? null,
      lastRunAt: iso(row.lastRunAt),
      lastValidationAt: iso(row.lastValidationAt),
    };
  });
}

function toValidationDto(row: typeof validationRuns.$inferSelect): ValidationDto {
  return {
    id: row.id,
    market: row.market,
    symbol: row.symbol,
    timeframe: row.timeframe as Timeframe,
    strategyId: row.strategyId,
    strategyName: STRATEGIES.find((strategy) => strategy.id === row.strategyId)?.name ?? row.strategyId,
    eligible: row.eligible,
    reason: row.reason,
    closedTrades: row.closedTrades,
    netR: Number(row.netR),
    winRate: Number(row.winRate),
    profitFactor: row.profitFactor === null ? null : Number(row.profitFactor),
    folds: row.folds as ValidationFoldDto[],
    createdAt: row.createdAt.toISOString(),
  };
}

function toCoinRankingDto(row: typeof coinRankings.$inferSelect): CoinRankingDto {
  return {
    market: row.market,
    symbol: row.symbol,
    rank: row.rank,
    score: Number(row.score),
    momentum7dPct: Number(row.momentum7dPct),
    momentum30dPct: Number(row.momentum30dPct),
    relativeStrength7dPct: Number(row.relativeStrength7dPct),
    dailyVolatilityPct: Number(row.dailyVolatilityPct),
    averageDollarVolume: Number(row.averageDollarVolume),
    regime: row.regime as CoinRankingDto["regime"],
    liquid: row.liquid,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPositionDto(row: Position): PositionDto {
  return {
    id: row.id,
    market: row.market,
    symbol: row.symbol,
    side: row.side,
    strategyId: row.strategyId,
    quantity: row.quantity,
    entryPrice: row.entryPrice,
    stopPrice: row.stopPrice,
    targetPrice: row.targetPrice,
    exchangeProtectionActive: row.exchangeProtectionActive,
    status: row.status,
    realizedPnl: row.realizedPnl,
    openedAt: row.openedAt.toISOString(),
    closedAt: iso(row.closedAt),
  };
}

export async function getOverview(userId: number): Promise<BotOverviewDto> {
  const db = getDb();
  const [settings, credentials, validations, rankingRows, positionRows, orderRows, eventRows] = await Promise.all([
    ensureSettings(userId),
    db.select().from(apiCredentials).where(eq(apiCredentials.userId, userId)),
    db.select().from(validationRuns).where(eq(validationRuns.userId, userId)).orderBy(desc(validationRuns.createdAt)).limit(150),
    db.select().from(coinRankings).where(eq(coinRankings.userId, userId)).orderBy(desc(coinRankings.createdAt)).limit(120),
    db.select().from(positions).where(eq(positions.userId, userId)).orderBy(desc(positions.openedAt)).limit(50),
    db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50),
    db.select().from(botEvents).where(eq(botEvents.userId, userId)).orderBy(desc(botEvents.createdAt)).limit(50),
  ]);
  const latest = new Map<string, ValidationDto>();
  for (const row of validations) {
    const key = `${row.market}:${row.symbol}:${row.timeframe}`;
    if (!latest.has(key)) latest.set(key, toValidationDto(row));
  }
  const latestValidations = [...latest.values()];
  const settingDtos = toSettingsDto(settings, credentials);
  const recommendationValidations = latestValidations.filter((validation) =>
    Date.now() - Date.parse(validation.createdAt) <= 24 * 60 * 60 * 1000,
  );
  const latestRankingMap = new Map<string, CoinRankingDto>();
  for (const row of rankingRows) {
    const key = `${row.market}:${row.symbol}`;
    if (!latestRankingMap.has(key)) latestRankingMap.set(key, toCoinRankingDto(row));
  }
  const latestCoinRankings = [...latestRankingMap.values()].sort((a, b) => a.market.localeCompare(b.market) || a.rank - b.rank);
  const recommendations = settingDtos.map((setting) => {
    const rankings = latestCoinRankings.filter((ranking) =>
      ranking.market === setting.market && Date.now() - Date.parse(ranking.createdAt) <= 24 * 60 * 60 * 1000,
    );
    return rankings.length
      ? selectCoinRecommendation({ market: setting.market, rankings, validations: recommendationValidations })
      : selectTimeframeRecommendation({ market: setting.market, symbol: setting.symbol, validations: recommendationValidations });
  });
  return {
    settings: settingDtos,
    latestValidations,
    recommendations,
    coinRankings: latestCoinRankings,
    positions: positionRows.map(toPositionDto),
    orders: orderRows.map((row) => ({
      id: row.id,
      market: row.market,
      symbol: row.symbol,
      side: row.side,
      purpose: row.purpose,
      strategyId: row.strategyId,
      clientOid: row.clientOid,
      exchangeOrderId: row.exchangeOrderId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    events: eventRows.map((row) => ({
      id: row.id,
      market: row.market,
      level: row.level,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    })),
    scheduler: { running: getSchedulerStatus().running, intervalSeconds: 60, liveOrderExecution: true },
  };
}

export async function saveSettings(
  userId: number,
  input: {
    market: Market;
    symbol: string;
    timeframe: Timeframe;
    riskPct: number;
    maxPositionUsd: number;
    maxDailyLossUsd: number;
    leverage: number;
  },
) {
  await ensureSettings(userId);
  await getDb().update(botSettings).set({
    symbol: input.symbol,
    timeframe: input.timeframe,
    riskPct: input.riskPct.toFixed(3),
    maxPositionUsd: input.maxPositionUsd.toFixed(2),
    maxDailyLossUsd: input.maxDailyLossUsd.toFixed(2),
    leverage: input.market === "spot" ? 1 : input.leverage,
    liveEnabled: false,
  }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, input.market)));
  await recordEvent(userId, input.market, "info", "Konfiguration gespeichert; Live-Modus zur Sicherheit deaktiviert.");
}

export async function saveCredentials(
  userId: number,
  market: Market,
  input: { key: string; secret: string; passphrase: string; keyVersion: string },
) {
  const credentials: KucoinCredentials = { ...input };
  try {
    await testCredentials(market, credentials);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} Zugangsdaten wurden nicht gespeichert; es wurde keine Order gesendet.`);
  }
  const db = getDb();
  await db.insert(apiCredentials).values({
    userId,
    market,
    encryptedKey: encryptSecret(input.key),
    encryptedSecret: encryptSecret(input.secret),
    encryptedPassphrase: encryptSecret(input.passphrase),
    keyVersion: input.keyVersion,
    keyHint: maskApiKey(input.key),
  }).onDuplicateKeyUpdate({
    set: {
      encryptedKey: encryptSecret(input.key),
      encryptedSecret: encryptSecret(input.secret),
      encryptedPassphrase: encryptSecret(input.passphrase),
      keyVersion: input.keyVersion,
      keyHint: maskApiKey(input.key),
    },
  });
  await db.update(botSettings).set({ liveEnabled: false }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, market)));
  await recordEvent(userId, market, "success", "KuCoin-Zugang verschlüsselt gespeichert und lese-seitig geprüft; keine Order gesendet.");
}

export async function removeCredentials(userId: number, market: Market) {
  const db = getDb();
  await db.delete(apiCredentials).where(and(eq(apiCredentials.userId, userId), eq(apiCredentials.market, market)));
  await db.update(botSettings).set({ liveEnabled: false }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, market)));
  await recordEvent(userId, market, "warn", "Zugangsdaten gelöscht und Live-Modus deaktiviert.");
}

async function readCredentials(userId: number, market: Market) {
  const row = await getDb().query.apiCredentials.findFirst({
    where: and(eq(apiCredentials.userId, userId), eq(apiCredentials.market, market)),
  });
  if (!row) return null;
  return {
    key: decryptSecret(row.encryptedKey),
    secret: decryptSecret(row.encryptedSecret),
    passphrase: decryptSecret(row.encryptedPassphrase),
    keyVersion: row.keyVersion,
  } satisfies KucoinCredentials;
}

async function latestValidation(userId: number, market: Market, symbol?: string, timeframe?: Timeframe) {
  const conditions = [eq(validationRuns.userId, userId), eq(validationRuns.market, market)];
  if (symbol) conditions.push(eq(validationRuns.symbol, symbol));
  if (timeframe) conditions.push(eq(validationRuns.timeframe, timeframe));
  return getDb().query.validationRuns.findFirst({ where: and(...conditions), orderBy: desc(validationRuns.createdAt) });
}

async function runTimeframeValidation(
  userId: number,
  market: Market,
  symbol: string,
  timeframe: Timeframe,
): Promise<ValidationDto> {
  const candles = (await getKlines(market, symbol, timeframe, 520)).filter((candle) => isClosedCandle(candle, timeframe));
  const result = runWalkForward(candles, market, timeframe);
  const db = getDb();
  const [inserted] = await db.insert(validationRuns).values({
    userId,
    market,
    symbol,
    timeframe,
    strategyId: result.strategyId,
    eligible: result.eligible,
    reason: result.reason,
    netR: result.netR.toFixed(6),
    closedTrades: result.closedTrades,
    winRate: result.winRate.toFixed(4),
    profitFactor: result.profitFactor === null ? null : result.profitFactor.toFixed(6),
    folds: result.folds,
  }).$returningId();
  const row = await db.query.validationRuns.findFirst({ where: eq(validationRuns.id, inserted.id) });
  if (!row) throw new Error(`Validierung ${timeframe} konnte nicht gelesen werden`);
  const dto = toValidationDto(row);
  dto.strategyName = result.strategyName;
  return dto;
}

async function settledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

async function runCoinResearch(userId: number, market: Market, configuredSymbol: string) {
  const directory = await getCoinDirectory(market);
  if (directory.source === "fallback") {
    throw new Error(directory.warning ?? "KuCoin-Top-50-Liste ist nicht erreichbar");
  }
  const symbols = coinUniverse(market, configuredSymbol, directory.coins.map((coin) => coin.symbol));
  const settled = await settledWithConcurrency(symbols, 4, async (symbol) => {
    const [candles, rules] = await Promise.all([
      getKlines(market, symbol, "4h", 200),
      getInstrumentRules(market, symbol),
    ]);
    return {
      symbol,
      candles: candles.filter((candle) => isClosedCandle(candle, "4h")),
      multiplier: market === "futures" ? rules.multiplier : 1,
    };
  });
  const marketData = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failedSymbols = symbols.filter((_, index) => settled[index].status === "rejected");
  if (!marketData.length) {
    const reason = settled.find((result) => result.status === "rejected");
    throw new Error(`Coin-Recherche fehlgeschlagen: ${reason?.status === "rejected" ? String(reason.reason) : "Keine KuCoin-Daten"}`);
  }
  const rankings = rankCoinMarketData(market, marketData, market === "spot" ? "BTC-USDT" : "XBTUSDTM");
  const db = getDb();
  await db.insert(coinRankings).values(rankings.map((ranking) => ({
    userId,
    market,
    symbol: ranking.symbol,
    rank: ranking.rank,
    score: ranking.score.toFixed(6),
    momentum7dPct: ranking.momentum7dPct.toFixed(6),
    momentum30dPct: ranking.momentum30dPct.toFixed(6),
    relativeStrength7dPct: ranking.relativeStrength7dPct.toFixed(6),
    dailyVolatilityPct: ranking.dailyVolatilityPct.toFixed(6),
    averageDollarVolume: ranking.averageDollarVolume.toFixed(6),
    regime: ranking.regime,
    liquid: ranking.liquid,
    reason: ranking.reason,
  })));
  return { rankings, failedSymbols };
}

export async function runValidation(userId: number, market: Market): Promise<RecommendationDto> {
  const settings = (await ensureSettings(userId)).find((row) => row.market === market);
  if (!settings) throw new Error("Bot-Konfiguration fehlt");
  const research = await runCoinResearch(userId, market, settings.symbol);
  const symbols = preferredValidationSymbols(research.rankings);
  if (!symbols.length) throw new Error("Kein Coin erfüllt aktuell Historie- und Liquiditätsanforderungen");
  const jobs = symbols.flatMap((symbol) => TIMEFRAMES.map((timeframe) => ({ symbol, timeframe })));
  const settled = await settledWithConcurrency(jobs, 3, (job) =>
    runTimeframeValidation(userId, market, job.symbol, job.timeframe),
  );
  const validations: ValidationDto[] = [];
  const failedTimeframes = new Set<Timeframe>();
  const failedSymbols = new Set(research.failedSymbols);
  const errors: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") validations.push(result.value);
    else {
      failedTimeframes.add(jobs[index].timeframe);
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  });
  for (const symbol of symbols) {
    if (!validations.some((validation) => validation.symbol === symbol)) failedSymbols.add(symbol);
  }
  if (!validations.length) throw new Error(`Walk-Forward fehlgeschlagen: ${errors[0] ?? "Keine KuCoin-Daten"}`);
  await getDb().update(botSettings).set({ lastValidationAt: new Date() }).where(eq(botSettings.id, settings.id));
  const recommendation = selectCoinRecommendation({
    market,
    rankings: research.rankings,
    validations,
    failedSymbols: [...failedSymbols],
    failedTimeframes: [...failedTimeframes],
  });
  const failureNote = failedTimeframes.size ? ` Nicht vollständig geprüft: ${[...failedTimeframes].join(", ")}.` : "";
  await recordEvent(
    userId,
    market,
    recommendation.eligible ? "success" : "warn",
    `Coin-/Strategieempfehlung ${recommendation.symbol}: ${recommendation.eligible ? `${recommendation.strategyName} auf ${recommendation.timeframe}` : "keine Handelsfreigabe"}.${failureNote}`,
  );
  return recommendation;
}

export async function setLiveEnabled(userId: number, market: Market, enabled: boolean) {
  const settings = (await ensureSettings(userId)).find((row) => row.market === market);
  if (!settings) throw new Error("Bot-Konfiguration fehlt");
  if (enabled) {
    if (!(await readCredentials(userId, market))) throw new Error("Zuerst KuCoin-Zugangsdaten speichern und prüfen");
    const validation = await latestValidation(userId, market, settings.symbol, settings.timeframe as Timeframe);
    if (!validation || !validation.eligible) throw new Error("Eine aktuelle, freigegebene Walk-Forward-Validierung ist erforderlich");
    if (Date.now() - validation.createdAt.getTime() > 24 * 60 * 60 * 1000) throw new Error("Die Walk-Forward-Validierung ist älter als 24 Stunden");
  }
  await getDb().update(botSettings).set({ liveEnabled: enabled }).where(eq(botSettings.id, settings.id));
  await recordEvent(userId, market, enabled ? "warn" : "info", enabled ? "ECHTER Handel armiert. Market-Orders sind ab dem nächsten frischen Signal möglich." : "Live-Modus deaktiviert; offene Positionen werden weiter überwacht.");
}

async function waitForFill(market: Market, orderId: string, credentials: KucoinCredentials) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(700);
    const fill = await getOrderFill(market, orderId, credentials);
    if (fill.status !== "open") return fill;
  }
  return getOrderFill(market, orderId, credentials);
}

async function reconcilePositions(userId: number, market: Market, credentials: KucoinCredentials) {
  const db = getDb();
  const active = await db.select().from(positions).where(and(
    eq(positions.userId, userId),
    eq(positions.market, market),
    inArray(positions.status, ["pending", "closing"]),
  ));
  for (const position of active) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.positionId, position.id), eq(orders.purpose, position.status === "pending" ? "entry" : "exit")),
      orderBy: desc(orders.createdAt),
    });
    if (!order?.exchangeOrderId) continue;
    const fill = await getOrderFill(market, order.exchangeOrderId, credentials);
    if (fill.status === "open") continue;
    if (fill.status === "cancelled") {
      await db.update(orders).set({ status: "cancelled", responseText: JSON.stringify(fill.raw).slice(0, 2000) }).where(eq(orders.id, order.id));
      await db.update(positions).set({ status: "error" }).where(eq(positions.id, position.id));
      await getDb().update(botSettings).set({ liveEnabled: false }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, market)));
      await recordEvent(userId, market, "error", `Order ${order.clientOid} wurde storniert; manuelle Prüfung erforderlich.`);
      continue;
    }
    const fillPrice = fill.averagePrice ?? Number(order.price ?? position.entryPrice);
    if (position.status === "pending") {
      await db.update(positions).set({
        status: "open",
        entryPrice: String(fillPrice),
        quantity: fill.quantity === null ? position.quantity : String(fill.quantity),
        exchangeOrderId: order.exchangeOrderId,
        exchangeProtectionActive: market === "futures",
      }).where(eq(positions.id, position.id));
    } else {
      const rules = await getInstrumentRules(market, position.symbol);
      const pnl = estimateRealizedPnl({
        market,
        side: position.side,
        quantity: fill.quantity ?? Number(position.quantity),
        entryPrice: Number(position.entryPrice),
        exitPrice: fillPrice,
        multiplier: rules.multiplier,
      });
      await db.update(positions).set({ status: "closed", realizedPnl: String(pnl), exchangeProtectionActive: false, closedAt: new Date() }).where(eq(positions.id, position.id));
    }
    await db.update(orders).set({ status: "filled", responseText: JSON.stringify(fill.raw).slice(0, 2000) }).where(eq(orders.id, order.id));
    await recordEvent(userId, market, "success", `${position.status === "pending" ? "Einstieg" : "Ausstieg"} für ${position.symbol} bestätigt.`);
  }
}

async function closePosition(
  userId: number,
  position: Position,
  credentials: KucoinCredentials,
  estimatedExit: number,
  reason: string,
) {
  const db = getDb();
  const fresh = await db.query.positions.findFirst({ where: eq(positions.id, position.id) });
  if (!fresh || fresh.status !== "open") return false;
  await db.update(positions).set({ status: "closing" }).where(eq(positions.id, position.id));
  const side = fresh.side === "buy" ? "sell" : "buy";
  const clientOid = `wf-exit-${fresh.id}-${Date.now()}`;
  const [order] = await db.insert(orders).values({
    userId,
    positionId: fresh.id,
    market: fresh.market,
    symbol: fresh.symbol,
    side,
    purpose: "exit",
    strategyId: fresh.strategyId,
    clientOid,
    quantity: fresh.quantity,
    price: String(estimatedExit),
    status: "accepted",
  }).$returningId();
  try {
    const response = await placeMarketOrder({
      market: fresh.market,
      symbol: fresh.symbol,
      side,
      credentials,
      clientOid,
      quantity: fresh.quantity,
      reduceOnly: fresh.market === "futures",
    });
    await db.update(orders).set({ exchangeOrderId: response.orderId, responseText: JSON.stringify(response).slice(0, 2000) }).where(eq(orders.id, order.id));
    const fill = await waitForFill(fresh.market, response.orderId, credentials);
    if (fill.status === "filled") {
      const exitPrice = fill.averagePrice ?? estimatedExit;
      const rules = await getInstrumentRules(fresh.market, fresh.symbol);
      const pnl = estimateRealizedPnl({
        market: fresh.market,
        side: fresh.side,
        quantity: fill.quantity ?? Number(fresh.quantity),
        entryPrice: Number(fresh.entryPrice),
        exitPrice,
        multiplier: rules.multiplier,
      });
      await db.update(positions).set({ status: "closed", realizedPnl: String(pnl), exchangeProtectionActive: false, closedAt: new Date() }).where(eq(positions.id, fresh.id));
      await db.update(orders).set({ status: "filled", responseText: JSON.stringify(fill.raw).slice(0, 2000) }).where(eq(orders.id, order.id));
      await recordEvent(userId, fresh.market, pnl >= 0 ? "success" : "warn", `${fresh.symbol}: ${reason}; geschätzter PnL ${pnl.toFixed(2)} USDT.`);
    } else if (fill.status === "cancelled") {
      await db.update(positions).set({ status: "error" }).where(eq(positions.id, fresh.id));
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
      await recordEvent(userId, fresh.market, "error", `${fresh.symbol}: Exit-Order storniert; Position manuell prüfen.`);
    } else {
      await recordEvent(userId, fresh.market, "info", `${fresh.symbol}: Exit-Order angenommen, Fill wird weiter geprüft.`);
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(orders).set({ status: "error", responseText: message.slice(0, 2000) }).where(eq(orders.id, order.id));
    await db.update(botSettings).set({ liveEnabled: false }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, fresh.market)));
    await recordEvent(userId, fresh.market, "error", `Exitfehler ${fresh.symbol}: ${message}. Live-Modus deaktiviert; keine automatische Wiederholung bei unklarem Orderstatus.`);
    return true;
  }
}

async function monitorOpenPositions(userId: number, market: Market, timeframe: Timeframe, credentials: KucoinCredentials) {
  const open = await getDb().select().from(positions).where(and(
    eq(positions.userId, userId),
    eq(positions.market, market),
    eq(positions.status, "open"),
  ));
  let acted = false;
  for (const position of open) {
    if (market === "futures" && position.exchangeProtectionActive) {
      if (!(await hasOpenFuturesPosition(position.symbol, credentials))) {
        await getDb().update(positions).set({ status: "closed", realizedPnl: null, exchangeProtectionActive: false, closedAt: new Date() }).where(eq(positions.id, position.id));
        await getDb().update(botSettings).set({ liveEnabled: false }).where(and(eq(botSettings.userId, userId), eq(botSettings.market, market)));
        await recordEvent(userId, market, "warn", `${position.symbol}: KuCoin-Position geschlossen; realisierten PnL bitte im KuCoin-Konto prüfen, bevor erneut armiert wird.`);
        acted = true;
        continue;
      }
      if (Date.now() - position.openedAt.getTime() >= 50 * timeframeSeconds(timeframe) * 1000) {
        const candles = await getKlines(market, position.symbol, timeframe, 2);
        const current = candles[candles.length - 1];
        if (current) acted = await closePosition(userId, position, credentials, current.close, "Zeitexit") || acted;
      }
      continue;
    }
    const candles = await getKlines(market, position.symbol, timeframe, 80);
    const current = candles[candles.length - 1];
    if (!current) continue;
    let exit: number | null = null;
    let reason = "";
    const stop = Number(position.stopPrice);
    const target = Number(position.targetPrice);
    if (position.side === "buy") {
      if (current.low <= stop) { exit = Math.min(stop, current.open); reason = "Stop-Loss"; }
      else if (current.high >= target) { exit = Math.max(target, current.open); reason = "TP2"; }
    } else {
      if (current.high >= stop) { exit = Math.max(stop, current.open); reason = "Stop-Loss"; }
      else if (current.low <= target) { exit = Math.min(target, current.open); reason = "TP2"; }
    }
    if (exit === null && Date.now() - position.openedAt.getTime() >= 50 * timeframeSeconds(timeframe) * 1000) {
      exit = current.close;
      reason = "Zeitexit";
    }
    if (exit !== null) acted = await closePosition(userId, position, credentials, exit, reason) || acted;
  }
  return acted;
}

async function dailyLossExceeded(userId: number, market: Market, limit: number) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const closed = await getDb().select().from(positions).where(and(
    eq(positions.userId, userId),
    eq(positions.market, market),
    eq(positions.status, "closed"),
    gte(positions.closedAt, day),
  ));
  const pnl = closed.reduce((sum, position) => sum + Number(position.realizedPnl ?? 0), 0);
  return pnl <= -Math.abs(limit);
}

async function enterPosition(
  userId: number,
  settings: typeof botSettings.$inferSelect,
  validation: typeof validationRuns.$inferSelect,
  credentials: KucoinCredentials,
) {
  const market = settings.market;
  const timeframe = settings.timeframe as Timeframe;
  const candles = await getKlines(market, settings.symbol, timeframe, 260);
  const evaluation = evaluateLatestActionableSignal({ candles, strategyId: validation.strategyId, market, timeframe });
  const signal = evaluation.signal;
  if (!signal) {
    if (evaluation.candleTime !== null) {
      const candleStart = new Date(evaluation.candleTime * 1000);
      const marker = `Signalprüfung ${settings.symbol}/${timeframe} (${candleStart.toISOString()})`;
      const priorEvents = await getDb().select({ message: botEvents.message }).from(botEvents).where(and(
        eq(botEvents.userId, userId),
        eq(botEvents.market, market),
        gte(botEvents.createdAt, candleStart),
      )).orderBy(desc(botEvents.createdAt)).limit(30);
      if (!priorEvents.some((event) => event.message.startsWith(marker))) {
        await recordEvent(userId, market, "info", `${marker}: kein Einstieg — ${evaluation.reason}`);
      }
    }
    return;
  }
  const clientOid = `wf-${userId}-${market}-${signal.clientOidSeed}`;
  const duplicate = await getDb().query.orders.findFirst({ where: eq(orders.clientOid, clientOid) });
  if (duplicate) return;

  const [equity, rules] = await Promise.all([
    getAvailableEquity(market, credentials),
    getInstrumentRules(market, settings.symbol),
  ]);
  const size = calculatePositionSize({
    market,
    equity,
    riskPct: Number(settings.riskPct) * signal.execution.volatilityScale,
    maxPositionUsd: Number(settings.maxPositionUsd),
    leverage: settings.leverage,
    entryPrice: signal.entryPrice,
    stopPrice: signal.stopPrice,
    rules,
  });
  const db = getDb();
  let positionId = 0;
  await db.transaction(async (tx) => {
    const [position] = await tx.insert(positions).values({
      userId,
      market,
      symbol: settings.symbol,
      side: signal.side,
      strategyId: validation.strategyId,
      quantity: size.quantityText,
      entryPrice: String(signal.entryPrice),
      stopPrice: String(signal.stopPrice),
      targetPrice: String(signal.targetPrice),
      status: "pending",
      clientOid,
      openedAt: new Date(),
    }).$returningId();
    positionId = position.id;
    await tx.insert(orders).values({
      userId,
      positionId,
      market,
      symbol: settings.symbol,
      side: signal.side,
      purpose: "entry",
      strategyId: validation.strategyId,
      clientOid,
      quantity: size.quantityText,
      price: String(signal.entryPrice),
      status: "accepted",
      signalTime: new Date(signal.signalTime * 1000),
    });
  });

  try {
    const response = await placeMarketOrder({
      market,
      symbol: settings.symbol,
      side: signal.side,
      credentials,
      clientOid,
      quantity: size.quantityText,
      leverage: settings.leverage,
      stopPrice: market === "futures" ? String(signal.stopPrice) : undefined,
      targetPrice: market === "futures" ? String(signal.targetPrice) : undefined,
    });
    await db.update(orders).set({ exchangeOrderId: response.orderId, responseText: JSON.stringify(response).slice(0, 2000) }).where(eq(orders.clientOid, clientOid));
    const fill = await waitForFill(market, response.orderId, credentials);
    if (fill.status === "filled") {
      await db.update(positions).set({
        status: "open",
        entryPrice: String(fill.averagePrice ?? signal.entryPrice),
        quantity: fill.quantity === null ? size.quantityText : String(fill.quantity),
        exchangeOrderId: response.orderId,
        exchangeProtectionActive: market === "futures",
      }).where(eq(positions.id, positionId));
      await db.update(orders).set({ status: "filled", responseText: JSON.stringify(fill.raw).slice(0, 2000) }).where(eq(orders.clientOid, clientOid));
      await recordEvent(userId, market, "success", `${settings.symbol}: ${signal.side.toUpperCase()} ${size.quantityText}, ${validation.strategyId}; Volatilitätsfaktor ${signal.execution.volatilityScale.toFixed(2)}; Fill bestätigt.`);
      if (market === "futures") await recordEvent(userId, market, "success", `${settings.symbol}: Stop-Loss und Take-Profit mit Mark-Preis-Trigger an die KuCoin-Futures-Einstiegsorder angehängt.`);
    } else if (fill.status === "cancelled") {
      await db.update(positions).set({ status: "error" }).where(eq(positions.id, positionId));
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.clientOid, clientOid));
      await recordEvent(userId, market, "error", `${settings.symbol}: Einstieg storniert; manuelle Prüfung erforderlich.`);
    } else {
      await recordEvent(userId, market, "info", `${settings.symbol}: Entry-Order angenommen; Fill wird weiter geprüft.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(orders).set({ status: "error", responseText: message.slice(0, 2000) }).where(eq(orders.clientOid, clientOid));
    await db.update(botSettings).set({ liveEnabled: false }).where(eq(botSettings.id, settings.id));
    await recordEvent(userId, market, "error", `Entryfehler ${settings.symbol}: ${message}. Live-Modus deaktiviert; pending Position blockiert weitere Entries.`);
  }
}

export async function runMarketForUser(userId: number, market: Market) {
  const key = keyFor(userId, market);
  if (runningMarkets.has(key)) return "Lauf übersprungen: vorheriger Lauf noch aktiv";
  runningMarkets.add(key);
  try {
    const settings = (await ensureSettings(userId)).find((row) => row.market === market);
    if (!settings) return "Keine Konfiguration";
    const credentials = await readCredentials(userId, market);
    if (!credentials) {
      if (settings.liveEnabled) {
        await getDb().update(botSettings).set({ liveEnabled: false }).where(eq(botSettings.id, settings.id));
        await recordEvent(userId, market, "error", "Live-Modus deaktiviert: Zugangsdaten fehlen.");
      }
      return "Keine Zugangsdaten";
    }
    await reconcilePositions(userId, market, credentials);
    const exited = await monitorOpenPositions(userId, market, settings.timeframe as Timeframe, credentials);
    await getDb().update(botSettings).set({ lastRunAt: new Date() }).where(eq(botSettings.id, settings.id));
    if (exited) return "Exit verarbeitet";
    if (!settings.liveEnabled) return "Überwachung aktiv; neue Entries deaktiviert";
    if (await dailyLossExceeded(userId, market, Number(settings.maxDailyLossUsd))) {
      await getDb().update(botSettings).set({ liveEnabled: false }).where(eq(botSettings.id, settings.id));
      await recordEvent(userId, market, "error", "Intern geschätztes Tagesverlustlimit erreicht; Live-Modus deaktiviert.");
      return "Tagesverlustlimit erreicht";
    }
    const active = await getDb().query.positions.findFirst({ where: and(
      eq(positions.userId, userId),
      eq(positions.market, market),
      inArray(positions.status, ["pending", "open", "closing"]),
    ) });
    if (active) return "Bestehende Position; kein neuer Entry";

    let validation = await latestValidation(userId, market, settings.symbol, settings.timeframe as Timeframe);
    if (!validation || Date.now() - validation.createdAt.getTime() > VALIDATION_MAX_AGE_MS) {
      const recommendation = await runValidation(userId, market);
      if (recommendation.symbol !== settings.symbol || recommendation.timeframe !== settings.timeframe) {
        await recordEvent(userId, market, "warn", `Entry pausiert: Neue Empfehlung ${recommendation.symbol} / ${recommendation.timeframe ?? "keine"} weicht von der Konfiguration ${settings.symbol} / ${settings.timeframe} ab. Live-Freigabe bleibt aktiv; keine automatische Umstellung.`);
        return "Entry pausiert; Live-Freigabe bleibt aktiv, bis eine passende Freigabe vorliegt";
      }
      validation = await latestValidation(userId, market, settings.symbol, settings.timeframe as Timeframe);
      if (!validation || Date.now() - validation.createdAt.getTime() > VALIDATION_MAX_AGE_MS) {
        throw new Error(`Validierung für ${settings.timeframe} konnte nicht aktualisiert werden`);
      }
    }
    if (!validation.eligible) {
      await getDb().update(botSettings).set({ liveEnabled: false }).where(eq(botSettings.id, settings.id));
      await recordEvent(userId, market, "warn", "Live-Modus deaktiviert: aktuelle Walk-Forward-Strategie ist nicht freigegeben.");
      return "Keine freigegebene Strategie";
    }
    await enterPosition(userId, settings, validation, credentials);
    return "Lauf abgeschlossen";
  } finally {
    runningMarkets.delete(key);
  }
}

export async function emergencyStop(userId: number) {
  const db = getDb();
  await db.update(botSettings).set({ liveEnabled: false }).where(eq(botSettings.userId, userId));
  const open = await db.select().from(positions).where(and(eq(positions.userId, userId), eq(positions.status, "open")));
  let initiated = 0;
  for (const position of open) {
    const credentials = await readCredentials(userId, position.market);
    if (!credentials) {
      await db.update(positions).set({ status: "error" }).where(eq(positions.id, position.id));
      await recordEvent(userId, position.market, "error", `${position.symbol}: Not-Stopp kann ohne Zugangsdaten keine Exit-Order senden.`);
      continue;
    }
    const candles = await getKlines(position.market, position.symbol, "5m", 80);
    const mark = candles[candles.length - 1]?.close ?? Number(position.entryPrice);
    if (await closePosition(userId, position, credentials, mark, "Not-Stopp")) initiated += 1;
  }
  await recordEvent(userId, "spot", "warn", `Globaler Not-Stopp ausgelöst; ${initiated} Exit-Vorgänge gestartet.`);
  return { exitsInitiated: initiated };
}

type SchedulerGlobal = { __realTradingScheduler?: { timer: NodeJS.Timeout; running: boolean } };
const schedulerGlobal = globalThis as SchedulerGlobal;

export function getSchedulerStatus() {
  return { running: schedulerGlobal.__realTradingScheduler?.running ?? false, intervalSeconds: 60 };
}

export function startScheduler() {
  if (schedulerGlobal.__realTradingScheduler) return;
  const state = { timer: undefined as unknown as NodeJS.Timeout, running: true };
  const tick = async () => {
    const db = getDb();
    const [settings, active] = await Promise.all([
      db.select().from(botSettings),
      db.select().from(positions).where(inArray(positions.status, ["pending", "open", "closing"])),
    ]);
    const activeKeys = new Set(active.map((position) => keyFor(position.userId, position.market)));
    for (const setting of settings) {
      if (!setting.liveEnabled && !activeKeys.has(keyFor(setting.userId, setting.market))) continue;
      try {
        await runMarketForUser(setting.userId, setting.market);
      } catch (error) {
        log.error("bot scheduler run failed", {
          userId: setting.userId,
          market: setting.market,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          await recordEvent(setting.userId, setting.market, "error", `Bot-Lauf fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        } catch { /* Database outage is already logged above. */ }
      }
    }
  };
  state.timer = setInterval(() => { void tick(); }, 60_000);
  state.timer.unref();
  schedulerGlobal.__realTradingScheduler = state;
  const initial = setTimeout(() => { void tick(); }, 10_000);
  initial.unref();
}
