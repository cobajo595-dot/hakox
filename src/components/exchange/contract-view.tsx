"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CoinLogo } from "@/components/exchange/coin-logo";
import { useToast } from "@/hooks/use-toast";
import type { Coin, PositionView, SessionUser } from "@/lib/types";
import { fmtDateTime, fmtPct, fmtQty, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ContractViewProps {
  coins: Coin[];
  user: SessionUser;
  cashUsd: number;
  onPositionsChanged: () => void;
  onGoTrade: (coinId: string) => void;
}

type Side = "LONG" | "SHORT";

export function ContractView({ coins, user, cashUsd, onPositionsChanged, onGoTrade }: ContractViewProps) {
  const { toast } = useToast();
  const coin = useMemo(() => coins.find((c) => c.id === "bitcoin") ?? coins[0], [coins]);
  const [side, setSide] = useState<Side>("LONG");
  const [leverage, setLeverage] = useState(5);
  const [margin, setMargin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [closed, setClosed] = useState<PositionView[]>([]);
  const [realized, setRealized] = useState(0);
  const [live, setLive] = useState<Record<string, number>>({});
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = async () => {
    if (!user.id) return;
    try {
      const res = await fetch(`/api/positions?userId=${user.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPositions(data.open ?? []);
      setClosed(data.closed ?? []);
      setRealized(data.realizedPnlUsd ?? 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, [user.id]);

  // live mark prices for open positions
  useEffect(() => {
    if (!coin || positions.length === 0) return;
    setLive((prev) => ({ ...prev, [coin.id]: coin.price }));
  }, [coin, positions.length]);

  const openPositions = positions;

  const unrealized = (p: PositionView): number => {
    const mark = live[p.coinId] ?? p.entryPrice;
    const dir = p.side === "LONG" ? 1 : -1;
    return p.quantity * (mark - p.entryPrice) * dir;
  };

  const submit = async () => {
    if (!coin) return;
    const marginNum = Number(margin) || 0;
    if (!(marginNum >= 10)) {
      toast({ title: "Margin minimal $10", description: "Masukkan margin paling sedikit $10.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          coinId: coin.id,
          symbol: coin.symbol,
          side,
          leverage,
          marginUsd: marginNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal membuka posisi", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: `Posisi ${side === "LONG" ? "LONG" : "SHORT"} dibuka ✅`,
        description: `${coin.symbol} ${leverage}x · margin ${fmtUsd(marginNum)}`,
      });
      setMargin("");
      onPositionsChanged();
      load();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const close = async (p: PositionView) => {
    setClosingId(p.id);
    try {
      const res = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal menutup posisi", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: (data.pnlUsd ?? 0) >= 0 ? "Posisi ditutup dengan profit 🎉" : "Posisi ditutup dengan rugi",
        description: `PnL terealisasi: ${fmtUsd(data.pnlUsd ?? 0, { sign: true })}`,
      });
      onPositionsChanged();
      load();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  };

  if (!coin) {
    return (
      <div className="flex items-center justify-center pt-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat…
      </div>
    );
  }

  const marginNum = Number(margin) || 0;
  const qtyEst = marginNum > 0 && coin.price > 0 ? (marginNum * leverage) / coin.price : 0;
  const liqEst =
    coin.price > 0 ? (side === "LONG" ? coin.price * (1 - 1 / leverage) : coin.price * (1 + 1 / leverage)) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Kontrak Berjangka</h1>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
          USDⓈ-M
        </span>
      </header>

      <div className="hx-scroll mt-3 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 190px)" }}>
        {/* open form */}
        <section className="rounded-xl bg-white p-4 ring-1 ring-border/60">
          <div className="flex items-center justify-between">
            <button onClick={() => onGoTrade(coin.id)} className="flex items-center gap-2.5">
              <CoinLogo src={coin.image} symbol={coin.symbol} size={30} />
              <span className="text-left">
                <span className="block text-sm font-bold">
                  {coin.symbol}USDT <span className="font-medium text-muted-foreground">{leverage}x</span>
                </span>
                <span className="block text-[10px] text-muted-foreground tabular-nums">
                  Mark {fmtUsd(coin.price)} · 24J {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                </span>
              </span>
            </button>
          </div>

          {/* leverage */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Leverage</span>
              <span className="font-bold text-primary tabular-nums">{leverage}x</span>
            </div>
            <Slider
              value={[leverage]}
              onValueChange={([v]) => setLeverage(v)}
              min={1}
              max={20}
              step={1}
              className="mt-2.5"
              aria-label="Leverage"
            />
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
              <span>15x</span>
              <span>20x</span>
            </div>
          </div>

          {/* side */}
          <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Arah posisi">
            {(["LONG", "SHORT"] as Side[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={side === s}
                onClick={() => setSide(s)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition-all active:scale-[0.98]",
                  side === s && s === "LONG" && "border-emerald-500 bg-emerald-50 text-emerald-600",
                  side === s && s === "SHORT" && "border-red-500 bg-red-50 text-red-500",
                  side !== s && "border-border text-muted-foreground hover:border-muted-foreground/40"
                )}
              >
                {s === "LONG" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {s === "LONG" ? "Long / Naik" : "Short / Turun"}
              </button>
            ))}
          </div>

          {/* margin */}
          <div className="mt-4">
            <label htmlFor="margin-input" className="text-[11px] font-medium text-muted-foreground">
              Margin (USD)
            </label>
            <div className="relative mt-1.5">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
              <input
                id="margin-input"
                inputMode="decimal"
                type="number"
                min="10"
                step="any"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                placeholder="10.00"
                className="h-11 w-full rounded-xl border border-border bg-muted/40 pr-3 pl-8 text-base font-semibold tabular-nums outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[50, 100, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => setMargin(String(v))}
                  className="rounded-lg bg-muted py-1.5 text-[11px] font-semibold text-foreground/70 transition hover:bg-accent active:scale-95"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Kuantitas estimasi</dt>
              <dd className="font-medium tabular-nums">{qtyEst > 0 ? `${fmtQty(qtyEst)} ${coin.symbol}` : "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nilai posisi</dt>
              <dd className="font-medium tabular-nums">{fmtUsd(marginNum * leverage)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Harga likuidasi ≈</dt>
              <dd className="font-medium text-red-500 tabular-nums">{fmtUsd(liqEst)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Saldo USD</dt>
              <dd className="font-medium tabular-nums">{fmtUsd(cashUsd)}</dd>
            </div>
          </dl>

          <Button
            onClick={submit}
            disabled={submitting || marginNum < 10}
            className={cn(
              "mt-4 h-11 w-full rounded-xl text-sm font-bold text-white",
              side === "LONG" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Buka ${side === "LONG" ? "Long" : "Short"} ${coin.symbol} ${leverage}x`
            )}
          </Button>
        </section>

        {/* open positions */}
        <section className="mt-3">
          <h2 className="mb-2 text-xs font-semibold">Posisi Terbuka ({openPositions.length})</h2>
          {openPositions.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-8 text-center ring-1 ring-border/60">
              <p className="text-xs text-muted-foreground">
                Belum ada posisi terbuka. Pilih arah dan buka posisi pertama Anda!
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {openPositions.map((p) => {
                const pnl = unrealized(p);
                const pnlPct = (pnl / p.marginUsd) * 100;
                const mark = live[p.coinId] ?? p.entryPrice;
                return (
                  <li key={p.id} className="rounded-xl bg-white p-3.5 ring-1 ring-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CoinLogo src={p.image} symbol={p.symbol} size={28} />
                        <div>
                          <p className="text-xs font-bold">
                            {p.symbol}USDT
                            <span
                              className={cn(
                                "ml-1.5 rounded px-1 py-px text-[9px] font-bold text-white",
                                p.side === "LONG" ? "bg-emerald-500" : "bg-red-500"
                              )}
                            >
                              {p.side} {p.leverage}x
                            </span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDateTime(p.openedAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums", pnl >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {fmtUsd(pnl, { sign: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">ROE {fmtPct(pnlPct)}</p>
                      </div>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <dt className="text-muted-foreground">Margin</dt>
                        <dd className="font-semibold tabular-nums">{fmtUsd(p.marginUsd)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Entry → Mark</dt>
                        <dd className="font-semibold tabular-nums">
                          {fmtUsd(p.entryPrice)} → {fmtUsd(mark)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Kuantitas</dt>
                        <dd className="font-semibold tabular-nums">{fmtQty(p.quantity)}</dd>
                      </div>
                    </dl>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2.5 h-8 w-full rounded-lg text-xs font-semibold"
                      disabled={closingId === p.id}
                      onClick={() => close(p)}
                    >
                      {closingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Tutup Posisi"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* closed positions */}
        <section className="mt-4 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold">Riwayat Posisi</h2>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              Total realized:{" "}
              <span className={cn("font-bold", realized >= 0 ? "text-emerald-600" : "text-red-500")}>
                {fmtUsd(realized, { sign: true })}
              </span>
            </span>
          </div>
          {closed.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-6 text-center text-xs text-muted-foreground ring-1 ring-border/60">
              Belum ada posisi yang ditutup.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {closed.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-border/50">
                  <div className="flex items-center gap-2">
                    <X
                      className={cn(
                        "h-3.5 w-3.5 rounded-full p-0.5 text-white",
                        p.side === "LONG" ? "bg-emerald-500" : "bg-red-500"
                      )}
                    />
                    <div>
                      <p className="text-[11px] font-semibold">
                        {p.symbol} {p.side} {p.leverage}x
                      </p>
                      <p className="text-[9px] text-muted-foreground">{fmtDateTime(p.closedAt ?? p.openedAt)}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      (p.pnlUsd ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"
                    )}
                  >
                    {fmtUsd(p.pnlUsd ?? 0, { sign: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
