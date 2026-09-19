"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Layers,
  LogOut,
  Repeat2,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CoinLogo } from "@/components/exchange/coin-logo";
import { BankCardSection } from "@/components/exchange/bank-card-section";
import type { AssetsResponse, PositionView, SessionUser, TradeView, WalletTxView } from "@/lib/types";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import { fmtIdr, fmtUsdt } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AssetsViewProps {
  user: SessionUser;
  assets: AssetsResponse | null;
  trades: TradeView[];
  transactions: WalletTxView[];
  openPositions: PositionView[];
  onDeposit: () => void;
  onWithdraw: () => void;
  onGoTrade: (coinId: string) => void;
  onGoContract: () => void;
  onLogout: () => void;
}

type AssetTab = "spot" | "kontrak" | "fiat" | "opsi";

const TABS: { key: AssetTab; label: string }[] = [
  { key: "spot", label: "Spot" },
  { key: "kontrak", label: "Kontrak" },
  { key: "fiat", label: "Spot Fiat" },
  { key: "opsi", label: "Opsi" },
];

/** Plain unit format like the reference app: 30771.464 / 0.0001 (no separators). */
function fmtUnit(n: number): string {
  if (!Number.isFinite(n)) return "0.0000";
  if (n === 0) return "0.0000";
  const abs = Math.abs(n);
  const raw = abs >= 1 ? n.toFixed(4) : abs >= 0.0001 ? n.toFixed(6) : n.toFixed(8);
  return raw.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function AssetsView({
  user,
  assets,
  trades,
  transactions,
  openPositions,
  onDeposit,
  onWithdraw,
  onGoTrade,
  onGoContract,
  onLogout,
}: AssetsViewProps) {
  const { toast } = useToast();
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState<AssetTab>("spot");
  const [hideZero, setHideZero] = useState(false);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const mask = (s: string) => (hidden ? "••••••" : s);

  const cash = assets?.cashUsd ?? user.cashUsd;
  const openMargin = openPositions.reduce((acc, p) => acc + p.marginUsd, 0);
  const total = (assets ? assets.totalUsd : user.cashUsd) + openMargin;
  const rate = assets?.usdIdrRate ?? 0;
  const idrText =
    rate > 0
      ? (total * rate).toLocaleString("id-ID", { maximumFractionDigits: 2 })
      : null;

  const q = query.trim().toLowerCase();
  const matchQ = (symbol: string, name: string) =>
    q === "" || symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q);

  const pendingTxs = transactions.filter((t) => t.status === "PENDING");

  // ===== Riwayat gabungan: trade spot + pengajuan dana (isi/tarik) =====
  interface HistoryItem {
    id: string;
    at: number;
    icon: React.ReactNode;
    iconCls: string;
    title: string;
    statusChip: { label: string; cls: string } | null;
    subtitle: string;
    reason: string | null;
    amountText: string;
    amountColor: string;
    meta: string;
  }

  const mergedHistory: HistoryItem[] = [
    ...trades.map<HistoryItem>((t) => ({
      id: `trade-${t.id}`,
      at: new Date(t.createdAt).getTime(),
      icon: t.side === "BUY" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />,
      iconCls: t.side === "BUY" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500",
      title: `${t.side === "BUY" ? "Beli" : "Jual"} ${t.symbol}`,
      statusChip: null,
      subtitle: fmtDateTime(t.createdAt),
      reason: null,
      amountText: fmtUsd(t.totalUsd),
      amountColor: "text-foreground",
      meta: `${fmtUnit(t.quantity)} ${t.symbol}`,
    })),
    ...transactions.map<HistoryItem>((t) => {
      const isDeposit = t.type === "DEPOSIT";
      const chip =
        t.status === "PENDING"
          ? { label: "Menunggu", cls: "bg-amber-50 text-amber-600" }
          : t.status === "REJECTED"
            ? { label: "Ditolak", cls: "bg-red-50 text-red-500" }
            : { label: "Berhasil", cls: "bg-emerald-50 text-emerald-600" };
      const hasIdr = t.amountIdr != null;
      return {
        id: `tx-${t.id}`,
        at: new Date(t.createdAt).getTime(),
        icon: isDeposit ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />,
        iconCls:
          t.status === "PENDING"
            ? "bg-amber-50 text-amber-500"
            : t.status === "REJECTED"
              ? "bg-red-50 text-red-500"
              : isDeposit
                ? "bg-emerald-50 text-emerald-600"
                : "bg-orange-50 text-orange-600",
        title: isDeposit ? "Isi Dana" : "Tarik Dana",
        statusChip: chip,
        subtitle: fmtDateTime(t.createdAt),
        reason: t.status === "REJECTED" ? t.reviewNote : null,
        amountText: hasIdr
          ? `${t.amountUsd >= 0 ? "+" : "-"}${fmtIdr(Math.abs(t.amountIdr))}`
          : `${t.amountUsd >= 0 ? "+" : ""}${fmtUsd(t.amountUsd)}`,
        amountColor: t.amountUsd >= 0 ? "text-emerald-600" : "text-red-500",
        meta: hasIdr ? `≈ ${fmtUsdt(Math.abs(t.amountUsd))}` : "USDT",
      };
    }),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 40);

  // ===== Spot rows: USDT (cash) + holdings =====
  const spotRows = [
    {
      key: "USDT",
      coinId: "tether",
      symbol: "USDT",
      name: "Tether",
      image: assets?.holdings.find((h) => h.symbol === "USDT")?.image ?? "",
      amount: cash,
      value: cash,
    },
    ...(assets?.holdings ?? []).map((h) => ({
      key: h.coinId,
      coinId: h.coinId,
      symbol: h.symbol,
      name: h.name,
      image: h.image,
      amount: h.amount,
      value: h.valueUsd,
    })),
  ].filter(
    (r) =>
      matchQ(r.symbol, r.name) &&
      (!hideZero || r.amount > 1e-9 || r.value > 1e-9)
  );

  // ===== Kontrak rows: open positions =====
  const contractRows = openPositions
    .map((p) => ({
      key: p.id,
      position: p,
      equity: p.marginUsd + (p.pnlUsd ?? 0),
    }))
    .filter(
      (r) =>
        matchQ(r.position.symbol, r.position.name) &&
        (!hideZero || r.position.marginUsd > 1e-9)
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2">
      <div className="hx-scroll flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
        {/* ===== Total asset card ===== */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-blue-500 p-5 text-white shadow-lg shadow-blue-600/25">
          <div className="pointer-events-none absolute -top-12 -right-10 h-40 w-40 rounded-full bg-blue-400/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-blue-300/20 blur-xl" />

          <div className="relative flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">Total Aset</span>
              <button
                onClick={() => setHidden((v) => !v)}
                aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
                className="rounded-full p-0.5 text-blue-100 transition hover:bg-white/10 hover:text-white"
              >
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-white py-1.5 pr-2 pl-3 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-blue-50 active:scale-[0.97]"
            >
              Riwayat Transaksi
              <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
            </button>
          </div>

          <p className="relative mt-3 text-[28px] leading-none font-bold tracking-tight tabular-nums">
            {mask(fmtUnit(total))}{" "}
            <span className="text-sm font-semibold text-blue-100">USDT</span>
          </p>
          {idrText !== null && (
            <p className="relative mt-2 text-xs text-blue-100/90 tabular-nums">
              ≈ {mask(idrText)} IDR
            </p>
          )}
        </section>

        {/* ===== Quick actions ===== */}
        <div className="mt-4 grid grid-cols-3 gap-1" role="group" aria-label="Aksi aset">
          <button
            onClick={onDeposit}
            className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition hover:bg-white active:scale-[0.97]"
          >
            <ArrowDownToLine className="h-6 w-6 text-slate-800" strokeWidth={1.8} />
            <span className="text-xs font-medium">Setor/Terima</span>
          </button>
          <button
            onClick={onWithdraw}
            className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition hover:bg-white active:scale-[0.97]"
          >
            <ArrowUpFromLine className="h-6 w-6 text-slate-800" strokeWidth={1.8} />
            <span className="text-xs font-medium">Tarik/Transfer</span>
          </button>
          <button
            onClick={() => toast({ title: "Transfer dana", description: "Fitur transfer antar-akun segera hadir. 😊" })}
            className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition hover:bg-white active:scale-[0.97]"
          >
            <Repeat2 className="h-6 w-6 text-slate-800" strokeWidth={1.8} />
            <span className="text-xs font-medium">Transfer dana</span>
          </button>
        </div>

        {/* ===== Kartu Bank (rekening & e-wallet pengguna) ===== */}
        <BankCardSection userId={user.id} defaultName={user.name} />

        {/* ===== Pengajuan dana menunggu persetujuan ===== */}
        {pendingTxs.length > 0 && (
          <button
            onClick={() => setHistoryOpen(true)}
            className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left transition hover:bg-amber-100/70"
            aria-label="Lihat riwayat pengajuan dana"
          >
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 text-[11px] leading-snug text-amber-700">
              <span className="font-bold">
                {pendingTxs.length} permintaan dana menunggu persetujuan admin
              </span>
              {" "}— saldo berubah setelah disetujui.
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-500" />
          </button>
        )}

        {/* ===== Tabs ===== */}
        <div className="mt-4 grid grid-cols-4 rounded-xl bg-muted p-1" role="tablist" aria-label="Kategori aset">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg py-2 text-xs font-semibold transition-all",
                tab === t.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== Filter row ===== */}
        {(tab === "spot" || tab === "kontrak") && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setHideZero((v) => !v)}
              aria-pressed={hideZero}
              className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              {hideZero ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              Sembunyikan saldo 0
            </button>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari"
                aria-label="Cari aset"
                className="h-9 w-32 rounded-full border-border/70 pr-3 pl-8 text-xs sm:w-40"
              />
            </div>
          </div>
        )}

        {/* ===== Spot list ===== */}
        {tab === "spot" && (
          <div className="mt-3 space-y-2">
            {spotRows.length === 0 ? (
              (assets?.holdings.length ?? 0) === 0 && cash < 1e-9 && q === "" ? (
                <EmptyBlock
                  icon={<Wallet className="h-5 w-5 text-muted-foreground/60" />}
                  title="Belum ada aset"
                  desc="Mulai trading spot untuk membangun portofolio Anda."
                  action={
                    <Button size="sm" className="mt-1 h-9 rounded-full px-5 text-xs font-bold" onClick={() => onGoTrade("bitcoin")}>
                      Trade Sekarang
                    </Button>
                  }
                />
              ) : (
                <EmptyBlock
                  icon={<Search className="h-5 w-5 text-muted-foreground/60" />}
                  title="Tidak ada hasil"
                  desc={q !== "" ? `Tidak ada aset yang cocok dengan "${query}".` : "Semua saldo disembunyikan."}
                />
              )
            ) : (
              <ul className="space-y-2">
                {spotRows.map((r) => (
                  <li key={r.key} className="rounded-xl bg-white ring-1 ring-border/60 transition hover:ring-primary/30">
                    <button
                      onClick={() => onGoTrade(r.coinId)}
                      className="w-full px-4 py-3 text-left"
                      aria-label={`Trade ${r.symbol}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CoinLogo src={r.image} symbol={r.symbol} size={26} />
                          <span className="text-sm font-bold">{r.symbol}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        <Col label="Tersedia" value={mask(fmtUnit(r.amount))} />
                        <Col label="Sedang terkunci" value={mask("0.0000")} />
                        <Col label="Konversi(USDT)" value={mask(fmtUnit(r.value))} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ===== Kontrak list ===== */}
        {tab === "kontrak" && (
          <div className="mt-3 space-y-2">
            {contractRows.length === 0 ? (
              <EmptyBlock
                icon={<Layers className="h-5 w-5 text-muted-foreground/60" />}
                title="Belum ada posisi kontrak"
                desc="Buka posisi kontrak leverage untuk mulai trading."
                action={
                  <Button size="sm" className="mt-1 h-9 rounded-full px-5 text-xs font-bold" onClick={onGoContract}>
                    Buka Kontrak
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {contractRows.map(({ key, position: p, equity }) => (
                  <li key={key} className="rounded-xl bg-white ring-1 ring-border/60 transition hover:ring-primary/30">
                    <button onClick={onGoContract} className="w-full px-4 py-3 text-left" aria-label={`Detail posisi ${p.symbol}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CoinLogo src={p.image} symbol={p.symbol} size={26} />
                          <span className="text-sm font-bold">{p.symbol}</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold",
                              p.side === "LONG" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                            )}
                          >
                            {p.side} {p.leverage}x
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold tabular-nums",
                              (p.pnlUsd ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"
                            )}
                          >
                            {fmtUsd(p.pnlUsd ?? 0, { sign: true })}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        <Col label="Tersedia" value={mask(fmtUnit(p.marginUsd))} />
                        <Col label="Sedang terkunci" value={mask("0.0000")} />
                        <Col label="Konversi(USDT)" value={mask(fmtUnit(equity))} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ===== Spot Fiat (soon) ===== */}
        {tab === "fiat" && (
          <EmptyBlock
            icon={<Wallet className="h-5 w-5 text-muted-foreground/60" />}
            title="Spot Fiat"
            desc="Aset fiat (IDR, USD) segera hadir."
          />
        )}

        {/* ===== Opsi (soon) ===== */}
        {tab === "opsi" && (
          <EmptyBlock
            icon={<Wallet className="h-5 w-5 text-muted-foreground/60" />}
            title="Opsi"
            desc="Trading opsi segera hadir."
          />
        )}

        {/* ===== logout ===== */}
        <div className="mt-4 pb-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="h-11 w-full rounded-xl border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" /> Keluar dari Akun
          </Button>
        </div>
      </div>

      {/* ===== Riwayat transaksi dialog ===== */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-sm font-bold">Riwayat Transaksi</DialogTitle>
          </DialogHeader>
          <div className="hx-scroll max-h-96 overflow-y-auto px-1 pb-2">
            {mergedHistory.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">Belum ada transaksi.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {mergedHistory.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          item.iconCls
                        )}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold">{item.title}</p>
                          {item.statusChip && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold",
                                item.statusChip.cls
                              )}
                            >
                              {item.statusChip.label}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
                        {item.reason && (
                          <p className="text-[10px] leading-snug text-red-500">Alasan: {item.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          item.amountColor
                        )}
                      >
                        {item.amountText}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{item.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 3-column value cell like the reference app. */
function Col({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyBlock({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-10 text-center ring-1 ring-border/60">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-[240px] text-xs text-muted-foreground">{desc}</p>
      {action}
    </div>
  );
}
