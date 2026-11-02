import type { Market, Timeframe } from "@contracts/trading";
import { timeframeSeconds, type Candle } from "./kucoin";

export const EXECUTION_FILTER = {
  feePct: 0.1,
  slippagePct: 0.05,
  minNetTargetR: 0.5,
  minGrossToCostRatio: 1.5,
  maxDailyVolatilityPct: 180,
  targetDailyVolatilityPct: 80,
  minVolatilityScale: 0.25,
} as const;

export type EntryGateResult = {
  allowed: boolean;
  reasons: string[];
  grossTargetR: number;
  estimatedCostR: number;
  netTargetR: number;
  dailyVolatilityPct: number;
  volatilityScale: number;
  regime: "trend_up" | "trend_down" | "range" | "transition";
};

function returnsVolatility(candles: Candle[], timeframe: Timeframe) {
  const closes = candles.slice(-21).map((candle) => candle.close);
  if (closes.length < 3 || closes.some((close) => !(close > 0))) {
    return { dailyVolatilityPct: Number.POSITIVE_INFINITY, volatilityScale: EXECUTION_FILTER.minVolatilityScale };
  }
  const logReturns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const mean = logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, logReturns.length - 1);
  const barsPerDay = 86_400 / timeframeSeconds(timeframe);
  const dailyVolatilityPct = Math.sqrt(variance * barsPerDay) * 100;
  const volatilityScale = Math.min(1, Math.max(
    EXECUTION_FILTER.minVolatilityScale,
    EXECUTION_FILTER.targetDailyVolatilityPct / Math.max(1e-9, dailyVolatilityPct),
  ));
  return { dailyVolatilityPct, volatilityScale };
}

function ema(candles: Candle[], period: number) {
  if (candles.length < period) return null;
  const multiplier = 2 / (period + 1);
  let value = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  for (const candle of candles.slice(period)) value = candle.close * multiplier + value * (1 - multiplier);
  return value;
}

export function getMarketRegime(candles: Candle[]) {
  const fast = ema(candles, 50);
  const slow = ema(candles, 200);
  if (fast === null || slow === null) return "transition" as const;
  const distance = Math.abs(fast - slow) / Math.max(1e-9, slow);
  if (distance < 0.002) return "range" as const;
  return fast > slow ? "trend_up" as const : "trend_down" as const;
}

export function evaluateEntryGate(input: {
  candles: Candle[];
  market: Market;
  timeframe: Timeframe;
  strategyId: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  feePct?: number;
  slippagePct?: number;
}): EntryGateResult {
  const { candles, market, timeframe, strategyId, side, entryPrice, stopPrice, targetPrice } = input;
  const { dailyVolatilityPct, volatilityScale } = returnsVolatility(candles, timeframe);
  const regime = getMarketRegime(candles);
  const reasons: string[] = [];
  const direction = side === "BUY" ? 1 : -1;
  const risk = Math.abs(entryPrice - stopPrice);
  const grossTargetR = risk > 0 ? ((targetPrice - entryPrice) * direction) / risk : Number.NEGATIVE_INFINITY;
  const feePct = input.feePct ?? EXECUTION_FILTER.feePct;
  const slippagePct = input.slippagePct ?? EXECUTION_FILTER.slippagePct;
  const estimatedCostR = risk > 0
    ? (entryPrice * 2 * (feePct + slippagePct) / 100) / risk
    : Number.POSITIVE_INFINITY;
  const netTargetR = grossTargetR - estimatedCostR;

  if (![entryPrice, stopPrice, targetPrice, grossTargetR, estimatedCostR].every(Number.isFinite) || risk <= 0) {
    reasons.push("ungültige Entry-, Stop- oder Zielwerte");
  }
  if (market === "spot" && side === "SELL") reasons.push("Spot erlaubt nur Long-Entries");
  if (netTargetR < EXECUTION_FILTER.minNetTargetR) {
    reasons.push(`No-Trade-Zone: Ziel nach geschätzten Kosten nur ${netTargetR.toFixed(2)}R statt mindestens ${EXECUTION_FILTER.minNetTargetR.toFixed(2)}R`);
  }
  if (grossTargetR < estimatedCostR * EXECUTION_FILTER.minGrossToCostRatio) {
    reasons.push("Bruttoziel steht in keinem ausreichenden Verhältnis zu den geschätzten Handelskosten");
  }
  if (dailyVolatilityPct > EXECUTION_FILTER.maxDailyVolatilityPct) {
    reasons.push(`Extremvolatilität: ${dailyVolatilityPct.toFixed(0)} % pro Tag; keine neuen Entries`);
  }
  if (strategyId === "trend_pullback") {
    if (regime === "transition") reasons.push("Trendregime benötigt mindestens 200 geschlossene Kerzen");
    if (side === "BUY" && regime !== "trend_up") reasons.push("EMA Golden Pullback: kein bestätigtes Aufwärtsregime");
    if (side === "SELL" && regime !== "trend_down") reasons.push("EMA Golden Pullback: kein bestätigtes Abwärtsregime");
  }

  if (strategyId === "donchian_trend") {
    if (regime === "transition") reasons.push("Donchian Trendfolge: Trendregime nicht bestätigt");
    if (side === "BUY" && regime !== "trend_up") reasons.push("Donchian Trendfolge: Long-Ausbruch gegen das EMA-Regime");
    if (side === "SELL" && regime !== "trend_down") reasons.push("Donchian Trendfolge: Short-Ausbruch gegen das EMA-Regime");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    grossTargetR,
    estimatedCostR,
    netTargetR,
    dailyVolatilityPct,
    volatilityScale,
    regime,
  };
}
