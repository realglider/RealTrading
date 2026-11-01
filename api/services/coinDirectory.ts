import type { CoinDirectoryDto, Market } from "@contracts/trading";
import { COIN_OPTIONS } from "@contracts/trading";
import { getVolumeRankedCoins } from "./kucoin";

const DIRECTORY_TTL_MS = 5 * 60 * 1000;

type CachedDirectory = {
  coins: CoinDirectoryDto["coins"];
  updatedAt: string;
};

const cache = new Map<Market, CachedDirectory>();
const pending = new Map<Market, Promise<CoinDirectoryDto>>();

function fallbackDirectory(market: Market, error: unknown): CoinDirectoryDto {
  return {
    market,
    coins: COIN_OPTIONS[market].map((coin, index) => ({
      market,
      symbol: coin.symbol,
      baseCurrency: coin.symbol.split("-")[0].replace(/USDTM?$/, ""),
      volume24hUsd: 0,
      rank: index + 1,
    })),
    source: "fallback",
    updatedAt: null,
    warning: `${error instanceof Error ? error.message : String(error)} Die Top 50 konnten nicht geladen werden; sichtbar sind nur die vier Basis-Coins.`,
  };
}

export async function getCoinDirectory(market: Market): Promise<CoinDirectoryDto> {
  const cached = cache.get(market);
  if (cached && Date.now() - Date.parse(cached.updatedAt) < DIRECTORY_TTL_MS) {
    return { market, ...cached, source: "live", warning: null };
  }
  const existingRequest = pending.get(market);
  if (existingRequest) return existingRequest;

  const request = (async (): Promise<CoinDirectoryDto> => {
    try {
      const coins = await getVolumeRankedCoins(market);
      if (!coins.length) throw new Error("KuCoin liefert aktuell keine liquiden USDT-Märkte für die Top-50-Liste");
      const next = { coins, updatedAt: new Date().toISOString() };
      cache.set(market, next);
      return { market, ...next, source: "live", warning: null };
    } catch (error) {
      if (cached) {
        return {
          market,
          ...cached,
          source: "cache",
          warning: `Live-Aktualisierung der Top 50 fehlgeschlagen; es wird die zuletzt gespeicherte Liste verwendet. ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      return fallbackDirectory(market, error);
    } finally {
      pending.delete(market);
    }
  })();
  pending.set(market, request);
  return request;
}
