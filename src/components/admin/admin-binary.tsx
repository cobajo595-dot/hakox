"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, RefreshCw, SlidersHorizontal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/components/admin/admin-api";
import type {
  AdminBinaryResponse,
  AdminBinaryRow,
  BinaryControlMode,
} from "@/lib/types";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

const MODE_LABEL: Record<BinaryControlMode, string> = {
  AUTO: "Otomatis",
  UP: "Naik",
  DOWN: "Turun",
};

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function DirectionBadge({ dir }: { dir: "UP" | "DOWN" }) {
  return (
    <Badge
      className={cn(
        "gap-0.5 px-2 py-0.5 text-[10px] font-bold",
        dir === "UP" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      )}
    >
      {dir === "UP" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {dir === "UP" ? "NAIK" : "TURUN"}
    </Badge>
  );
}

function StatusBadge({ row: o }: { row: AdminBinaryRow }) {
  if (o.status === "WON") return <Badge className="bg-emerald-50 text-emerald-700">MENANG</Badge>;
  if (o.status === "LOST") return <Badge className="bg-red-50 text-red-600">KALAH</Badge>;
  if (o.status === "DRAW") return <Badge className="bg-amber-50 text-amber-700">SERI</Badge>;
  return (
    <Badge className="bg-blue-50 text-blue-700">
      BERJALAN{o.forceResult === "WIN" ? " · DIPAKSA MENANG" : o.forceResult === "LOSE" ? " · DIPAKSA KALAH" : ""}
    </Badge>
  );
}

/** Tab kontrol trading opsi naik/turun: kontrol arah harga + paksa hasil pesanan. */
export function AdminBinary({ onAuthError }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<AdminBinaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());
  const dataRef = useRef<AdminBinaryResponse | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const d = await apiJson<AdminBinaryResponse>("/api/admin/binary");
        setData(d);
        dataRef.current = d;
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 401) {
          onAuthError();
          return;
        }
        if (!silent) toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onAuthError, toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  // polling ringan 5 detik (data) + detik berjalan (countdown)
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState !== "hidden") load(true);
    }, 5000);
    const clock = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const act = async (
    body: Record<string, unknown>,
    okTitle: string,
    okDesc: string,
    busyKey: string
  ) => {
    setBusyId(busyKey);
    try {
      await apiJson("/api/admin/binary", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast({ title: okTitle, description: okDesc });
      await load(true);
    } catch (err) {
      const e = err as { status?: number; message: string };
      if (e.status === 401) {
        onAuthError();
        return;
      }
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const setMode = (symbol: string, mode: BinaryControlMode) => {
    const current = data?.controls[symbol] ?? "AUTO";
    if (current === mode) return;
    act(
      { action: "setMode", symbol, mode },
      "Kontrol diperbarui",
      `${symbol}: ${MODE_LABEL[mode]}`,
      `mode-${symbol}`
    );
  };

  const forceSettle = (o: AdminBinaryRow, outcome: "WIN" | "LOSE" | "AUTO") => {
    const label =
      outcome === "WIN" ? "Paksa MENANG" : outcome === "LOSE" ? "Paksa KALAH" : "Setel otomatis";
    act(
      { action: "forceSettle", orderId: o.id, outcome },
      `${label} berhasil`,
      `${o.userEmail} · ${o.symbol} ${o.direction === "UP" ? "Naik" : "Turun"} ${fmtUsd(o.amountUsd)}`,
      o.id
    );
  };

  const controls = data?.controls ?? {};
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Kontrol Trading Opsi</h2>
          <p className="text-xs text-muted-foreground">
            Atur arah naik/turun hasil opsi pengguna &amp; paksa hasil pesanan
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </Button>
      </div>

      {/* statistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Opsi berjalan", value: stats ? String(stats.pendingCount) : "…", cls: "text-foreground" },
          { label: "Total stake berjalan", value: stats ? fmtUsd(stats.pendingStakeUsd) : "…", cls: "text-foreground" },
          { label: "Menang / Kalah 24 jam", value: stats ? `${stats.wonCount24h} / ${stats.lostCount24h}` : "…", cls: "text-foreground" },
          {
            label: "PnL platform 24 jam",
            value: stats ? fmtUsd(stats.platformPnl24h, { sign: true }) : "…",
            cls: stats && stats.platformPnl24h >= 0 ? "text-emerald-600" : "text-red-600",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 text-lg font-extrabold tabular-nums", s.cls)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* kontrol arah harga */}
      <section className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold">Kontrol Arah Harga (Naik/Turun)</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-emerald-600">Naik</span> = semua opsi arah NAIK otomatis menang saat
              settle · <span className="font-semibold text-red-600">Turun</span> = opsi arah TURUN yang menang ·{" "}
              <span className="font-semibold">Otomatis</span> = mengikuti harga pasar nyata.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.coins ?? []).map((c) => {
            const mode = controls[c.symbol] ?? "AUTO";
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-slate-50/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold">
                    {c.symbol}<span className="text-muted-foreground">/USDT</span>
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground tabular-nums">{fmtUsd(c.price)}</p>
                </div>
                <div className="flex shrink-0 gap-1" role="group" aria-label={`Kontrol arah ${c.symbol}`}>
                  {(["AUTO", "UP", "DOWN"] as BinaryControlMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(c.symbol, m)}
                      aria-pressed={mode === m}
                      disabled={busyId === `mode-${c.symbol}`}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition active:scale-95 disabled:opacity-50",
                        mode === m
                          ? m === "UP"
                            ? "bg-emerald-500 text-white shadow-sm"
                            : m === "DOWN"
                              ? "bg-red-500 text-white shadow-sm"
                              : "bg-slate-700 text-white shadow-sm"
                          : "bg-white text-muted-foreground ring-1 ring-border hover:text-foreground"
                      )}
                    >
                      {m === "AUTO" ? "Auto" : m === "UP" ? "Naik" : "Turun"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!data && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      </section>

      {/* pesanan opsi berjalan */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Zap className="h-4 w-4 text-amber-500" />
            Pesanan Opsi Berjalan
            {stats && stats.pendingCount > 0 && (
              <Badge className="bg-amber-50 text-amber-700">{stats.pendingCount}</Badge>
            )}
          </h3>
          <p className="hidden text-[10px] text-muted-foreground sm:block">
            Auto-refresh 5 detik · settle otomatis saat kedaluwarsa
          </p>
        </div>
        <div className="max-h-[46vh] overflow-auto hx-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead className="text-center">Arah</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Entry</TableHead>
                <TableHead className="text-right">Stake</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Sisa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data && (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              )}
              {data && data.pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                    Tidak ada pesanan opsi berjalan.
                  </TableCell>
                </TableRow>
              )}
              {data?.pending.map((o) => {
                const rem = new Date(o.expiresAt).getTime() - tick;
                const busy = busyId === o.id;
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <p className="truncate text-xs font-semibold">{o.userName || "—"}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{o.userEmail}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <DirectionBadge dir={o.direction} />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {o.symbol} · {o.expiryMin}m · +{o.profitPct}%
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                      {fmtUsd(o.entryPrice)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold tabular-nums">
                      {fmtUsd(o.amountUsd)}
                      <p className="text-[10px] font-normal text-muted-foreground">
                        payout {fmtUsd(o.amountUsd * (1 + o.profitPct / 100))}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-center sm:table-cell">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                          rem <= 0 ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-600"
                        )}
                      >
                        {rem <= 0 ? "Settle…" : fmtCountdown(rem)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          className="h-7 gap-1 rounded-lg bg-emerald-500 px-2 text-[10px] font-bold text-white hover:bg-emerald-600"
                          disabled={busy}
                          onClick={() => forceSettle(o, "WIN")}
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Menang"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 rounded-lg bg-red-500 px-2 text-[10px] font-bold text-white hover:bg-red-600"
                          disabled={busy}
                          onClick={() => forceSettle(o, "LOSE")}
                        >
                          Kalah
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-[10px] font-bold"
                          disabled={busy}
                          onClick={() => forceSettle(o, "AUTO")}
                        >
                          Auto
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* riwayat opsi */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-bold">Riwayat Opsi Terakhir</h3>
        </div>
        <div className="max-h-[40vh] overflow-auto hx-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead className="text-center">Arah</TableHead>
                <TableHead className="text-center">Hasil</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Entry → Hasil</TableHead>
                <TableHead className="text-right">Stake</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Payout</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    Belum ada opsi yang selesai.
                  </TableCell>
                </TableRow>
              )}
              {data?.recent.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <p className="truncate text-xs font-semibold">{o.userName || "—"}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{o.userEmail}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <DirectionBadge dir={o.direction} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{o.symbol} · {o.expiryMin}m</p>
                  </TableCell>
                  <TableCell className="text-center"><StatusBadge row={o} /></TableCell>
                  <TableCell className="hidden text-right text-[11px] tabular-nums sm:table-cell">
                    {fmtUsd(o.entryPrice)} → {fmtUsd(o.resultPrice ?? o.entryPrice)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold tabular-nums">{fmtUsd(o.amountUsd)}</TableCell>
                  <TableCell
                    className={cn(
                      "hidden text-right text-xs font-bold tabular-nums sm:table-cell",
                      o.status === "WON" && "text-emerald-600",
                      o.status === "LOST" && "text-red-500"
                    )}
                  >
                    {o.status === "LOST" ? fmtUsd(0) : fmtUsd(o.payoutUsd ?? 0)}
                  </TableCell>
                  <TableCell className="hidden text-right text-[10px] text-muted-foreground sm:table-cell">
                    {fmtDateTime(o.settledAt ?? o.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
