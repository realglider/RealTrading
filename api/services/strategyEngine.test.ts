import { describe, expect, it } from "vitest";
import { evaluateLatestActionableSignal, getLatestActionableSignal, runWalkForward, walkForwardConstants } from "./strategyEngine";
import type { Candle } from "./kucoin";

function candles(count: number, start = 1_760_000_000): Candle[] {
  const result: Candle[] = [];
  let price = 100;
  for (let index = 0; index < count; index += 1) {
    const wave = Math.sin(index / 7) * 1.8 + Math.cos(index / 19) * 0.8;
    const open = price;
    const close = Math.max(5, open + wave * 0.18 + (index % 11 === 0 ? 0.3 : -0.03));
    result.push({
      time: start + index * 900,
      open,
      high: Math.max(open, close) + 0.35,
      low: Math.min(open, close) - 0.35,
      close,
      volume: 1000 + (index % 17) * 35,
    });
    price = close;
  }
  return result;
}

describe("walk-forward validation", () => {
  it("uses rolling folds and never treats insufficient samples as eligible", () => {
    const result = runWalkForward(candles(480));
    expect(result.folds).toHaveLength(walkForwardConstants.foldCount);
    expect(result.strategyId).toBe(result.folds[2].strategyId);
    if (result.closedTrades < walkForwardConstants.minOosTrades) expect(result.eligible).toBe(false);
    expect(result.reason.length).toBeGreaterThan(10);
  });

  it("rejects an insufficient candle history", () => {
    expect(() => runWalkForward(candles(200))).toThrow(/mindestens 480/);
  });
});

describe("live signal freshness", () => {
  it("never emits a signal when the newest candle is already closed", () => {
    const series = candles(500);
    const nowMs = (series[series.length - 1].time + 901) * 1000;
    expect(getLatestActionableSignal({ candles: series, strategyId: "ensemble", market: "spot", timeframe: "15m", nowMs })).toBeNull();
  });

  it("continues evaluating within the same entry candle after the old 90-second cutoff", () => {
    const series = candles(500);
    const nowMs = (series[series.length - 1].time + 91) * 1000;
    const evaluation = evaluateLatestActionableSignal({ candles: series, strategyId: "ensemble", market: "spot", timeframe: "15m", nowMs });
    expect(evaluation.reason).not.toBe("Das Einstiegsfenster dieser Kerze ist abgelaufen.");
  });
});
