import { describe, expect, it } from "vitest";
import { coinUniverse, preferredValidationSymbols, rankCoinMarketData, selectTopVolumeCoins, type CoinMarketData } from "./marketResearch";
import type { Candle } from "./kucoin";

function marketData(symbol: string, growthPerBar: number, volume = 10_000): CoinMarketData {
  const candles: Candle[] = [];
  let price = 100;
  for (let index = 0; index < 190; index += 1) {
    const open = price;
    const close = open * (1 + growthPerBar + (index % 2 ? 0.0002 : -0.0002));
    candles.push({ time: 1_760_000_000 + index * 14_400, open, high: Math.max(open, close) * 1.001, low: Math.min(open, close) * 0.999, close, volume });
    price = close;
  }
  return { symbol, candles, multiplier: 1 };
}

describe("KuCoin top-volume universe", () => {
  it("selects at most 50 positive-volume USDT markets in descending volume order", () => {
    const inputs = Array.from({ length: 55 }, (_, index) => ({
      symbol: `C${index}-USDT`,
      baseCurrency: `C${index}`,
      quoteCurrency: "USDT",
      volume24hUsd: (index + 1) * 1_000,
    }));
    inputs.push({ symbol: "BTC-EUR", baseCurrency: "BTC", quoteCurrency: "EUR", volume24hUsd: 999_999_999 });
    inputs.push({ symbol: "EMPTY-USDT", baseCurrency: "EMPTY", quoteCurrency: "USDT", volume24hUsd: 0 });
    const selected = selectTopVolumeCoins("spot", inputs);
    expect(selected).toHaveLength(50);
    expect(selected[0]).toMatchObject({ symbol: "C54-USDT", rank: 1 });
    expect(selected[49]).toMatchObject({ symbol: "C5-USDT", rank: 50 });
    expect(selected.some((coin) => coin.symbol === "BTC-EUR" || coin.symbol === "EMPTY-USDT")).toBe(false);
    expect(coinUniverse("spot", "C54-USDT", selected.map((coin) => coin.symbol))).toHaveLength(50);
  });
});

describe("cross-sectional coin research", () => {
  it("ranks stronger liquid coins before weaker ones and limits validation candidates", () => {
    const rankings = rankCoinMarketData("spot", [
      marketData("BTC-USDT", 0),
      marketData("ETH-USDT", 0.0004),
      marketData("SOL-USDT", 0.001),
      marketData("XRP-USDT", -0.0002),
    ], "BTC-USDT", new Date("2026-10-31T12:00:00Z"));
    expect(rankings[0].symbol).toBe("SOL-USDT");
    expect(rankings[0].relativeStrength7dPct).toBeGreaterThan(0);
    expect(preferredValidationSymbols(rankings)).toEqual(["SOL-USDT", "ETH-USDT"]);
  });

  it("excludes illiquid or insufficient coin histories from validation", () => {
    const illiquid = marketData("XRP-USDT", 0.01, 1);
    const insufficient = { ...marketData("SOL-USDT", 0.01), candles: marketData("SOL-USDT", 0.01).candles.slice(-80) };
    const rankings = rankCoinMarketData("spot", [marketData("BTC-USDT", 0), illiquid, insufficient], "BTC-USDT");
    expect(rankings.find((coin) => coin.symbol === "XRP-USDT")?.liquid).toBe(false);
    expect(rankings.find((coin) => coin.symbol === "SOL-USDT")?.liquid).toBe(false);
    expect(preferredValidationSymbols(rankings)).toEqual(["BTC-USDT"]);
  });
});
