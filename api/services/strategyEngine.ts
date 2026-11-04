import type { Market, Timeframe } from "@contracts/trading";
import { Indicators as indicatorsModule } from "./legacy/indicators.mjs";
import { AIEngine as aiEngineModule } from "./legacy/ai-engine.mjs";
import { evaluateEntryGate, type EntryGateResult } from "./executionFilter";
import { isClosedCandle, timeframeSeconds, type Candle } from "./kucoin";

export const BACKTEST_ASSUMPTIONS = {
  feePct: 0.1,
  slippagePct: 0.05,
  maxBarsInTrade: 50,
} as const;

const TRAIN_SIZE = 240;
const TEST_SIZE = 80;
const FOLD_COUNT = 3;
const WARMUP_SIZE = 220;
const MIN_OOS_TRADES = 8;
const MIN_PROFIT_FACTOR = 1.15;
const MAX_LIVE_ENTRY_DRIFT_R = 0.25;

type BacktestStats = {
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number | null;
  netR: number;
  expectancyR: number;
};

type Signal = {
  id: string;
  index: number;
  time: number;
  entryIndex: number;
  entryTime: number;
  rawEntry: number;
  entry: number;
  side: "BUY" | "SELL";
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskAbs: number;
  status?: "WIN" | "LOSS" | "OPEN" | "SKIPPED";
  exitTime?: number;
  exitPrice?: number;
  exitReason?: string;
  rMultiple?: number;
  reasons: string[];
};

type BacktestResult = { signals: Signal[]; stats: BacktestStats };
type RankedStrategy = { id: string; name: string; rankScore: number; stats: BacktestStats };
type BacktestOptions = typeof BACKTEST_ASSUMPTIONS & {
  entryFilter?: (signal: Signal, strategyId: string) => boolean;
};
type LegacyModule = {
  Indicators: { computeAll(candles: Candle[]): unknown };
  AIEngine: {
    generateSignalsAndBacktest(
      candles: Candle[],
      indicators: unknown,
      strategyId: string,
      options: BacktestOptions,
    ): BacktestResult;
    compareAllStrategies(
      candles: Candle[],
      indicators: unknown,
      options: BacktestOptions,
    ): RankedStrategy[];
  };
};

const Indicators = indicatorsModule as LegacyModule["Indicators"];
const AIEngine = aiEngineModule as LegacyModule["AIEngine"];

export type WalkForwardFold = {
  fold: number;
  trainFrom: string;
  trainTo: string;
  testTo: string;
  strategyId: string;
  strategyName: string;
  closedTrades: number;
  netR: number;
  winRate: number;
};

export type WalkForwardResult = {
  strategyId: string;
  strategyName: string;
  eligible: boolean;
  reason: string;
  closedTrades: number;
  netR: number;
  winRate: number;
  profitFactor: number | null;
  folds: WalkForwardFold[];
};

export type ActionableSignal = {
  clientOidSeed: string;
  signalTime: number;
  side: "buy" | "sell";
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  reasons: string[];
  execution: EntryGateResult;
};

export type ActionableSignalEvaluation = {
  signal: ActionableSignal | null;
  reason: string;
  candleTime: number | null;
};

type EntryFilterRejection = { signal: Signal; gate: EntryGateResult };

function optionsFor(
  candles: Candle[],
  market: Market,
  timeframe: Timeframe,
  onRejected?: (rejection: EntryFilterRejection) => void,
): BacktestOptions {
  return {
    ...BACKTEST_ASSUMPTIONS,
    entryFilter: (signal, strategyId) => {
      const gate = evaluateEntryGate({
        candles: candles.slice(0, signal.index + 1),
        market,
        timeframe,
        strategyId,
        side: signal.side,
        entryPrice: signal.entry,
        stopPrice: signal.sl,
        targetPrice: signal.tp2,
      });
      if (!gate.allowed) onRejected?.({ signal, gate });
      return gate.allowed;
    },
  };
}

function backtest(
  candles: Candle[],
  strategyId: string,
  market: Market,
  timeframe: Timeframe,
  onRejected?: (rejection: EntryFilterRejection) => void,
) {
  return AIEngine.generateSignalsAndBacktest(
    candles,
    Indicators.computeAll(candles),
    strategyId,
    optionsFor(candles, market, timeframe, onRejected),
  );
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarizeClosed(signals: Signal[]) {
  const closed = signals.filter(
    (signal) => (signal.status === "WIN" || signal.status === "LOSS") && Number.isFinite(signal.rMultiple),
  );
  let wins = 0;
  let netR = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  for (const signal of closed) {
    const result = Number(signal.rMultiple);
    netR += result;
    if (result > 0) {
      wins += 1;
      grossProfit += result;
    } else {
      grossLoss += Math.abs(result);
    }
  }
  return {
    closed,
    closedTrades: closed.length,
    wins,
    netR,
    grossProfit,
    grossLoss,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
  };
}

export function runWalkForward(
  inputCandles: Candle[],
  market: Market = "futures",
  timeframe: Timeframe = "15m",
): WalkForwardResult {
  const candles = [...inputCandles].sort((a, b) => a.time - b.time);
  const required = TRAIN_SIZE + TEST_SIZE * FOLD_COUNT;
  if (candles.length < required) {
    throw new Error(`Walk-Forward benötigt mindestens ${required} geschlossene Kerzen; erhalten: ${candles.length}`);
  }
  const start = candles.length - required;
  const folds: WalkForwardFold[] = [];
  const outOfSampleSignals: Signal[] = [];

  for (let fold = 0; fold < FOLD_COUNT; fold += 1) {
    const trainStart = start + fold * TEST_SIZE;
    const trainEnd = trainStart + TRAIN_SIZE;
    const testEnd = trainEnd + TEST_SIZE;
    const training = candles.slice(trainStart, trainEnd);
    const ranking = AIEngine.compareAllStrategies(
      training,
      Indicators.computeAll(training),
      optionsFor(training, market, timeframe),
    );
    const selected = ranking.find((candidate) => Number.isFinite(candidate.rankScore)) ?? ranking[0];
    if (!selected) throw new Error("Keine Strategie konnte im Trainingsfenster bewertet werden");

    const contextStart = Math.max(0, trainEnd - WARMUP_SIZE);
    const testContext = candles.slice(contextStart, testEnd);
    const testStartTime = candles[trainEnd].time;
    const testEndTime = candles[testEnd - 1].time;
    const tested = backtest(testContext, selected.id, market, timeframe).signals.filter(
      (signal) => signal.time >= testStartTime && signal.time <= testEndTime && signal.status !== "OPEN",
    );
    const summary = summarizeClosed(tested);
    outOfSampleSignals.push(...summary.closed);
    folds.push({
      fold: fold + 1,
      trainFrom: new Date(training[0].time * 1000).toISOString(),
      trainTo: new Date(training[training.length - 1].time * 1000).toISOString(),
      testTo: new Date(candles[testEnd - 1].time * 1000).toISOString(),
      strategyId: selected.id,
      strategyName: selected.name,
      closedTrades: summary.closedTrades,
      netR: summary.netR,
      winRate: summary.winRate,
    });
  }

  const aggregate = summarizeClosed(outOfSampleSignals);
  const expectancy = aggregate.closedTrades ? aggregate.netR / aggregate.closedTrades : 0;
  const positiveFolds = folds.filter((fold) => fold.netR > 0).length;
  const failures: string[] = [];
  if (aggregate.closedTrades < MIN_OOS_TRADES) failures.push(`nur ${aggregate.closedTrades}/${MIN_OOS_TRADES} OOS-Trades`);
  if (expectancy <= 0) failures.push("Erwartungswert nicht positiv");
  if (finite(aggregate.profitFactor) < MIN_PROFIT_FACTOR) failures.push(`Profit-Faktor unter ${MIN_PROFIT_FACTOR}`);
  if (positiveFolds < 2) failures.push("weniger als zwei positive Testfenster");
  const eligible = failures.length === 0;
  const latest = folds[folds.length - 1];

  return {
    strategyId: latest.strategyId,
    strategyName: latest.strategyName,
    eligible,
    reason: eligible
      ? `Freigegeben: ${aggregate.closedTrades} OOS-Trades, ${positiveFolds}/3 positive Fenster; keine Gewinngarantie.`
      : `Nicht freigegeben: ${failures.join(", ")}.`,
    closedTrades: aggregate.closedTrades,
    netR: aggregate.netR,
    winRate: aggregate.winRate,
    profitFactor: Number.isFinite(aggregate.profitFactor) ? aggregate.profitFactor : null,
    folds,
  };
}

export function evaluateLatestActionableSignal(input: {
  candles: Candle[];
  strategyId: string;
  market: Market;
  timeframe: Timeframe;
  nowMs?: number;
}): ActionableSignalEvaluation {
  const { candles, strategyId, market, timeframe } = input;
  const nowMs = input.nowMs ?? Date.now();
  if (candles.length < 80) {
    return {
      signal: null,
      reason: `Zu wenig Kerzen für eine Signalprüfung (${candles.length}/80).`,
      candleTime: candles.at(-1)?.time ?? null,
    };
  }
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  if (isClosedCandle(current, timeframe, nowMs / 1000)) {
    return { signal: null, reason: "Die neueste KuCoin-Kerze ist bereits geschlossen; es gibt kein aktuelles Einstiegsfenster.", candleTime: current.time };
  }
  if (!isClosedCandle(previous, timeframe, nowMs / 1000)) {
    return { signal: null, reason: "Die Signalkerze ist noch nicht geschlossen.", candleTime: current.time };
  }
  const ageSeconds = nowMs / 1000 - current.time;
  if (ageSeconds < 0 || ageSeconds >= timeframeSeconds(timeframe)) {
    return {
      signal: null,
      reason: "Das Einstiegsfenster dieser Kerze ist abgelaufen.",
      candleTime: current.time,
    };
  }

  const rejectedSignal: { current: EntryFilterRejection | null } = { current: null };
  const result = backtest(candles, strategyId, market, timeframe, (candidate) => {
    if (candidate.signal.entryIndex === candles.length - 1 && candidate.signal.time === previous.time) {
      rejectedSignal.current = candidate;
    }
  });
  const signal = result.signals.find(
    (candidate) => candidate.entryIndex === candles.length - 1 && candidate.time === previous.time,
  );
  if (!signal) {
    if (rejectedSignal.current) {
      return {
        signal: null,
        reason: `Signal ${rejectedSignal.current.signal.side} durch Ausführungsfilter blockiert: ${rejectedSignal.current.gate.reasons.join("; ") || "nicht freigegeben"}.`,
        candleTime: current.time,
      };
    }
    return { signal: null, reason: `Kein neues ${strategyId}-Signal auf der zuletzt geschlossenen Kerze.`, candleTime: current.time };
  }
  if (market === "spot" && signal.side === "SELL") {
    return { signal: null, reason: "Spot erlaubt keine Short-Entries.", candleTime: current.time };
  }
  const direction = signal.side === "BUY" ? 1 : -1;
  const riskDistance = Math.abs(signal.entry - signal.sl);
  const entryPrice = current.close;
  if (!(riskDistance > 0) || !Number.isFinite(entryPrice) || !(entryPrice > 0)) {
    return { signal: null, reason: "Kerzenpreis oder Stop-Abstand ist ungültig.", candleTime: current.time };
  }
  const stopTouched = signal.side === "BUY" ? current.low <= signal.sl : current.high >= signal.sl;
  const targetTouched = signal.side === "BUY" ? current.high >= signal.tp2 : current.low <= signal.tp2;
  if (stopTouched || targetTouched) {
    return {
      signal: null,
      reason: stopTouched
        ? "Stop-Level wurde bereits innerhalb der Einstiegskerze berührt; kein verspäteter Einstieg."
        : "TP2 wurde bereits innerhalb der Einstiegskerze berührt; kein verspäteter Einstieg.",
      candleTime: current.time,
    };
  }
  const driftR = ((entryPrice - signal.entry) * direction) / riskDistance;
  if (Math.abs(driftR) > MAX_LIVE_ENTRY_DRIFT_R) {
    return {
      signal: null,
      reason: `Preis ist ${driftR > 0 ? "günstig" : "ungünstig"} um ${Math.abs(driftR).toFixed(2)}R gelaufen; erlaubt sind höchstens ${MAX_LIVE_ENTRY_DRIFT_R.toFixed(2)}R.`,
      candleTime: current.time,
    };
  }
  const execution = evaluateEntryGate({
    candles: candles.slice(0, -1),
    market,
    timeframe,
    strategyId,
    side: signal.side,
    entryPrice,
    stopPrice: signal.sl,
    targetPrice: signal.tp2,
  });
  if (!execution.allowed) {
    return { signal: null, reason: `Ausführungsfilter blockiert das Signal: ${execution.reasons.join("; ")}.`, candleTime: current.time };
  }
  return {
    signal: {
      clientOidSeed: `${strategyId}-${signal.time}-${signal.side}`,
      signalTime: signal.time,
      side: signal.side === "BUY" ? "buy" : "sell",
      entryPrice,
      stopPrice: signal.sl,
      targetPrice: signal.tp2,
      reasons: signal.reasons,
      execution,
    },
    reason: "Frisches Signal ist freigegeben.",
    candleTime: current.time,
  };
}

export function getLatestActionableSignal(input: {
  candles: Candle[];
  strategyId: string;
  market: Market;
  timeframe: Timeframe;
  nowMs?: number;
}): ActionableSignal | null {
  return evaluateLatestActionableSignal(input).signal;
}

export const walkForwardConstants = {
  trainSize: TRAIN_SIZE,
  testSize: TEST_SIZE,
  foldCount: FOLD_COUNT,
  minOosTrades: MIN_OOS_TRADES,
  minProfitFactor: MIN_PROFIT_FACTOR,
};
