export const MARKETS = ["spot", "futures"] as const;
export type Market = (typeof MARKETS)[number];

export const TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const COIN_OPTIONS = {
  spot: [
    { symbol: "BTC-USDT", label: "Bitcoin (BTC)" },
    { symbol: "ETH-USDT", label: "Ethereum (ETH)" },
    { symbol: "SOL-USDT", label: "Solana (SOL)" },
    { symbol: "XRP-USDT", label: "XRP" },
  ],
  futures: [
    { symbol: "XBTUSDTM", label: "Bitcoin (BTC)" },
    { symbol: "ETHUSDTM", label: "Ethereum (ETH)" },
    { symbol: "SOLUSDTM", label: "Solana (SOL)" },
    { symbol: "XRPUSDTM", label: "XRP" },
  ],
} as const satisfies Record<Market, readonly { symbol: string; label: string }[]>;

export const COIN_UNIVERSE: Record<Market, string[]> = {
  spot: COIN_OPTIONS.spot.map((coin) => coin.symbol),
  futures: COIN_OPTIONS.futures.map((coin) => coin.symbol),
};

export const STRATEGIES = [
  { id: "lsob_strategy", name: "LSOB & Liquidity Sweep" },
  { id: "fib_882_lsob", name: "0.882 Fibonacci Sniper" },
  { id: "ensemble", name: "Smart Ensemble" },
  { id: "smc_sweep", name: "Smart Money Sweep" },
  { id: "mean_reversion", name: "Mean Reversion" },
  { id: "trend_pullback", name: "EMA Golden Pullback" },
  { id: "divergence_sniper", name: "RSI/MACD Divergenz" },
  { id: "squeeze_breakout", name: "Volatility Squeeze" },
] as const;

export type BotSettingsDto = {
  market: Market;
  symbol: string;
  timeframe: Timeframe;
  riskPct: number;
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  leverage: number;
  liveEnabled: boolean;
  hasCredentials: boolean;
  keyHint: string | null;
  lastRunAt: string | null;
  lastValidationAt: string | null;
};

export type ValidationFoldDto = {
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

export type ValidationDto = {
  id: number;
  market: Market;
  symbol: string;
  timeframe: Timeframe;
  strategyId: string;
  strategyName: string;
  eligible: boolean;
  reason: string;
  closedTrades: number;
  netR: number;
  winRate: number;
  profitFactor: number | null;
  folds: ValidationFoldDto[];
  createdAt: string;
};

export type RecommendationDto = {
  market: Market;
  symbol: string;
  eligible: boolean;
  timeframe: Timeframe | null;
  strategyId: string | null;
  strategyName: string | null;
  validationId: number | null;
  reason: string;
  createdAt: string | null;
  evaluatedTimeframes: number;
  failedTimeframes: Timeframe[];
  evaluatedSymbols: string[];
  failedSymbols: string[];
};

export type CoinOptionDto = {
  market: Market;
  symbol: string;
  baseCurrency: string;
  volume24hUsd: number;
  rank: number;
};

export type CoinDirectoryDto = {
  market: Market;
  coins: CoinOptionDto[];
  source: "live" | "cache" | "fallback";
  updatedAt: string | null;
  warning: string | null;
};

export type CoinRankingDto = {
  market: Market;
  symbol: string;
  rank: number;
  score: number;
  momentum7dPct: number;
  momentum30dPct: number;
  relativeStrength7dPct: number;
  dailyVolatilityPct: number;
  averageDollarVolume: number;
  regime: "trend_up" | "trend_down" | "range" | "transition";
  liquid: boolean;
  reason: string;
  createdAt: string;
};

export type PositionDto = {
  id: number;
  market: Market;
  symbol: string;
  side: "buy" | "sell";
  strategyId: string;
  quantity: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  status: string;
  realizedPnl: string | null;
  openedAt: string;
  closedAt: string | null;
};

export type OrderDto = {
  id: number;
  market: Market;
  symbol: string;
  side: "buy" | "sell";
  purpose: "entry" | "exit" | "test";
  strategyId: string;
  clientOid: string;
  exchangeOrderId: string | null;
  status: string;
  createdAt: string;
};

export type BotEventDto = {
  id: number;
  market: Market;
  level: "info" | "warn" | "error" | "success";
  message: string;
  createdAt: string;
};

export type BotOverviewDto = {
  settings: BotSettingsDto[];
  latestValidations: ValidationDto[];
  recommendations: RecommendationDto[];
  coinRankings: CoinRankingDto[];
  positions: PositionDto[];
  orders: OrderDto[];
  events: BotEventDto[];
  scheduler: { running: boolean; intervalSeconds: number; liveOrderExecution: true };
};
