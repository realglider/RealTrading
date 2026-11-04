import { createHmac } from "node:crypto";
import type { CoinOptionDto, Market, Timeframe } from "@contracts/trading";
import { selectTopVolumeCoins } from "./marketResearch";

const SPOT_BASE = "https://api.kucoin.com";
const FUTURES_BASE = "https://api-futures.kucoin.com";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type KucoinCredentials = {
  key: string;
  secret: string;
  passphrase: string;
  keyVersion: string;
};

export type InstrumentRules = {
  baseIncrement: number;
  quoteIncrement: number;
  minFunds: number;
  multiplier: number;
  lotSize: number;
};

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
};

const SPOT_INTERVAL: Record<Timeframe, string> = {
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1hour",
  "4h": "4hour",
};

const FUTURES_GRANULARITY: Record<Timeframe, number> = {
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
};

export function timeframeSeconds(timeframe: Timeframe) {
  return TIMEFRAME_SECONDS[timeframe];
}

export function isClosedCandle(candle: Candle, timeframe: Timeframe, nowSeconds = Date.now() / 1000) {
  return candle.time + timeframeSeconds(timeframe) <= nowSeconds;
}

function baseUrl(market: Market) {
  return market === "spot" ? SPOT_BASE : FUTURES_BASE;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  let payload: { code?: string; msg?: string; data?: unknown };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`KuCoin HTTP ${res.status}: nicht lesbare Antwort`);
  }
  if (!res.ok || payload.code !== "200000") {
    throw new Error(`KuCoin: ${payload.msg || `HTTP ${res.status}`}`);
  }
  return payload.data;
}

function networkError(market: Market, error: unknown, operation: "Marktdaten" | "API" = "Marktdaten") {
  const name = error instanceof Error ? error.name : "";
  const cause = error instanceof Error && error.cause && typeof error.cause === "object"
    ? error.cause as { code?: string }
    : null;
  const detail = name === "AbortError" || name === "TimeoutError"
    ? "Zeitüberschreitung"
    : cause?.code || (error instanceof Error ? error.message : "Netzwerkfehler");
  return new Error(`KuCoin-${market === "spot" ? "Spot" : "Futures"}-${operation} ${operation === "API" ? "ist" : "sind"} vom Server nicht erreichbar (${detail}). Bitte Verbindung beziehungsweise KuCoin-Erreichbarkeit der Hosting-Umgebung prüfen.`);
}

async function publicRequest<T>(market: Market, endpoint: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl(market)}${endpoint}`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      throw networkError(market, error);
    }
    return (await parseResponse(res)) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVolumeRankedCoins(market: Market): Promise<CoinOptionDto[]> {
  if (market === "spot") {
    const data = await publicRequest<{
      ticker?: Array<{ symbol?: string; volValue?: string | number }>;
    }>("spot", "/api/v1/market/allTickers");
    return selectTopVolumeCoins(market, (data.ticker ?? []).map((ticker) => {
      const [baseCurrency = "", quoteCurrency = ""] = String(ticker.symbol ?? "").split("-");
      return {
        symbol: String(ticker.symbol ?? ""),
        baseCurrency,
        quoteCurrency,
        volume24hUsd: Number(ticker.volValue ?? 0),
      };
    }));
  }

  const data = await publicRequest<Array<{
    symbol?: string;
    baseCurrency?: string;
    displayBaseCurrency?: string;
    quoteCurrency?: string;
    status?: string;
    turnoverOf24h?: string | number;
  }>>("futures", "/api/v1/contracts/active");
  return selectTopVolumeCoins(market, data
    .filter((contract) => contract.status === undefined || contract.status === "Open")
    .map((contract) => ({
      symbol: String(contract.symbol ?? ""),
      baseCurrency: String(contract.displayBaseCurrency ?? contract.baseCurrency ?? ""),
      quoteCurrency: String(contract.quoteCurrency ?? ""),
      volume24hUsd: Number(contract.turnoverOf24h ?? 0),
    })));
}

function signature(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

async function privateRequest<T>(
  market: Market,
  method: "GET" | "POST",
  endpoint: string,
  credentials: KucoinCredentials,
  body?: Record<string, unknown>,
): Promise<T> {
  const timestamp = Date.now().toString();
  const requestBody = body ? JSON.stringify(body) : "";
  const prehash = `${timestamp}${method}${endpoint}${requestBody}`;
  const headers = {
    "KC-API-KEY": credentials.key,
    "KC-API-SIGN": signature(credentials.secret, prehash),
    "KC-API-TIMESTAMP": timestamp,
    "KC-API-PASSPHRASE": signature(credentials.secret, credentials.passphrase),
    "KC-API-KEY-VERSION": credentials.keyVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl(market)}${endpoint}`, {
        method,
        headers,
        body: requestBody || undefined,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      throw networkError(market, error, "API");
    }
    return (await parseResponse(res)) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getKlines(
  market: Market,
  symbol: string,
  timeframe: Timeframe,
  limit: number,
): Promise<Candle[]> {
  const target = Math.max(80, Math.min(1000, Math.floor(limit)));
  const seconds = timeframeSeconds(timeframe);
  const byTime = new Map<number, Candle>();
  let endSeconds = Math.floor(Date.now() / 1000);

  const maxCandlesPerRequest = market === "futures" ? 200 : 500;
  for (let page = 0; page < 6 && byTime.size < target; page += 1) {
    // KuCoin Futures returns at most 200 candles per request. Keep each
    // requested range within that limit so the newest candles are not silently
    // truncated before we page backwards for older history.
    const batchSize = Math.min(maxCandlesPerRequest, target - byTime.size + 1);
    const startSeconds = endSeconds - batchSize * seconds;
    const endpoint = market === "spot"
      ? `/api/v1/market/candles?symbol=${encodeURIComponent(symbol)}&type=${SPOT_INTERVAL[timeframe]}&startAt=${startSeconds}&endAt=${endSeconds}`
      : `/api/v1/kline/query?symbol=${encodeURIComponent(symbol)}&granularity=${FUTURES_GRANULARITY[timeframe]}&from=${startSeconds * 1000}&to=${endSeconds * 1000}`;
    const rows = await publicRequest<unknown[][]>(market, endpoint);
    if (!Array.isArray(rows) || rows.length === 0) break;

    let earliest = endSeconds;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const rawTime = Number(row[0]);
      const time = Math.floor(rawTime > 1e12 ? rawTime / 1000 : rawTime);
      const open = Number(row[1]);
      const high = market === "spot" ? Number(row[3]) : Number(row[2]);
      const low = market === "spot" ? Number(row[4]) : Number(row[3]);
      const close = market === "spot" ? Number(row[2]) : Number(row[4]);
      const volume = Number(row[5]);
      const candle = { time, open, high, low, close, volume };
      if ([time, open, high, low, close, volume].every(Number.isFinite) && time > 0) {
        byTime.set(time, candle);
        earliest = Math.min(earliest, time);
      }
    }
    if (earliest >= endSeconds) break;
    endSeconds = earliest - seconds;
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-target);
}

export async function getInstrumentRules(market: Market, symbol: string): Promise<InstrumentRules> {
  if (market === "spot") {
    const data = await publicRequest<{
      baseIncrement?: string;
      quoteIncrement?: string;
      minFunds?: string;
    }>("spot", `/api/v2/symbols/${encodeURIComponent(symbol)}`);
    return {
      baseIncrement: Number(data.baseIncrement || 0.00000001),
      quoteIncrement: Number(data.quoteIncrement || 0.01),
      minFunds: Number(data.minFunds || 1),
      multiplier: 1,
      lotSize: Number(data.baseIncrement || 0.00000001),
    };
  }
  const data = await publicRequest<{ multiplier?: number; lotSize?: number; tickSize?: number }>(
    "futures",
    `/api/v1/contracts/${encodeURIComponent(symbol)}`,
  );
  return {
    baseIncrement: Number(data.lotSize || 1),
    quoteIncrement: Number(data.tickSize || 0.1),
    minFunds: 0,
    multiplier: Number(data.multiplier || 1),
    lotSize: Number(data.lotSize || 1),
  };
}

export async function getAvailableEquity(market: Market, credentials: KucoinCredentials) {
  if (market === "spot") {
    const accounts = await privateRequest<Array<{ available?: string }>>(
      "spot",
      "GET",
      "/api/v1/accounts?currency=USDT&type=trade",
      credentials,
    );
    return accounts.reduce((sum, account) => sum + Number(account.available || 0), 0);
  }
  const account = await privateRequest<{ availableBalance?: number | string }>(
    "futures",
    "GET",
    "/api/v1/account-overview?currency=USDT",
    credentials,
  );
  return Number(account.availableBalance || 0);
}

export async function testCredentials(market: Market, credentials: KucoinCredentials) {
  const equity = await getAvailableEquity(market, credentials);
  if (!Number.isFinite(equity)) throw new Error("KuCoin: Kontostand ist nicht lesbar");
  return { equity };
}

export async function placeMarketOrder(input: {
  market: Market;
  symbol: string;
  side: "buy" | "sell";
  credentials: KucoinCredentials;
  clientOid: string;
  quantity?: string;
  funds?: string;
  leverage?: number;
  reduceOnly?: boolean;
  stopPrice?: string;
  targetPrice?: string;
}) {
  const { market, symbol, side, credentials, clientOid, quantity, funds, leverage, reduceOnly, stopPrice, targetPrice } = input;
  if (market === "spot") {
    const body: Record<string, unknown> = {
      clientOid,
      symbol,
      side,
      type: "market",
      stp: "CN",
      tags: "wf-bot",
    };
    if (funds) body.funds = funds;
    else if (quantity) body.size = quantity;
    else throw new Error("Spot-Order benötigt size oder funds");
    return privateRequest<{ orderId: string }>("spot", "POST", "/api/v1/hf/orders", credentials, body);
  }

  const contracts = Number(quantity);
  if (!Number.isInteger(contracts) || contracts < 1) {
    throw new Error("Futures-Order benötigt eine positive ganze Kontraktanzahl");
  }
  const futuresBody: Record<string, unknown> = {
    clientOid,
    symbol,
    side,
    type: "market",
    size: contracts,
    leverage: String(leverage || 1),
    marginMode: "ISOLATED",
    positionSide: "BOTH",
    reduceOnly: Boolean(reduceOnly),
    remark: "wf-bot",
  };
  if (!reduceOnly && stopPrice && targetPrice) {
    const isLong = side === "buy";
    futuresBody.stopPriceType = "MP";
    futuresBody.triggerStopUpPrice = isLong ? targetPrice : stopPrice;
    futuresBody.triggerStopDownPrice = isLong ? stopPrice : targetPrice;
  }
  return privateRequest<{ orderId: string }>(
    "futures",
    "POST",
    !reduceOnly && stopPrice && targetPrice ? "/api/v1/st-orders" : "/api/v1/orders",
    credentials,
    futuresBody,
  );
}

export async function hasOpenFuturesPosition(symbol: string, credentials: KucoinCredentials) {
  const data = await privateRequest<{
    symbol?: string;
    currentQty?: number | string;
    isOpen?: boolean;
  } | Array<{ symbol?: string; currentQty?: number | string; isOpen?: boolean }>>(
    "futures",
    "GET",
    `/api/v2/position?symbol=${encodeURIComponent(symbol)}`,
    credentials,
  );
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const position = rows.find((row) => !row.symbol || row.symbol === symbol);
  if (!position) return false;
  return typeof position.isOpen === "boolean" ? position.isOpen : Number(position.currentQty ?? 0) !== 0;
}

export type OrderFill = {
  status: "filled" | "open" | "cancelled";
  quantity: number | null;
  averagePrice: number | null;
  raw: unknown;
};

export async function getOrderFill(
  market: Market,
  orderId: string,
  credentials: KucoinCredentials,
): Promise<OrderFill> {
  const endpoint = market === "spot" ? `/api/v1/hf/orders/${encodeURIComponent(orderId)}` : `/api/v1/orders/${encodeURIComponent(orderId)}`;
  const data = await privateRequest<Record<string, unknown>>(market, "GET", endpoint, credentials);
  const quantity = Number(data.dealSize ?? data.filledSize ?? 0);
  const dealValue = Number(market === "spot" ? data.dealFunds : data.dealValue ?? data.filledValue ?? 0);
  const directAverage = Number(data.avgDealPrice ?? data.avgPrice ?? 0);
  const averagePrice = directAverage > 0 ? directAverage : quantity > 0 && dealValue > 0 ? dealValue / quantity : null;
  const statusText = String(data.status ?? "").toLowerCase();
  const active = data.isActive === true;
  const cancelled = statusText.includes("cancel") || data.cancelExist === true;
  const filled = !cancelled && (statusText === "done" || (!active && quantity > 0));
  return {
    status: cancelled ? "cancelled" : filled ? "filled" : "open",
    quantity: quantity > 0 ? quantity : null,
    averagePrice,
    raw: data,
  };
}
