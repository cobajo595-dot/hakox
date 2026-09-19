"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { SessionUser } from "@/lib/types";
import { IDR_MAX_REQUEST, IDR_MIN_REQUEST, fmtIdr, fmtUsdt, formatIdrInput, parseIdr, roundUsdt } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface WalletDialogProps {
  open: boolean;
  action: "deposit" | "withdraw" | null;
  user: SessionUser;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Status Kata Sandi Penarikan pengguna (dari /api/security). */
type WdStatus = "loading" | "set" | "unset" | "unknown";

/**
 * Dialog pengajuan isi dana & tarik dana — DIJUMLAHKAN DALAM RUPIAH.
 * Pratinjau konversi ke USDT memakai kurs server; saldo baru berubah
 * (dalam USDT) setelah admin menyetujui pengajuan.
 * Tarik dana WAJIB Kata Sandi Penarikan (diatur di Pengaturan Keamanan).
 */
export function WalletDialog({ open, action, user, onOpenChange, onDone }: WalletDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(""); // teks terformat: "1.500.000"
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const rateFetched = useRef(false);
  const [wdStatus, setWdStatus] = useState<WdStatus>("loading");
  const [wdPassword, setWdPassword] = useState("");
  const [showWd, setShowWd] = useState(false);

  useEffect(() => {
    if (!open || rateFetched.current) return;
    rateFetched.current = true;
    fetch("/api/fx")
      .then((r) => r.json())
      .then((d: { rate?: number }) => {
        if (typeof d.rate === "number" && d.rate > 0) setRate(d.rate);
      })
      .catch(() => {});
  }, [open]);

  // Status Kata Sandi Penarikan dicek SETIAP kali dialog dibuka (bisa berubah).
  useEffect(() => {
    if (!open) return;
    setWdPassword("");
    setShowWd(false);
    setWdStatus("loading");
    let cancelled = false;
    fetch(`/api/security?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((d: { hasWithdrawalPassword?: boolean }) => {
        if (cancelled) return;
        setWdStatus(d.hasWithdrawalPassword ? "set" : "unset");
      })
      .catch(() => {
        if (!cancelled) setWdStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [open, user.id]);

  const isDeposit = action === "deposit";
  const amountNum = parseIdr(amount);
  const amountUsdt = rate !== null ? roundUsdt(amountNum / rate) : null;

  const submit = async () => {
    if (amountNum < IDR_MIN_REQUEST) {
      toast({ title: "Jumlah tidak valid", description: `Minimal ${fmtIdr(IDR_MIN_REQUEST)}.`, variant: "destructive" });
      return;
    }
    if (amountNum > IDR_MAX_REQUEST) {
      toast({ title: "Jumlah terlalu besar", description: `Maksimal ${fmtIdr(IDR_MAX_REQUEST)} per pengajuan.`, variant: "destructive" });
      return;
    }
    if (!isDeposit && rate !== null && amountNum / rate > user.cashUsd) {
      toast({ title: "Saldo tidak cukup", description: `Saldo tunai Anda ${fmtUsdt(user.cashUsd)}.`, variant: "destructive" });
      return;
    }
    if (!isDeposit && wdStatus !== "unset" && !wdPassword.trim()) {
      toast({ title: "Kata sandi penarikan wajib diisi", description: "Masukkan Kata Sandi Penarikan Anda.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isDeposit
            ? { userId: user.id, action, amountIdr: amountNum }
            : { userId: user.id, action, amountIdr: amountNum, withdrawalPassword: wdPassword.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: "Permintaan terkirim ✅",
        description: data.message ?? `${isDeposit ? "Isi dana" : "Tarik dana"} ${fmtIdr(amountNum)} menunggu persetujuan admin.`,
      });
      setAmount("");
      setWdPassword("");
      onOpenChange(false);
      onDone();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2.5rem)] rounded-2xl sm:max-w-sm" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="text-base">{isDeposit ? "Isi Dana" : "Tarik Dana"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isDeposit
              ? "Ajukan permintaan isi dana dalam rupiah — saldo bertambah dalam USDT setelah disetujui admin."
              : "Ajukan permintaan tarik dana dalam rupiah — diproses setelah disetujui admin."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-700">
            Semua permintaan dana direview admin terlebih dahulu. Saldo (USDT) hanya berubah setelah disetujui.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <div className="relative">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</span>
              <input
                autoFocus
                inputMode="numeric"
                type="text"
                value={amount}
                onChange={(e) => setAmount(formatIdrInput(e.target.value))}
                placeholder="0"
                aria-label="Jumlah dalam rupiah"
                className="h-12 w-full rounded-xl border border-border bg-muted/40 pr-3 pl-12 text-lg font-semibold tabular-nums outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {amountUsdt !== null && amountNum > 0 && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
                ≈ {fmtUsdt(amountUsdt)}
              </p>
            )}
          </div>
          {!isDeposit &&
            (wdStatus === "loading" ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ) : wdStatus === "unset" ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Anda belum mengatur <span className="font-bold">Kata Sandi Penarikan</span>. Atur dulu lewat menu akun
                  → <span className="font-bold">Pengaturan Keamanan</span> untuk bisa menarik dana.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="wd-password" className="text-xs font-semibold">
                  Kata Sandi Penarikan
                </label>
                <div className="relative">
                  <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="wd-password"
                    type={showWd ? "text" : "password"}
                    value={wdPassword}
                    onChange={(e) => setWdPassword(e.target.value)}
                    placeholder="Masukkan kata sandi penarikan"
                    autoComplete="off"
                    aria-label="Kata sandi penarikan"
                    className="h-11 w-full rounded-xl border border-border bg-muted/40 pr-10 pl-9 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWd((v) => !v)}
                    aria-label={showWd ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    {showWd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs">
            <span className="text-muted-foreground">Saldo tunai</span>
            <span className="flex flex-col items-end leading-tight">
              <span className="font-semibold tabular-nums">{fmtUsdt(user.cashUsd)}</span>
              {rate !== null && user.cashUsd > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  ≈ {fmtIdr(Math.floor(user.cashUsd * rate))}
                </span>
              )}
            </span>
          </div>
          {!isDeposit && amountUsdt !== null && amountNum > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs">
              <span className="text-muted-foreground">Sisa setelah tarik</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  user.cashUsd - amountUsdt < 0 && "text-red-500"
                )}
              >
                {fmtUsdt(user.cashUsd - amountUsdt)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={submit}
            disabled={
              busy ||
              amountNum < IDR_MIN_REQUEST ||
              (!isDeposit && (wdStatus === "loading" || wdStatus === "unset"))
            }
            className={cn(
              "flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition",
              isDeposit ? "bg-primary hover:bg-primary/90" : "bg-amber-500 hover:bg-amber-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isDeposit ? "Ajukan Isi Dana" : "Ajukan Tarik Dana"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
