"use client";

import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BinaryOrderView } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BinaryOrderSheetProps {
  order: BinaryOrderView | null;
  /** Harga live koin order (fallback: entry price). */
  livePrice: number | null;
  /** Timestamp detik berjalan untuk countdown. */
  tick: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Sheet detail posisi opsi (meniru referensi): lingkaran besar berisi angka
 * mundur sesuai durasi yang dipilih, lalu saat trading selesai lingkaran
 * yang sama menampilkan profit/rugi aktual. Ditutup dengan tombol
 * "Lanjutkan Trading".
 */
export function BinaryOrderSheet({ order, livePrice, tick, open, onOpenChange }: BinaryOrderSheetProps) {
  if (!order) return null;

  const pending = order.status === "PENDING";
  const remMs = new Date(order.expiresAt).getTime() - tick;
  const secondsLeft = Math.max(0, Math.ceil(remMs / 1000));
  const currentPrice = pending ? (livePrice ?? order.entryPrice) : (order.resultPrice ?? order.entryPrice);

  // PnL aktual: saat berjalan = estimasi live (menang sementara / kalah sementara),
  // saat selesai = hasil final.
  const expectedProfit = (order.amountUsd * order.profitPct) / 100;
  const inTheMoney =
    order.direction === "UP" ? currentPrice > order.entryPrice : currentPrice < order.entryPrice;
  const outTheMoney =
    order.direction === "UP" ? currentPrice < order.entryPrice : currentPrice > order.entryPrice;

  let pnl = 0;
  let pnlLabel = "Profit & Rugi Aktual";
  if (pending) {
    if (remMs <= 0) pnl = 0;
    else pnl = inTheMoney ? expectedProfit : outTheMoney ? -order.amountUsd : 0;
  } else if (order.status === "WON") {
    pnl = (order.payoutUsd ?? 0) - order.amountUsd;
  } else if (order.status === "LOST") {
    pnl = -order.amountUsd;
  } else {
    pnl = 0; // DRAW — refund
  }

  // Tampilan lingkaran besar.
  const circle = (() => {
    if (pending && remMs > 0) {
      return {
        className: "bg-gradient-to-br from-rose-400 to-red-500 shadow-red-500/30",
        main: String(secondsLeft),
        sub: "DETIK LAGI",
      };
    }
    if (pending) {
      return {
        className: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30",
        main: "0",
        sub: "MENGHITUNG HASIL…",
      };
    }
    if (order.status === "WON") {
      return {
        className: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30",
        main: `+${pnl.toFixed(2)}`,
        sub: "PROFIT USDT",
      };
    }
    if (order.status === "LOST") {
      return {
        className: "bg-gradient-to-br from-rose-500 to-red-600 shadow-red-500/30",
        main: pnl.toFixed(2),
        sub: "RUGI USDT",
      };
    }
    return {
      className: "bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-500/30",
      main: "0.00",
      sub: "SERI · REFUND",
    };
  })();

  const pnlTone = pnl > 0 ? "text-emerald-600" : pnl < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="data-[state=open]:slide-in-from-bottom-8 bottom-0 top-auto left-1/2 max-w-full -translate-x-1/2 translate-y-0 rounded-b-none rounded-t-[28px] border-0 p-0 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:max-w-md"
      >
        <DialogTitle className="sr-only">
          Detail Opsi {order.symbol}/USDT
        </DialogTitle>
        <DialogDescription className="sr-only">
          {pending
            ? `Angka mundur ${fmtCountdown(remMs)} sebelum hasil keluar.`
            : `Hasil ${order.status === "WON" ? "menang" : order.status === "LOST" ? "kalah" : "seri"} ${pnl.toFixed(2)} USDT.`}
        </DialogDescription>

        {/* lingkaran countdown / profit */}
        <div className="flex flex-col items-center pt-8 pb-6">
          <div
            className={cn(
              "flex h-32 w-32 flex-col items-center justify-center rounded-full text-white shadow-lg transition-colors duration-500",
              circle.className
            )}
            role="status"
            aria-live="polite"
          >
            <span className="text-5xl leading-none font-light tracking-tight tabular-nums">
              {circle.main}
            </span>
            <span className="mt-1.5 max-w-28 text-center text-[9px] font-bold tracking-widest text-white/85">
              {circle.sub}
            </span>
          </div>
          {pending && remMs > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Selesai dalam {fmtCountdown(remMs)}
            </p>
          )}
          {!pending && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Trading selesai — hasil sudah masuk ke saldo Anda.
            </p>
          )}
        </div>

        {/* detail posisi */}
        <dl className="space-y-3 px-6 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Pasangan Perdagangan</dt>
            <dd className="font-extrabold">{order.symbol}/USDT</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Arah</dt>
            <dd
              className={cn(
                "flex items-center gap-1 font-extrabold",
                order.direction === "UP" ? "text-emerald-500" : "text-red-500"
              )}
            >
              {order.direction === "UP" ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {order.direction === "UP" ? "Beli Naik" : "Beli Turun"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Harga Pembelian</dt>
            <dd className="font-extrabold tabular-nums">{fmtUsd(order.entryPrice)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Harga Saat Ini</dt>
            <dd className="font-extrabold tabular-nums">{fmtUsd(currentPrice)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Jumlah Trading</dt>
            <dd className="font-extrabold tabular-nums">
              {order.amountUsd.toFixed(0)}USDT
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{pnlLabel}</dt>
            <dd className={cn("font-extrabold tabular-nums", pending ? "" : pnlTone)}>
              {pnl > 0 ? "+" : ""}
              {pnl.toFixed(2)}
            </dd>
          </div>
        </dl>

        {/* aksi */}
        <div className="px-6 pt-6">
          <button
            onClick={() => onOpenChange(false)}
            className="h-12 w-full rounded-xl bg-blue-500 text-sm font-extrabold tracking-wide text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-600 active:scale-[0.98]"
          >
            Lanjutkan Trading
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
