import { describe, expect, it } from "vitest";
import { evaluateEntryGate, EXECUTION_FILTER } from "./executionFilter";
import type { Candle } from "./kucoin";

function series(count = 240, amplitude = 0.05): Candle[] {
  const result: Candle[] = [];
  let price = 90;
  for (let index = 0; index < count; index += 1) {
    const open = price;
    const close = open + 0.03 + (index % 2 ? amplitude : -amplitude);
    result.push({ time: 1_760_000_000 + index * 900, open, high: Math.max(open, close) + 0.1, low: Math.min(open, close) - 0.1, close, volume: 10_000 });
    price = close;
  }
  return result;
}

const base = {
  market: "futures" as const,
  timeframe: "15m" as const,
  strategyId: "ensemble",
  side: "BUY" as const,
  entryPrice: 100,
  stopPrice: 99,
  targetPrice: 103,
};

describe("execution entry gate", () => {
  it("allows a liquid-risk setup with sufficient net target", () => {
    const result = evaluateEntryGate({ ...base, candles: series() });
    expect(result.allowed).toBe(true);
    expect(result.netTargetR).toBeGreaterThan(EXECUTION_FILTER.minNetTargetR);
    expect(result.volatilityScale).toBe(1);
  });

  it("blocks tight stops whose costs consume the target", () => {
    const result = evaluateEntryGate({ ...base, candles: series(), stopPrice: 99.9, targetPrice: 100.2 });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("No-Trade-Zone");
  });

  it("never allows a spot short entry", () => {
    const result = evaluateEntryGate({ ...base, candles: series(), market: "spot", side: "SELL", targetPrice: 97 });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Spot erlaubt nur Long-Entries");
  });

  it("blocks extreme volatility and reduces its risk multiplier", () => {
    const volatile = series(240, 30);
    const result = evaluateEntryGate({ ...base, candles: volatile, entryPrice: volatile.at(-1)!.close, stopPrice: volatile.at(-1)!.close - 1, targetPrice: volatile.at(-1)!.close + 3 });
    expect(result.allowed).toBe(false);
    expect(result.volatilityScale).toBe(EXECUTION_FILTER.minVolatilityScale);
    expect(result.reasons.join(" ")).toContain("Extremvolatilität");
  });
});
