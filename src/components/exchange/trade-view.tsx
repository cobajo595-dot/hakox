"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangeBadge } from "@/components/exchange/change-badge";
import { CoinLogo } from "@/components/exchange/coin-logo";
import { Sparkline } from "@/components/exchange/sparkline";
import { BinarySection } from "@/components/exchange/binary-section";
import { useToast } from "@/hooks/use-toast";
import type { Coin, SessionUser, TradeView } from "@/lib/types";
import { fmtCompact, fmtDateTime, fmtQty, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TradeViewProps {
  coins: Coin[];
  user: SessionUser;
  selectedCoinId: string;
  onSelectCoin: (coinId: string) => void;
  cashUsd: number;
  onTraded: () => void; // refresh assets/user
}

type Side = "BUY" | "SELL";
type TradeMode = "OPS" | "SPOT";

export function TradeView({ coins, user, selectedCoinId, onSelectCoin, cashUsd, onTraded }: TradeViewProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<TradeMode>("OPS");
  const [side, setSide] = useState<Side>("BUY");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [history, setHistory] = useState<TradeView[]>([]);

  const coin = useMemo(() => coins.find((c) => c.id === selectedCoinId) ?? coins[0], [coins, selectedCoinId]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/trade?userId=${user.id}&limit=10`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.trades as TradeView[]);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user.id]);

  const amountNum = Number(amount) || 0;
  const qty = coin && coin.price > 0 ? amountNum / coin.price : 0;

  const setPct = (pct: number) => {
    if (!coin) return;
    const base = side === "BUY" ? cashUsd : coin.price * holdingAmount;
    const val = base * pct;
    setAmount(val > 0 ? (Math.floor(val * 100) / 100).toString() : "");
  };

  // For SELL quick %, we need holding amount; fetch from assets endpoint lazily.
  const [holdingAmount, setHoldingAmount] = useState(0);
  useEffect(() => {
    if (!user.id || !coin) return;
    let alive = true;
    fetch(`/api/assets?userId=${user.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const h = (d.holdings as Array<{ coinId: string; amount: number }>).find((x) => x.coinId === coin.id);
        setHoldingAmount(h?.amount ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.id, coin?.id, onTraded]);
  const submit = async () => {
    if (!coin) return;
    if (!(amountNum > 0)) {
      toast({ title: "Jumlah tidak valid", description: "Masukkan jumlah dalam USD lebih dari 0.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          coinId: coin.id,
          symbol: coin.symbol,
          side,
          usdAmount: amountNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Order gagal", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: side === "BUY" ? "Pembelian berhasil ✅" : "Penjualan berhasil ✅",
        description: `${side === "BUY" ? "Membeli" : "Menjual"} ${fmtQty(data.quantity)} ${coin.symbol} @ ${fmtUsd(data.price)}`,
      });
      setAmount("");
      onTraded();
      loadHistory();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!coin) {
    return (
      <div className="flex items-center justify-center px-4 pt-20">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Memuat data pasar…</p>
        </div>
      </div>
    );
  }

  const up = coin.change24h >= 0;
  const chartData = coin.sparkline.length > 1 ? coin.sparkline : [coin.price * 0.99, coin.price];
  const minP = Math.min(...chartData);
  const maxP = Math.max(...chartData);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2">
      {/* coin picker */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-border/60 transition hover:ring-primary/40"
            aria-expanded={pickerOpen}
          >
            <span className="flex items-center gap-2.5">
              <CoinLogo src={coin.image} symbol={coin.symbol} size={30} />
              <span className="text-left">
                <span className="block text-sm font-bold">
                  {coin.symbol}<span className="text-muted-foreground">/USD</span>
                </span>
                <span className="block text-[10px] text-muted-foreground">{coin.name}</span>
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[calc(100%-2rem)] max-w-sm p-0">
          <div className="max-h-72 overflow-y-auto hx-scroll">
            {coins.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelectCoin(c.id);
                  setPickerOpen(false);
                  setAmount("");
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-muted/50",
                  c.id === coin.id && "bg-blue-50/60"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <CoinLogo src={c.image} symbol={c.symbol} size={26} />
                  <span>
                    <span className="block text-xs font-semibold">{c.symbol}/USD</span>
                    <span className="block text-[10px] text-muted-foreground">{c.name}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-medium tabular-nums">{fmtUsd(c.price)}</span>
                  {c.id === coin.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* mode switch: Opsi Naik/Turun atau Spot */}
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Mode perdagangan">
        {([
          { key: "OPS" as TradeMode, label: "Opsi Naik/Turun" },
          { key: "SPOT" as TradeMode, label: "Spot" },
        ]).map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "rounded-lg py-2 text-xs font-bold transition-all",
              mode === m.key
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="hx-scroll mt-3 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 258px)" }}>
        {/* price header */}
        <section className="rounded-xl bg-white p-4 ring-1 ring-border/60">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{fmtUsd(coin.price)}</span>
                <ChangeBadge value={coin.change24h} withIcon />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                24J Tinggi {fmtUsd(coin.high24h)} · Rendah {fmtUsd(coin.low24h)} · Vol {fmtCompact(coin.volume)}
              </p>
            </div>
          </div>

          {/* chart */}
          <div className="relative mt-3">
            <Sparkline data={chartData} up={up} width={340} height={130} strokeWidth={2} className="w-full" />
            <span className="absolute top-0 right-0 rounded bg-muted/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              7 HARI
            </span>
            <span className="absolute top-1 left-0 text-[9px] text-muted-foreground/70 tabular-nums">{fmtUsd(maxP)}</span>
            <span className="absolute bottom-1 left-0 text-[9px] text-muted-foreground/70 tabular-nums">{fmtUsd(minP)}</span>
          </div>
        </section>

        {mode === "OPS" && (
          <BinarySection coin={coin} user={user} cashUsd={cashUsd} onOrderChanged={onTraded} />
        )}

        {/* order form (spot) */}
        {mode === "SPOT" && (
        <section className="mt-3 rounded-xl bg-white p-4 ring-1 ring-border/60">
          {/* side tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Beli atau Jual">
            {(["BUY", "SELL"] as Side[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={side === s}
                onClick={() => {
                  setSide(s);
                  setAmount("");
                }}
                className={cn(
                  "rounded-lg py-2 text-sm font-bold transition-all",
                  side === s && s === "BUY" && "bg-emerald-500 text-white shadow-sm",
                  side === s && s === "SELL" && "bg-red-500 text-white shadow-sm",
                  side !== s && "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "BUY" ? "Beli" : "Jual"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-medium text-muted-foreground" htmlFor="trade-amount">
              Jumlah (USD)
            </label>
            <div className="relative mt-1.5">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
              <input
                id="trade-amount"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-12 w-full rounded-xl border border-border bg-muted/40 pr-3 pl-8 text-lg font-semibold tabular-nums outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <button
                  key={p}
                  onClick={() => setPct(p)}
                  className="rounded-lg bg-muted py-1.5 text-[11px] font-semibold text-foreground/70 transition hover:bg-accent active:scale-95"
                >
                  {p === 1 ? "Max" : `${p * 100}%`}
                </button>
              ))}
            </div>
            {side === "SELL" && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Saldo {coin.symbol}: {fmtQty(holdingAmount)} {coin.symbol} (≈ {fmtUsd(holdingAmount * coin.price)})
              </p>
            )}

            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Harga</dt>
                <dd className="font-medium tabular-nums">{fmtUsd(coin.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Kuantitas estimasi</dt>
                <dd className="font-medium tabular-nums">
                  {qty > 0 ? `${fmtQty(qty)} ${coin.symbol}` : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{side === "BUY" ? "Saldo USD tersedia" : "Proceeds estimasi"}</dt>
                <dd className="font-medium tabular-nums">
                  {side === "BUY" ? fmtUsd(cashUsd) : fmtUsd(amountNum)}
                </dd>
              </div>
            </dl>

            <Button
              onClick={submit}
              disabled={submitting || !(amountNum > 0)}
              className={cn(
                "mt-4 h-11 w-full rounded-xl text-sm font-bold text-white",
                side === "BUY" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : side === "BUY" ? `Beli ${coin.symbol}` : `Jual ${coin.symbol}`}
            </Button>
          </div>
        </section>
        )}

        {/* recent trades */}
        {mode === "SPOT" && (
        <section className="mt-3 rounded-xl bg-white ring-1 ring-border/60">
          <h2 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold">Riwayat Order Terakhir</h2>
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Belum ada order. Lakukan transaksi pertama Anda! 🚀
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {history.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
                        t.side === "BUY" ? "bg-emerald-500" : "bg-red-500"
                      )}
                    >
                      {t.side === "BUY" ? "BELI" : "JUAL"}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{t.symbol}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums">{fmtUsd(t.totalUsd)}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtQty(t.quantity)} @ {fmtUsd(t.price)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
