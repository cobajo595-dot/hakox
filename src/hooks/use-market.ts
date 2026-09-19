"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coin, MarketResponse } from "@/lib/types";

interface UseMarketResult {
  coins: Coin[];
  loading: boolean;
  updatedAt: number;
  source: MarketResponse["source"] | null;
  refresh: () => Promise<void>;
  getCoin: (coinId: string) => Coin | undefined;
}

/**
 * Polls /api/market on an interval and keeps the latest coin list.
 * Uses refs to avoid stale closures in intervals.
 */
export function useMarket(intervalMs = 15000): UseMarketResult {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [source, setSource] = useState<MarketResponse["source"] | null>(null);
  const coinsRef = useRef<Coin[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      if (!res.ok) return;
      const data: MarketResponse = await res.json();
      coinsRef.current = data.coins;
      setCoins(data.coins);
      setUpdatedAt(data.updatedAt);
      setSource(data.source);
    } catch {
      // keep previous data on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    refresh();
    const timer = setInterval(() => {
      if (alive && document.visibilityState !== "hidden") refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  const getCoin = useCallback(
    (coinId: string) => coinsRef.current.find((c) => c.id === coinId),
    []
  );

  return { coins, loading, updatedAt, source, refresh, getCoin };
}
