import { TIMEFRAMES } from "@contracts/trading";
import type { CoinRankingDto, Market, RecommendationDto, Timeframe, ValidationDto } from "@contracts/trading";
import { preferredValidationSymbols } from "./marketResearch";

function latestPerTimeframe(validations: ValidationDto[], market: Market, symbol: string) {
  return TIMEFRAMES.map((timeframe) => validations
    .filter((validation) => validation.market === market && validation.symbol === symbol && validation.timeframe === timeframe)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0])
    .filter((validation): validation is ValidationDto => Boolean(validation));
}

function compareOutOfSample(a: ValidationDto, b: ValidationDto) {
  const expectancyA = a.closedTrades > 0 ? a.netR / a.closedTrades : Number.NEGATIVE_INFINITY;
  const expectancyB = b.closedTrades > 0 ? b.netR / b.closedTrades : Number.NEGATIVE_INFINITY;
  if (expectancyA !== expectancyB) return expectancyB - expectancyA;
  const factorA = a.profitFactor ?? Number.POSITIVE_INFINITY;
  const factorB = b.profitFactor ?? Number.POSITIVE_INFINITY;
  if (factorA !== factorB) return factorB - factorA;
  if (a.netR !== b.netR) return b.netR - a.netR;
  if (a.closedTrades !== b.closedTrades) return b.closedTrades - a.closedTrades;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function selectTimeframeRecommendation(input: {
  market: Market;
  symbol: string;
  validations: ValidationDto[];
  failedTimeframes?: Timeframe[];
}): RecommendationDto {
  const { market, symbol } = input;
  const latest = latestPerTimeframe(input.validations, market, symbol);
  const best = latest.filter((validation) => validation.eligible).sort(compareOutOfSample)[0];
  const failedTimeframes = input.failedTimeframes ?? [];

  if (!best) {
    return {
      market,
      symbol,
      eligible: false,
      timeframe: null,
      strategyId: null,
      strategyName: null,
      validationId: null,
      reason: latest.length
        ? `Keine Handelsfreigabe: Keiner der ${latest.length} geprüften Timeframes erfüllt aktuell die OOS-Mindestkriterien.`
        : `Noch keine Walk-Forward-Ergebnisse für ${symbol}.`,
      createdAt: null,
      evaluatedTimeframes: latest.length,
      failedTimeframes,
      evaluatedSymbols: [symbol],
      failedSymbols: [],
    };
  }

  const expectancy = best.closedTrades > 0 ? best.netR / best.closedTrades : 0;
  return {
    market,
    symbol,
    eligible: true,
    timeframe: best.timeframe,
    strategyId: best.strategyId,
    strategyName: best.strategyName,
    validationId: best.id,
    reason: `Beste freigegebene OOS-Erwartung: ${expectancy >= 0 ? "+" : ""}${expectancy.toFixed(3)} R pro Trade aus ${best.closedTrades} geschlossenen OOS-Trades.`,
    createdAt: best.createdAt,
    evaluatedTimeframes: latest.length,
    failedTimeframes,
    evaluatedSymbols: [symbol],
    failedSymbols: [],
  };
}

export function selectCoinRecommendation(input: {
  market: Market;
  rankings: CoinRankingDto[];
  validations: ValidationDto[];
  failedSymbols?: string[];
  failedTimeframes?: Timeframe[];
}): RecommendationDto {
  const symbols = preferredValidationSymbols(input.rankings);
  const candidates = symbols.map((symbol) => selectTimeframeRecommendation({
    market: input.market,
    symbol,
    validations: input.validations,
    failedTimeframes: input.failedTimeframes,
  }));
  const eligible = candidates.filter((candidate) => candidate.eligible).sort((a, b) => {
    const validationA = input.validations.find((validation) => validation.id === a.validationId);
    const validationB = input.validations.find((validation) => validation.id === b.validationId);
    return validationA && validationB ? compareOutOfSample(validationA, validationB) : 0;
  });
  const best = eligible[0] ?? candidates[0];
  const failedSymbols = input.failedSymbols ?? [];
  if (!best) {
    return {
      market: input.market,
      symbol: input.rankings[0]?.symbol ?? "—",
      eligible: false,
      timeframe: null,
      strategyId: null,
      strategyName: null,
      validationId: null,
      reason: "Kein Coin besitzt ausreichende Historie und Liquidität für eine Walk-Forward-Prüfung.",
      createdAt: null,
      evaluatedTimeframes: 0,
      failedTimeframes: input.failedTimeframes ?? [],
      evaluatedSymbols: [],
      failedSymbols,
    };
  }
  const rank = input.rankings.find((entry) => entry.symbol === best.symbol)?.rank;
  return {
    ...best,
    reason: best.eligible
      ? `Coin-Rang ${rank ?? "–"}: ${best.reason}`
      : `Keine Handelsempfehlung unter den ${candidates.length} bestplatzierten liquiden Coins. ${best.reason}`,
    failedSymbols,
    evaluatedSymbols: symbols,
  };
}
