"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Clock,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/components/admin/admin-api";
import type { AdminStats } from "@/lib/types";
import { fmtCompact, fmtDateTime, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const TX_META: Record<string, { label: string; cls: string }> = {
  DEPOSIT: { label: "Setoran", cls: "bg-emerald-50 text-emerald-700" },
  WITHDRAW: { label: "Penarikan", cls: "bg-orange-50 text-orange-700" },
  TRADE_BUY: { label: "Beli", cls: "bg-blue-50 text-blue-700" },
  TRADE_SELL: { label: "Jual", cls: "bg-amber-50 text-amber-700" },
  CONTRACT_OPEN: { label: "Buka kontrak", cls: "bg-violet-50 text-violet-700" },
  CONTRACT_CLOSE: { label: "Tutup kontrak", cls: "bg-slate-100 text-slate-700" },
  BINARY_OPEN: { label: "Opsi naik/turun", cls: "bg-teal-50 text-teal-700" },
  BINARY_WIN: { label: "Opsi menang", cls: "bg-emerald-50 text-emerald-700" },
  BINARY_REFUND: { label: "Opsi refund", cls: "bg-amber-50 text-amber-700" },
  ADMIN_ADJUST: { label: "Admin", cls: "bg-red-50 text-red-700" },
};

interface Props {
  onAuthError: () => void;
  onOpenWallet?: () => void;
}

export function AdminDashboard({ onAuthError, onOpenWallet }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiJson<AdminStats>("/api/admin/stats")
      .then((d) => {
        if (alive) setStats(d);
      })
      .catch((err: Error) => {
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
          onAuthError();
          return;
        }
        toast({ title: "Gagal memuat", description: err.message, variant: "destructive" });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
     
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Total Pengguna",
      value: stats.userCount.toLocaleString("id-ID"),
      sub: `+${stats.newUsers7d} baru minggu ini`,
      icon: <Users className="h-4 w-4" />,
      cls: "text-blue-600 bg-blue-50",
    },
    {
      label: "Total Trade",
      value: stats.tradeCount.toLocaleString("id-ID"),
      sub: `Volume ${fmtCompact(stats.tradeVolumeUsd)}`,
      icon: <ArrowLeftRight className="h-4 w-4" />,
      cls: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Posisi Terbuka",
      value: stats.openPositions.toLocaleString("id-ID"),
      sub: `Margin ${fmtUsd(stats.openMarginUsd)}`,
      icon: <Target className="h-4 w-4" />,
      cls: "text-violet-600 bg-violet-50",
    },
    {
      label: "Ekuitas Pengguna",
      value: fmtUsd(stats.platformEquityUsd),
      sub: `Tunai ${fmtCompact(stats.platformCashUsd)}`,
      icon: <Wallet className="h-4 w-4" />,
      cls: "text-amber-600 bg-amber-50",
    },
  ];

  const maxTopVol = stats.topCoins[0]?.volume ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <section aria-label="Statistik utama" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-muted-foreground">{k.label}</p>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", k.cls)}>
                  {k.icon}
                </span>
              </div>
              <p className="mt-2 truncate text-lg font-bold tracking-tight sm:text-xl">{k.value}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Pending deposit/withdraw requests alert */}
      {stats.pendingWalletCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Clock className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-amber-800">
              {stats.pendingWalletCount} permintaan dana menunggu persetujuan
            </p>
            <p className="text-[11px] text-amber-700/80">
              Saldo pengguna hanya berubah setelah Anda menyetujui permintaan.
            </p>
          </div>
          {onOpenWallet && (
            <Button
              size="sm"
              className="h-8 shrink-0 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600"
              onClick={onOpenWallet}
            >
              Tinjau
            </Button>
          )}
        </div>
      )}

      {/* Deposit / withdraw mini cards */}
      <section className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowDownToLine className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Setoran</p>
              <p className="truncate text-base font-bold text-emerald-600">{fmtUsd(stats.depositUsd)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <ArrowUpFromLine className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Penarikan</p>
              <p className="truncate text-base font-bold text-orange-600">{fmtUsd(Math.abs(stats.withdrawUsd))}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Volume chart */}
        <Card className="rounded-2xl border-border/60 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Volume Trade 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.tradesPerDay} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} width={40} />
                <Tooltip
                  formatter={(v: number | string, name: string) =>
                    name === "volume" ? [fmtUsd(Number(v)), "Volume"] : [String(v), "Order"]
                  }
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="volume" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top coins */}
        <Card className="rounded-2xl border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-blue-600" /> Koin Terpopuler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topCoins.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Belum ada trade.</p>
            )}
            {stats.topCoins.map((c, i) => (
              <div key={c.symbol}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    <span className="mr-1.5 text-muted-foreground">#{i + 1}</span>
                    {c.symbol}
                  </span>
                  <span className="text-muted-foreground">
                    {fmtCompact(c.volume)} · {c.count}x
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                    style={{ width: `${Math.max((c.volume / maxTopVol) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.recentTx.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Belum ada transaksi. Coba lakukan trade di aplikasi.
            </p>
          )}
          {stats.recentTx.map((t) => {
            const meta = TX_META[t.type] ?? { label: t.type, cls: "bg-muted text-muted-foreground" };
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold", meta.cls)}>
                    {meta.label}
                  </span>
                  {t.status === "PENDING" && (
                    <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      Menunggu
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{t.userName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {t.note ?? "—"} · {fmtDateTime(t.createdAt)}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-xs font-bold",
                    t.amountUsd >= 0 ? "text-emerald-600" : "text-red-500"
                  )}
                >
                  {t.amountUsd >= 0 ? "+" : ""}
                  {fmtUsd(t.amountUsd)}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
