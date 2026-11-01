import { describe, expect, it } from "vitest";
import type { CoinRankingDto, RecommendationDto, Timeframe, ValidationDto } from "@contracts/trading";
import { selectCoinRecommendation, selectTimeframeRecommendation } from "./recommendation";

function validation(input: {
  id: number;
  timeframe: Timeframe;
  eligible: boolean;
  netR: number;
  closedTrades?: number;
  profitFactor?: number | null;
  symbol?: string;
  createdAt?: string;
}): ValidationDto {
  return {
    id: input.id,
    market: "spot",
    symbol: input.symbol ?? "BTC-USDT",
    timeframe: input.timeframe,
    strategyId: `strategy-${input.timeframe}`,
    strategyName: `Strategie ${input.timeframe}`,
    eligible: input.eligible,
    reason: "Test",
    closedTrades: input.closedTrades ?? 10,
    netR: input.netR,
    winRate: 55,
    profitFactor: input.profitFactor === undefined ? 1.3 : input.profitFactor,
    folds: [],
    createdAt: input.createdAt ?? "2026-10-31T12:00:00.000Z",
  };
}

function ranking(symbol: string, rank: number): CoinRankingDto {
  return {
    market: "spot", symbol, rank, score: 10 - rank, momentum7dPct: 5, momentum30dPct: 10,
    relativeStrength7dPct: 2, dailyVolatilityPct: 50, averageDollarVolume: 1_000_000,
    regime: "trend_up", liquid: true, reason: "Test", createdAt: "2026-10-31T12:00:00.000Z",
  };
}

describe("selectTimeframeRecommendation", () => {
  it("wählt nur unter freigegebenen Timeframes nach OOS-Erwartungswert", () => {
    const result = selectTimeframeRecommendation({
      market: "spot",
      symbol: "BTC-USDT",
      validations: [
        validation({ id: 1, timeframe: "5m", eligible: true, netR: 12, profitFactor: 1.8 }),
        validation({ id: 2, timeframe: "15m", eligible: true, netR: 18, closedTrades: 12, profitFactor: 1.2 }),
        validation({ id: 3, timeframe: "1h", eligible: false, netR: 100 }),
      ],
    });
    expect(result.timeframe).toBe("15m");
    expect(result.validationId).toBe(2);
    expect(result.eligible).toBe(true);
  });

  it("gibt keine Handelsempfehlung, wenn kein Timeframe freigegeben ist", () => {
    const result = selectTimeframeRecommendation({
      market: "spot",
      symbol: "BTC-USDT",
      validations: [validation({ id: 1, timeframe: "5m", eligible: false, netR: 8 })],
    });
    expect(result.eligible).toBe(false);
    expect(result.timeframe).toBeNull();
    expect(result.strategyId).toBeNull();
    expect(result.reason).toContain("Keine Handelsfreigabe");
  });

  it("verwendet je Timeframe nur die neueste Validierung", () => {
    const result = selectTimeframeRecommendation({
      market: "spot",
      symbol: "BTC-USDT",
      validations: [
        validation({ id: 1, timeframe: "5m", eligible: true, netR: 20, createdAt: "2026-10-30T12:00:00.000Z" }),
        validation({ id: 2, timeframe: "5m", eligible: false, netR: -2, createdAt: "2026-10-31T12:00:00.000Z" }),
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.timeframe).toBeNull();
  });

  it("ignoriert andere Coins und weist fehlgeschlagene Timeframes aus", () => {
    const result: RecommendationDto = selectTimeframeRecommendation({
      market: "spot",
      symbol: "BTC-USDT",
      validations: [
        validation({ id: 1, timeframe: "4h", eligible: true, netR: 10, symbol: "ETH-USDT" }),
        validation({ id: 2, timeframe: "30m", eligible: true, netR: 9 }),
      ],
      failedTimeframes: ["5m", "15m"],
    });
    expect(result.timeframe).toBe("30m");
    expect(result.evaluatedTimeframes).toBe(1);
    expect(result.failedTimeframes).toEqual(["5m", "15m"]);
  });
});

describe("selectCoinRecommendation", () => {
  it("validates only the two leading coins and selects across eligible OOS results", () => {
    const result = selectCoinRecommendation({
      market: "spot",
      rankings: [ranking("BTC-USDT", 1), ranking("ETH-USDT", 2), ranking("SOL-USDT", 3)],
      validations: [
        validation({ id: 1, symbol: "BTC-USDT", timeframe: "15m", eligible: true, netR: 4 }),
        validation({ id: 2, symbol: "ETH-USDT", timeframe: "1h", eligible: true, netR: 12 }),
        validation({ id: 3, symbol: "SOL-USDT", timeframe: "4h", eligible: true, netR: 100 }),
      ],
    });
    expect(result.symbol).toBe("ETH-USDT");
    expect(result.timeframe).toBe("1h");
    expect(result.evaluatedSymbols).toEqual(["BTC-USDT", "ETH-USDT"]);
  });
});
