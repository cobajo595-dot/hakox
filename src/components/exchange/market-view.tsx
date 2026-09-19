"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, RefreshCw, Search, Star } from "lucide-react";
import { ChangeBadge } from "@/components/exchange/change-badge";
import { CoinLogo } from "@/components/exchange/coin-logo";
import { Sparkline } from "@/components/exchange/sparkline";
import type { Coin } from "@/lib/types";
import { fmtCompact, timeAgoId } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MarketViewProps {
  coins: Coin[];
  loading: boolean;
  updatedAt: number;
  favorites: string[];
  onToggleFavorite: (coinId: string) => void;
  onSelectCoin: (coinId: string) => void;
  onRefresh: () => void;
  initialQuery?: string;
}

type FilterKey = "all" | "fav" | "gainers" | "losers";
type SortKey = "cap" | "volume" | "change_desc" | "change_asc";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "fav", label: "★ Favorit" },
  { key: "gainers", label: "Naik" },
  { key: "losers", label: "Turun" },
];

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "cap", label: "Kapitalisasi pasar" },
  { key: "volume", label: "Volume 24 jam" },
  { key: "change_desc", label: "Kenaikan tertinggi" },
  { key: "change_asc", label: "Penurunan terbesar" },
];

export function MarketView({
  coins,
  loading,
  updatedAt,
  favorites,
  onToggleFavorite,
  onSelectCoin,
  onRefresh,
  initialQuery = "",
}: MarketViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("cap");
  const [showSort, setShowSort] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // re-render every 10s so "updated x ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = coins.filter((c) => {
      if (q && !(c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) return false;
      if (filter === "fav") return favorites.includes(c.id);
      if (filter === "gainers") return c.change24h >= 0;
      if (filter === "losers") return c.change24h < 0;
      return true;
    });
    out = [...out];
    switch (sort) {
      case "volume":
        out.sort((a, b) => b.volume - a.volume);
        break;
      case "change_desc":
        out.sort((a, b) => b.change24h - a.change24h);
        break;
      case "change_asc":
        out.sort((a, b) => a.change24h - b.change24h);
        break;
      default:
        out.sort((a, b) => b.marketCap - a.marketCap);
    }
    return out;
  }, [coins, query, filter, sort, favorites]);

  const activeSort = SORTS.find((s) => s.key === sort)!;

  const handleRefresh = async () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Pasar</h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="hx-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {updatedAt ? `diperbarui ${timeAgoId(updatedAt)}` : "memuat…"}
          </span>
          <button
            onClick={handleRefresh}
            aria-label="Segarkan pasar"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* search */}
      <div className="relative mt-3">
        <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari koin… (mis. BTC, Ethereum)"
          aria-label="Cari koin"
          className="h-10 w-full rounded-full bg-muted pr-4 pl-10 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* filters + sort */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto hx-scroll pb-0.5" role="tablist" aria-label="Filter pasar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSort((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition",
              showSort ? "bg-accent text-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={showSort}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span className="hidden xs:inline sm:inline">{activeSort.label.split(" ")[0]}</span>
          </button>
          {showSort && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSort(false)} />
              <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-border">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setSort(s.key);
                      setShowSort(false);
                    }}
                    className={cn(
                      "block w-full px-3.5 py-2.5 text-left text-xs transition hover:bg-muted/50",
                      sort === s.key ? "font-semibold text-primary" : "text-foreground/80"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* table header */}
      <div className="mt-3 grid grid-cols-[1.5fr_1fr_0.9fr] gap-2 pb-2 text-[11px] font-medium text-muted-foreground">
        <span>Koin</span>
        <span className="text-right">Harga / 7H</span>
        <span className="text-right">24J %</span>
      </div>

      {/* list */}
      <div className="hx-scroll -mx-1 flex-1 overflow-y-auto px-1 pb-4" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {loading && coins.length === 0 ? (
          <ul className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-border/50">
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                <div className="h-6 w-14 animate-pulse rounded-md bg-muted" />
              </li>
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white py-12 text-center ring-1 ring-border/50">
            <Star className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Tidak ada hasil</p>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              {filter === "fav"
                ? "Tandai koin dengan ★ untuk melihatnya di sini."
                : "Coba kata kunci atau filter lain."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {list.map((c) => {
              const fav = favorites.includes(c.id);
              return (
                <li key={c.id} className="rounded-xl bg-white ring-1 ring-border/50 transition hover:ring-primary/30">
                  <div className="grid grid-cols-[1.5fr_1fr_0.9fr] items-center gap-2 p-2.5">
                    <button
                      onClick={() => onSelectCoin(c.id)}
                      className="flex min-w-0 items-center gap-2.5 text-left"
                      aria-label={`Trade ${c.symbol}`}
                    >
                      <CoinLogo src={c.image} symbol={c.symbol} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.symbol}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {c.name} · Vol {fmtCompact(c.volume)}
                        </span>
                      </span>
                    </button>
                    <button onClick={() => onSelectCoin(c.id)} className="min-w-0 text-right" aria-label={`Harga ${c.symbol}`}>
                      <span className="block text-sm font-semibold tabular-nums">{priceLabel(c.price)}</span>
                      <span className="block pt-0.5">
                        <Sparkline
                          data={c.sparkline}
                          up={c.change24h >= 0}
                          width={72}
                          height={22}
                          strokeWidth={1.3}
                          className="ml-auto"
                        />
                      </span>
                    </button>
                    <div className="flex items-center justify-end gap-1">
                      <ChangeBadge value={c.change24h} size="sm" className="min-w-[52px] justify-center" />
                      <button
                        onClick={() => onToggleFavorite(c.id)}
                        aria-label={fav ? `Hapus ${c.symbol} dari favorit` : `Tambah ${c.symbol} ke favorit`}
                        aria-pressed={fav}
                        className={cn(
                          "rounded-full p-1 transition active:scale-90",
                          fav ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"
                        )}
                      >
                        <Star className={cn("h-4 w-4", fav && "fill-amber-400")} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function priceLabel(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}
