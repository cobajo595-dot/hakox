import "server-only";
import type { Coin, MarketResponse } from "@/lib/types";

const CG_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h";

const CACHE_TTL_MS = 45_000;

interface CacheEntry {
  coins: Coin[];
  updatedAt: number;
}

const globalForMarket = globalThis as unknown as {
  hakoxMarketCache?: CacheEntry;
  hakoxMarketInflight?: Promise<Coin[] | null>;
};

/** Deterministic fallback market so the app always works, even offline. */
function fallbackCoins(): Coin[] {
  const base: Array<[string, string, string, number, number, number]> = [
    ["bitcoin", "BTC", "Bitcoin", 77819, 61000, 1.35],
    ["ethereum", "ETH", "Ethereum", 2500, 3100, -0.66],
    ["tether", "USDT", "Tether", 1.0, 1.0, 0.01],
    ["ripple", "XRP", "XRP", 2.21, 2.6, 10.2],
    ["binancecoin", "BNB", "BNB", 705, 790, 1.12],
    ["solana", "SOL", "Solana", 194, 260, 3.42],
    ["dogecoin", "DOGE", "Dogecoin", 0.21, 0.35, -2.18],
    ["cardano", "ADA", "Cardano", 0.75, 1.1, 1.05],
    ["tron", "TRX", "TRON", 0.28, 0.36, 0.87],
    ["chainlink", "LINK", "Chainlink", 18.4, 30, 4.61],
    ["avalanche-2", "AVAX", "Avalanche", 36.2, 55, -1.74],
    ["sui", "SUI", "Sui", 4.1, 5.5, 5.83],
  ];
  return base.map(([id, symbol, name, price, _high, change], i) => {
    const sparkline: number[] = [];
    let p = price * (1 - change / 100);
    for (let k = 0; k < 84; k++) {
      p *= 1 + Math.sin(k * 0.35 + i) * 0.004 + (change / 100) / 84;
      sparkline.push(Number(p.toFixed(8)));
    }
    sparkline[sparkline.length - 1] = price;
    return {
      id,
      symbol,
      name,
      image: `https://assets.coingecko.com/coins/images/1/small/placeholder.png`,
      price,
      change24h: change,
      high24h: price * 1.02,
      low24h: price * 0.98,
      volume: (i + 1) * 4.2e8 + 1e7,
      marketCap: (12 - i) * 8.4e9,
      sparkline,
    };
  });
}

function normalize(data: unknown): Coin[] {
  if (!Array.isArray(data)) throw new Error("bad payload");
  const coins: Coin[] = [];
  for (const raw of data) {
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.current_price !== "number") continue;
    const sparkRaw = Array.isArray(r.sparkline_in_7d?.price)
      ? (r.sparkline_in_7d.price as number[])
      : [];
    // Downsample 168 hourly points -> 84 to keep payload light.
    const sparkline = sparkRaw.filter((_, idx) => idx % 2 === 0).map((v) => Number(v));
    coins.push({
      id: r.id,
      symbol: String(r.symbol ?? "").toUpperCase(),
      name: String(r.name ?? r.id),
      image: String(r.image ?? ""),
      price: r.current_price,
      change24h: Number(r.price_change_percentage_24h ?? 0),
      high24h: Number(r.high_24h ?? r.current_price),
      low24h: Number(r.low_24h ?? r.current_price),
      volume: Number(r.total_volume ?? 0),
      marketCap: Number(r.market_cap ?? 0),
      sparkline,
    });
  }
  if (coins.length === 0) throw new Error("empty market");
  return coins;
}

async function fetchLive(): Promise<Coin[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(CG_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

/** Get market coins with in-memory cache + inflight dedupe + static fallback. */
export async function getMarket(): Promise<MarketResponse> {
  const cache = globalForMarket.hakoxMarketCache;
  const fresh = cache && Date.now() - cache.updatedAt < CACHE_TTL_MS;
  if (fresh && cache) {
    return { coins: cache.coins, updatedAt: cache.updatedAt, source: "cache" };
  }

  if (!globalForMarket.hakoxMarketInflight) {
    globalForMarket.hakoxMarketInflight = fetchLive().finally(() => {
      globalForMarket.hakoxMarketInflight = undefined;
    });
  }
  const live = await globalForMarket.hakoxMarketInflight;

  if (live) {
    globalForMarket.hakoxMarketCache = { coins: live, updatedAt: Date.now() };
    return { coins: live, updatedAt: Date.now(), source: "live" };
  }
  if (cache) {
    return { coins: cache.coins, updatedAt: cache.updatedAt, source: "cache" };
  }
  const fb = fallbackCoins();
  globalForMarket.hakoxMarketCache = { coins: fb, updatedAt: Date.now() };
  return { coins: fb, updatedAt: Date.now(), source: "fallback" };
}

/** Quick price lookup used by trading endpoints. Returns null if unknown. */
export async function getCoinPrice(coinId: string): Promise<{ price: number; symbol: string; name: string } | null> {
  const { coins } = await getMarket();
  const c = coins.find((x) => x.id === coinId);
  if (!c) return null;
  return { price: c.price, symbol: c.symbol, name: c.name };
}

/* ===================== FX: USD → IDR ===================== */

const FX_TTL_MS = 10 * 60_000;
const FALLBACK_USD_IDR = 17660;

const globalForFx = globalThis as unknown as {
  hakoxFxCache?: { rate: number; updatedAt: number };
  hakoxFxInflight?: Promise<number | null>;
};

async function fetchUsdIdr(): Promise<number | null> {
  // Primary: open.er-api.com (dedicated fiat FX)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      const idr = data.rates?.IDR;
      if (typeof idr === "number" && idr > 1000) return idr;
    }
  } catch {
    /* try next source */
  }
  // Secondary: CoinGecko exchange rates
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.coingecko.com/api/v3/exchange_rates", {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { rates?: { idr?: { value?: number } } };
      const idr = data.rates?.idr?.value;
      if (typeof idr === "number" && idr > 1000) return idr;
    }
  } catch {
    /* give up */
  }
  return null;
}

/** Real USD→IDR exchange rate with 10-min cache, inflight dedupe and stale/fallback resilience. */
export async function getUsdIdrRate(): Promise<number> {
  const cache = globalForFx.hakoxFxCache;
  if (cache && Date.now() - cache.updatedAt < FX_TTL_MS) return cache.rate;

  if (!globalForFx.hakoxFxInflight) {
    globalForFx.hakoxFxInflight = fetchUsdIdr().finally(() => {
      globalForFx.hakoxFxInflight = undefined;
    });
  }
  const live = await globalForFx.hakoxFxInflight;

  if (live) {
    globalForFx.hakoxFxCache = { rate: live, updatedAt: Date.now() };
    return live;
  }
  // keep last known (stale) rate rather than the static fallback
  if (cache) return cache.rate;
  return FALLBACK_USD_IDR;
}
