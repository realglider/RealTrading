import { describe, expect, it } from "vitest";
import { calculatePositionSize, estimateRealizedPnl } from "./risk";

const spotRules = { baseIncrement: 0.001, quoteIncrement: 0.01, minFunds: 1, multiplier: 1, lotSize: 0.001 };
const futuresRules = { baseIncrement: 1, quoteIncrement: 0.1, minFunds: 0, multiplier: 0.001, lotSize: 1 };

describe("position sizing", () => {
  it("caps spot risk, notional and available equity", () => {
    const result = calculatePositionSize({ market: "spot", equity: 1000, riskPct: 0.5, maxPositionUsd: 100, leverage: 1, entryPrice: 100, stopPrice: 99, rules: spotRules });
    expect(result.quantity).toBe(1);
    expect(result.riskBudget).toBe(5);
  });

  it("rounds futures down to whole contracts", () => {
    const result = calculatePositionSize({ market: "futures", equity: 1000, riskPct: 0.5, maxPositionUsd: 250, leverage: 2, entryPrice: 100000, stopPrice: 99000, rules: futuresRules });
    expect(Number.isInteger(result.quantity)).toBe(true);
    expect(result.quantity).toBeGreaterThanOrEqual(1);
  });

  it("rejects sizes below the exchange minimum", () => {
    expect(() => calculatePositionSize({ market: "spot", equity: 10, riskPct: 0.1, maxPositionUsd: 2, leverage: 1, entryPrice: 100, stopPrice: 50, rules: { ...spotRules, baseIncrement: 1, lotSize: 1 } })).toThrow(/Minimum|Mindestwert/);
  });
});

describe("estimated pnl", () => {
  it("uses direction and fees", () => {
    expect(estimateRealizedPnl({ market: "spot", side: "buy", quantity: 1, entryPrice: 100, exitPrice: 110, multiplier: 1, feePct: 0 })).toBe(10);
    expect(estimateRealizedPnl({ market: "spot", side: "sell", quantity: 1, entryPrice: 100, exitPrice: 110, multiplier: 1, feePct: 0 })).toBe(-10);
  });
});
