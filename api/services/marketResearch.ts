import type { CoinOptionDto, CoinRankingDto, Market } from "@contracts/trading";
import { COIN_UNIVERSE } from "@contracts/trading";
import { getMarketRegime } from "./executionFilter";
import type { Candle } from "./kucoin";

export const MIN_AVERAGE_DOLLAR_VOLUME = 250_000;
export const VALIDATED_COIN_COUNT = 2;
export const TOP_COIN_COUNT = 50;

export type VolumeCoinInput = {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  volume24hUsd: number;
};

export function selectTopVolumeCoins(
  market: Market,
  inputs: VolumeCoinInput[],
  limit = TOP_COIN_COUNT,
): CoinOptionDto[] {
  const maximum = Math.max(1, Math.min(TOP_COIN_COUNT, Math.floor(limit)));
  return inputs
    .filter((coin) => coin.quoteCurrency === "USDT" && coin.symbol && Number.isFinite(coin.volume24hUsd) && coin.volume24hUsd > 0)
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd || a.symbol.localeCompare(b.symbol))
    .slice(0, maximum)
    .map((coin, index) => ({
      market,
      symbol: coin.symbol,
      baseCurrency: coin.baseCurrency || coin.symbol.split("-")[0].replace(/USDTM?$/, ""),
      volume24hUsd: coin.volume24hUsd,
      rank: index + 1,
    }));
}

export type CoinMarketData = {
  symbol: string;
  candles: Candle[];
  multiplier: number;
};

export function coinUniverse(
  market: Market,
  configuredSymbol: string,
  topVolumeSymbols: string[] = COIN_UNIVERSE[market],
) {
  return [...new Set([...topVolumeSymbols.slice(0, TOP_COIN_COUNT), configuredSymbol])];
}

function percentReturn(candles: Candle[], lookback: number) {
  if (candles.length <= lookback) return Number.NEGATIVE_INFINITY;
  const current = candles[candles.length - 1].close;
  const previous = candles[candles.length - 1 - lookback].close;
  return previous > 0 ? (current / previous - 1) * 100 : Number.NEGATIVE_INFINITY;
}

function realizedDailyVolatility(candles: Candle[]) {
  const closes = candles.slice(-43).map((candle) => candle.close);
  if (closes.length < 3 || closes.some((close) => !(close > 0))) return Number.POSITIVE_INFINITY;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  // The ranking uses 4h candles, hence six observations per day.
  return Math.sqrt(variance * 6) * 100;
}

function averageDollarVolume(input: CoinMarketData) {
  const candles = input.candles.slice(-42);
  if (!candles.length) return 0;
  return candles.reduce((sum, candle) => sum + candle.close * candle.volume * input.multiplier, 0) / candles.length;
}

export function rankCoinMarketData(
  market: Market,
  inputs: CoinMarketData[],
  benchmarkSymbol: string,
  createdAt = new Date(),
): CoinRankingDto[] {
  const benchmark = inputs.find((input) => input.symbol === benchmarkSymbol);
  const rawBenchmarkMomentum7d = benchmark ? percentReturn(benchmark.candles, 42) : 0;
  const benchmarkMomentum7d = Number.isFinite(rawBenchmarkMomentum7d) ? rawBenchmarkMomentum7d : 0;
  const ranked = inputs.map((input): Omit<CoinRankingDto, "rank"> => {
    const candles = [...input.candles].sort((a, b) => a.time - b.time);
    const normalized = { ...input, candles };
    const momentum7dPct = percentReturn(candles, 42);
    const momentum30dPct = percentReturn(candles, 180);
    const relativeStrength7dPct = momentum7dPct - benchmarkMomentum7d;
    const dailyVolatilityPct = realizedDailyVolatility(candles);
    const volume = averageDollarVolume(normalized);
    const enoughHistory = [momentum7dPct, momentum30dPct, relativeStrength7dPct, dailyVolatilityPct].every(Number.isFinite);
    const liquid = enoughHistory && volume >= MIN_AVERAGE_DOLLAR_VOLUME;
    const score = enoughHistory
      ? momentum7dPct * 0.45 + momentum30dPct * 0.30 + relativeStrength7dPct * 0.25
      : -999_999;
    return {
      market,
      symbol: input.symbol,
      score,
      momentum7dPct: enoughHistory ? momentum7dPct : 0,
      momentum30dPct: enoughHistory ? momentum30dPct : 0,
      relativeStrength7dPct: enoughHistory ? relativeStrength7dPct : 0,
      dailyVolatilityPct: enoughHistory ? dailyVolatilityPct : 0,
      averageDollarVolume: volume,
      regime: getMarketRegime(candles),
      liquid,
      reason: !enoughHistory
        ? "Mindestens 181 geschlossene 4h-Kerzen erforderlich"
        : !liquid
          ? `Unter dem Liquiditätsfilter von ${MIN_AVERAGE_DOLLAR_VOLUME.toLocaleString("de-DE")} USDT je 4h im Mittel`
          : "Im liquiden Momentum-Vergleich zugelassen",
      createdAt: createdAt.toISOString(),
    };
  }).sort((a, b) => {
    if (a.liquid !== b.liquid) return a.liquid ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.symbol.localeCompare(b.symbol);
  });
  return ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function preferredValidationSymbols(rankings: CoinRankingDto[]) {
  return rankings.filter((entry) => entry.liquid).slice(0, VALIDATED_COIN_COUNT).map((entry) => entry.symbol);
}
