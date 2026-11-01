import type { InstrumentRules } from "./kucoin";

export type SizeInput = {
  market: "spot" | "futures";
  equity: number;
  riskPct: number;
  maxPositionUsd: number;
  leverage: number;
  entryPrice: number;
  stopPrice: number;
  rules: InstrumentRules;
};

function floorIncrement(value: number, increment: number) {
  if (!(increment > 0)) return 0;
  return Math.floor((value + 1e-12) / increment) * increment;
}

export function calculatePositionSize(input: SizeInput) {
  const { market, equity, riskPct, maxPositionUsd, leverage, entryPrice, stopPrice, rules } = input;
  if (![equity, riskPct, maxPositionUsd, entryPrice, stopPrice].every(Number.isFinite)) {
    throw new Error("Risikoberechnung enthält ungültige Werte");
  }
  const riskPerUnit = Math.abs(entryPrice - stopPrice) * (market === "futures" ? rules.multiplier : 1);
  if (equity <= 0 || riskPerUnit <= 0 || entryPrice <= 0) throw new Error("Risiko oder Kontostand ist nicht handelbar");
  const riskBudget = equity * Math.min(5, Math.max(0.01, riskPct)) / 100;
  const riskQuantity = riskBudget / riskPerUnit;
  const capQuantity = maxPositionUsd / (entryPrice * (market === "futures" ? rules.multiplier : 1));
  const equityQuantity = market === "futures"
    ? (equity * Math.max(1, Math.min(20, leverage)) * 0.95) / (entryPrice * rules.multiplier)
    : (equity * 0.995) / entryPrice;
  const increment = market === "futures" ? rules.lotSize : rules.baseIncrement;
  const quantity = floorIncrement(Math.min(riskQuantity, capQuantity, equityQuantity), increment);
  if (quantity < increment || quantity <= 0) throw new Error("Positionsgröße liegt unter dem Instrument-Minimum");
  if (market === "spot" && quantity * entryPrice < rules.minFunds) {
    throw new Error(`Orderwert liegt unter dem KuCoin-Mindestwert von ${rules.minFunds} USDT`);
  }
  if (market === "futures" && !Number.isInteger(quantity)) {
    throw new Error("Futures-Kontraktanzahl ist nicht ganzzahlig");
  }
  const decimals = Math.max(0, Math.min(12, Math.ceil(-Math.log10(increment)) + 2));
  return { quantity, quantityText: quantity.toFixed(decimals), riskBudget };
}

export function estimateRealizedPnl(input: {
  market: "spot" | "futures";
  side: "buy" | "sell";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  multiplier: number;
  feePct?: number;
}) {
  const direction = input.side === "buy" ? 1 : -1;
  const multiplier = input.market === "futures" ? input.multiplier : 1;
  const gross = (input.exitPrice - input.entryPrice) * input.quantity * multiplier * direction;
  const fees = ((input.entryPrice + input.exitPrice) * input.quantity * multiplier * (input.feePct ?? 0.1)) / 100;
  return gross - fees;
}
