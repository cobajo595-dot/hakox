"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronRight,
  Clock,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BINARY_DURATIONS,
  MIN_BINARY_BET_USD,
} from "@/lib/types";
import type {
  BinaryDirection,
  BinaryListResponse,
  BinaryOrderView,
  Coin,
  SessionUser,
} from "@/lib/types";
import { fmtDateTime, fmtQty, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BinaryOrderSheet } from "@/components/exchange/binary-order-sheet";

interface BinarySectionProps {
  coin: Coin;
  user: SessionUser;
  cashUsd: number;
  onOrderChanged: () => void; // refresh saldo user global
}

function fmtIdr(usd: number, rate: number): string {
  return (usd * rate).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function remainingMs(expiresAt: string, now: number): number {
  return new Date(expiresAt).getTime() - now;
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Seksi trading opsi naik/turun (binary options) di menu Trade. */
export function BinarySection({ coin, user, cashUsd, onOrderChanged }: BinarySectionProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [direction, setDirection] = useState<BinaryDirection | null>(null);
  const [expiryMin, setExpiryMin] = useState(5);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<BinaryOrderView[]>([]);
  const [idrRate, setIdrRate] = useState(17660);
  const [tick, setTick] = useState(Date.now());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const prevStatusRef = useRef<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/binary?userId=${user.id}&limit=30`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as BinaryListResponse;
      setIdrRate(data.usdIdrRate || idrRate);
      setPrices(data.prices ?? {});
      // notifikasi saat order berubah status (menang/kalah/seri)
      for (const o of data.orders) {
        const prev = prevStatusRef.current[o.id];
        if (prev === "PENDING" && o.status !== "PENDING") {
          if (o.status === "WON") {
            toast({
              title: "Selamat, opsi Anda MENANG! 🎉",
              description: `${o.symbol} ${o.direction === "UP" ? "Naik" : "Turun"} · payout ${fmtUsd(o.payoutUsd ?? 0)}`,
            });
          } else if (o.status === "LOST") {
            toast({
              title: "Opsi kalah",
              description: `${o.symbol} ${o.direction === "UP" ? "Naik" : "Turun"} · stake ${fmtUsd(o.amountUsd)} hangus.`,
              variant: "destructive",
            });
          } else {
            toast({ title: "Opsi seri", description: `Stake ${fmtUsd(o.amountUsd)} dikembalikan.` });
          }
          onOrderChanged();
        }
        prevStatusRef.current[o.id] = o.status;
      }
      setOrders(data.orders);
    } catch {
      /* ignore */
    }
  }, [user.id, onOrderChanged, toast, idrRate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // polling status order tiap 3 detik + detik berjalan untuk countdown
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") loadOrders();
    }, 3000);
    const clock = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [loadOrders]);

  const active = orders.filter((o) => o.status === "PENDING");
  const history = orders.filter((o) => o.status !== "PENDING").slice(0, 10);

  // sheet detail posisi (lingkaran countdown → profit saat selesai)
  const detailOrder = detailOrderId ? orders.find((o) => o.id === detailOrderId) ?? null : null;
  const detailLivePrice = detailOrder
    ? prices[detailOrder.coinId] ?? (coin.id === detailOrder.coinId ? coin.price : null)
    : null;

  const amountNum = Number(amount) || 0;
  const selectedDur = BINARY_DURATIONS.find((d) => d.min === expiryMin) ?? BINARY_DURATIONS[0];
  const expectedProfit = amountNum > 0 ? (amountNum * selectedDur.pct) / 100 : 0;
  const amountInvalid = amountNum < MIN_BINARY_BET_USD;

  const openConfirm = (dir: BinaryDirection) => {
    setDirection(dir);
    setConfirmOpen(true);
  };

  const submit = async () => {
    if (!direction) return;
    if (amountInvalid) {
      toast({
        title: "Jumlah tidak valid",
        description: `Minimal ${MIN_BINARY_BET_USD.toFixed(2)} USDT.`,
        variant: "destructive",
      });
      return;
    }
    if (amountNum > cashUsd) {
      toast({
        title: "Saldo tidak cukup",
        description: `Saldo tunai Anda ${fmtUsd(cashUsd)}.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/binary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          coinId: coin.id,
          symbol: coin.symbol,
          direction,
          amountUsd: amountNum,
          expiryMin,
        }),
      });
      const data = (await res.json()) as { order?: BinaryOrderView; error?: string };
      if (!res.ok) {
        toast({ title: "Order gagal", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: "Order opsi dibuat ✅",
        description: `${direction === "UP" ? "Beli Naik" : "Beli Turun"} ${coin.symbol}/USDT · ${expiryMin} menit · ${fmtUsd(amountNum)}`,
      });
      setAmount("");
      setConfirmOpen(false);
      // Langsung tampilkan sheet detail posisi (countdown berjalan).
      if (data.order?.id) setDetailOrderId(data.order.id);
      onOrderChanged();
      loadOrders();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {/* tombol arah */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => openConfirm("UP")}
          className="group flex flex-col items-center gap-1 rounded-2xl bg-emerald-500 py-3 text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.98]"
        >
          <ArrowUpRight className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-xs font-extrabold tracking-wide">Beli Naik</span>
        </button>
        <button
          onClick={() => openConfirm("DOWN")}
          className="group flex flex-col items-center gap-1 rounded-2xl bg-red-500 py-3 text-white shadow-md shadow-red-500/25 transition hover:bg-red-600 active:scale-[0.98]"
        >
          <ArrowDownRight className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-xs font-extrabold tracking-wide">Beli Turun</span>
        </button>
      </section>

      {/* opsi berjalan */}
      <section className="rounded-xl bg-white ring-1 ring-border/60">
        <h2 className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-xs font-semibold">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          Opsi Berjalan
          {active.length > 0 && (
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              {active.length} aktif
            </span>
          )}
        </h2>
        {active.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Belum ada opsi berjalan. Pilih Beli Naik atau Beli Turun untuk memulai.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {active.map((o) => {
              const rem = remainingMs(o.expiresAt, tick);
              return (
                <li key={o.id} className="p-0">
                  <button
                    type="button"
                    onClick={() => setDetailOrderId(o.id)}
                    aria-label={`Detail opsi ${o.symbol} ${o.direction === "UP" ? "Naik" : "Turun"}`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
                            o.direction === "UP" ? "bg-emerald-500" : "bg-red-500"
                          )}
                        >
                          {o.direction === "UP" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {o.direction === "UP" ? "NAIK" : "TURUN"}
                        </span>
                        <span className="truncate text-xs font-semibold">{o.symbol}/USDT</span>
                        <span className="text-[10px] text-muted-foreground">· {o.expiryMin} mnt</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                        Entry {fmtUsd(o.entryPrice)} · Kini {fmtUsd(coin.id === o.coinId ? coin.price : prices[o.coinId] ?? o.entryPrice)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="text-right">
                        <p className="text-xs font-bold tabular-nums">{fmtUsd(o.amountUsd)}</p>
                        <p
                          className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            rem <= 0 ? "text-muted-foreground" : "text-amber-600"
                          )}
                        >
                          {rem <= 0 ? "Menunggu hasil…" : fmtCountdown(rem)}
                        </p>
                        <p className="text-[10px] text-emerald-600 tabular-nums">
                          +{fmtUsd((o.amountUsd * o.profitPct) / 100)} ({o.profitPct}%)
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* riwayat opsi */}
      <section className="rounded-xl bg-white ring-1 ring-border/60">
        <h2 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold">Riwayat Opsi</h2>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Belum ada hasil. Riwayat opsi akan muncul di sini.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {history.map((o) => (
              <li key={o.id} className="p-0">
                <button
                  type="button"
                  onClick={() => setDetailOrderId(o.id)}
                  aria-label={`Detail hasil opsi ${o.symbol} ${o.direction === "UP" ? "Naik" : "Turun"}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40 active:bg-muted/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
                          o.direction === "UP" ? "bg-emerald-500" : "bg-red-500"
                        )}
                      >
                        {o.direction === "UP" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {o.direction === "UP" ? "NAIK" : "TURUN"}
                      </span>
                      <span className="truncate text-xs font-semibold">{o.symbol}/USDT</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      {fmtQty(o.entryPrice)} → {fmtQty(o.resultPrice ?? o.entryPrice)} · {fmtDateTime(o.settledAt ?? o.expiresAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="text-right">
                      {o.status === "WON" && (
                        <>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">MENANG</span>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-emerald-600">+{fmtUsd((o.payoutUsd ?? 0) - o.amountUsd)}</p>
                        </>
                      )}
                      {o.status === "LOST" && (
                        <>
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">KALAH</span>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-red-500">-{fmtUsd(o.amountUsd)}</p>
                        </>
                      )}
                      {o.status === "DRAW" && (
                        <>
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">SERI</span>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-muted-foreground">Refund</p>
                        </>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== Dialog Konfirmasi Pesanan ===== */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[calc(100vw-2.5rem)] gap-3 rounded-2xl sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-center text-base">Konfirmasi Pesanan</DialogTitle>
            <DialogDescription className="sr-only">
              Periksa detail pesanan opsi sebelum konfirmasi.
            </DialogDescription>
          </DialogHeader>

          {/* ringkasan */}
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Pasangan Perdagangan</dt>
              <dd className="text-sm font-extrabold">{coin.symbol}/USDT</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Arah</dt>
              <dd
                className={cn(
                  "flex items-center gap-1 text-sm font-extrabold",
                  direction === "UP" ? "text-emerald-600" : "text-red-500"
                )}
              >
                {direction === "UP" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {direction === "UP" ? "Beli Naik" : "Beli Turun"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Harga Saat Ini</dt>
              <dd className="text-sm font-extrabold tabular-nums">{fmtUsd(coin.price)}</dd>
            </div>
          </dl>

          {/* waktu kedaluwarsa */}
          <div>
            <p className="text-xs font-semibold">Pilih Waktu Kedaluwarsa</p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Waktu kedaluwarsa">
              {BINARY_DURATIONS.map((d) => (
                <button
                  key={d.min}
                  onClick={() => setExpiryMin(d.min)}
                  aria-pressed={expiryMin === d.min}
                  className={cn(
                    "rounded-lg border px-1 py-2.5 text-[11px] font-semibold tabular-nums transition active:scale-95",
                    expiryMin === d.min
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-border text-foreground/70 hover:border-emerald-300"
                  )}
                >
                  {d.min}min | {d.pct.toFixed(2)}%
                </button>
              ))}
            </div>
          </div>

          {/* jumlah saldo */}
          <div>
            <label className="text-xs font-semibold" htmlFor="binary-amount">
              Jumlah saldo
            </label>
            <input
              id="binary-amount"
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-base font-semibold tabular-nums outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Jumlah pembelian minimum adalah{MIN_BINARY_BET_USD.toFixed(2)} USDT ≈{" "}
            {fmtIdr(MIN_BINARY_BET_USD, idrRate)} IDR
          </p>

          {/* estimasi */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-muted-foreground">Pendapatan Diperkirakan:</span>
              <span className="ml-auto font-bold tabular-nums text-emerald-600">
                {expectedProfit > 0 ? `${expectedProfit.toFixed(2)}USDT` : "0USDT"} ≈ {fmtIdr(expectedProfit, idrRate)} IDR
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-muted-foreground">Saldo Akun:</span>
              <span className="ml-auto font-bold tabular-nums">
                {cashUsd.toFixed(4)}USDT ≈ {fmtIdr(cashUsd, idrRate)} IDR
              </span>
            </div>
          </div>

          {/* aksi */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setConfirmOpen(false)}
              className="h-11 rounded-xl bg-muted text-sm font-bold text-muted-foreground transition hover:bg-accent active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={submitting || amountInvalid || amountNum > cashUsd}
              className="flex h-11 items-center justify-center rounded-xl bg-emerald-500 text-sm font-extrabold tracking-wide text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "KONFIRMASI"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Sheet detail posisi (lingkaran countdown → profit) ===== */}
      <BinaryOrderSheet
        order={detailOrder}
        livePrice={detailLivePrice}
        tick={tick}
        open={detailOrder !== null}
        onOpenChange={(v) => {
          if (!v) setDetailOrderId(null);
        }}
      />
    </div>
  );
}
