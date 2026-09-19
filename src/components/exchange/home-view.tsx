"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Bell,
  Crown,
  FileCode2,
  Globe,
  Headphones,
  Image as ImageIcon,
  LogOut,
  Megaphone,
  PartyPopper,
  Rocket,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BannerCarousel } from "@/components/exchange/banner-carousel";
import { ChangeBadge } from "@/components/exchange/change-badge";
import { CoinLogo } from "@/components/exchange/coin-logo";
import { LanguageDialog, getLangNative } from "@/components/exchange/language-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Coin, KycStatus, SessionUser } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HomeViewProps {
  user: SessionUser;
  coins: Coin[];
  loading: boolean;
  kycStatus?: KycStatus | null;
  chatUnread: number;
  onGoTrade: (coinId: string) => void;
  onGoMarket: (query?: string) => void;
  onGoAssets: () => void;
  onOpenProfile: () => void;
  onOpenSecurity: () => void;
  onOpenChat: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onLogout: () => void;
}

interface QuickAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function HomeView({
  user,
  coins,
  loading,
  kycStatus,
  chatUnread,
  onGoTrade,
  onGoMarket,
  onGoAssets,
  onOpenProfile,
  onOpenSecurity,
  onOpenChat,
  onDeposit,
  onWithdraw,
  onLogout,
}: HomeViewProps) {
  const { toast } = useToast();
  const [tickerIdx, setTickerIdx] = useState(0);
  const [notices, setNotices] = useState<{ id: string; content: string }[]>([]);
  const [noticeIdx, setNoticeIdx] = useState(0);
  const [langOpen, setLangOpen] = useState(false);

  // muat pengumuman admin
  useEffect(() => {
    let alive = true;
    fetch("/api/notices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notices: [] }))
      .then((d: { notices?: { id: string; content: string }[] }) => {
        if (alive && Array.isArray(d.notices)) setNotices(d.notices);
      })
      .catch(() => {
        /* abaikan — ticker tetap berjalan tanpa pengumuman */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (notices.length === 0) return;
    const t = setInterval(() => setNoticeIdx((i) => (i + 1) % notices.length), 4000);
    return () => clearInterval(t);
  }, [notices.length]);

  const movers = useMemo(() => {
    if (coins.length === 0) return [];
    const sorted = [...coins].sort((a, b) => b.change24h - a.change24h);
    const top = sorted.slice(0, 3);
    const bottom = sorted.slice(-2).reverse();
    return [...top, ...bottom].map((c) => ({
      id: c.id,
      text: `${c.symbol} ${c.change24h >= 0 ? "naik" : "turun"} ${Math.abs(c.change24h).toFixed(2)}%`,
      up: c.change24h >= 0,
    }));
  }, [coins]);

  useEffect(() => {
    if (movers.length === 0) return;
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % movers.length), 4000);
    return () => clearInterval(t);
  }, [movers.length]);

  const hotCoins = useMemo(() => coins.slice(0, 6), [coins]);
  const current = movers[tickerIdx % Math.max(movers.length, 1)];

  const actions: QuickAction[] = [
    {
      key: "deposit",
      label: "Isi Dana",
      icon: <ArrowDownToLine className="h-6 w-6" />,
      onClick: onDeposit,
    },
    {
      key: "withdraw",
      label: "Tarik Dana",
      icon: <ArrowUpFromLine className="h-6 w-6" />,
      onClick: onWithdraw,
    },
    { key: "ieo", label: "IEO", icon: <Rocket className="h-6 w-6" />, onClick: () => showSoon("IEO") },
    {
      key: "sc",
      label: "Smart Contract",
      icon: <FileCode2 className="h-6 w-6" />,
      onClick: () => showSoon("Smart Contract"),
    },
    { key: "vip", label: "VIP", icon: <Crown className="h-6 w-6" />, onClick: () => showSoon("VIP") },
    {
      key: "invite",
      label: "Undang",
      icon: <PartyPopper className="h-6 w-6" />,
      onClick: () => showSoon("Undang Teman"),
    },
    { key: "nft", label: "NFT", icon: <ImageIcon className="h-6 w-6" />, onClick: () => showSoon("NFT") },
  ];

  const showSoon = (feature: string) =>
    toast({
      title: `${feature} — Segera Hadir`,
      description: "Fitur ini masih dalam pengembangan. 😊",
    });

  return (
    <div className="px-4 pt-3">
      {/* ===== Top bar ===== */}
      <header className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Menu akun"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{user.name || "Trader"}</span>
                {kycStatus === "APPROVED" && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                    <BadgeCheck className="h-3 w-3" /> Terverifikasi
                  </span>
                )}
              </div>
              <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
              {kycStatus === "PENDING" && (
                <div className="mt-1 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                  KYC: Menunggu tinjauan
                </div>
              )}
              {kycStatus === "REJECTED" && (
                <div className="mt-1 inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                  KYC: Ditolak — ajukan ulang
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenProfile}>
              <UserRound className="mr-2 h-4 w-4" /> Profil &amp; KYC
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGoAssets}>
              <Wallet className="mr-2 h-4 w-4" /> Aset Saya
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSecurity}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Pengaturan Keamanan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLangOpen(true)}>
              <Globe className="mr-2 h-4 w-4" /> Bahasa: {getLangNative()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-500 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => onGoMarket()}
          className="flex h-9 flex-1 items-center gap-2 rounded-full bg-muted px-3.5 text-sm text-muted-foreground transition hover:bg-accent"
          aria-label="Cari mata uang"
        >
          <Search className="h-4 w-4" />
          <span>Cari koin…</span>
        </button>

        <button
          aria-label="Layanan pelanggan — buka live chat"
          className="relative shrink-0 text-foreground/70 transition hover:text-foreground"
          onClick={onOpenChat}
        >
          <Headphones className="h-5 w-5" />
          {chatUnread > 0 && (
            <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {chatUnread > 9 ? "9+" : chatUnread}
            </span>
          )}
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Notifikasi" className="relative shrink-0 text-foreground/70 transition hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b px-3 py-2 text-xs font-semibold">Notifikasi</div>
            <ul className="divide-y text-xs">
              <li className="px-3 py-2.5">
                <p className="font-medium">Selamat datang di HakoX 👋</p>
                <p className="mt-0.5 text-muted-foreground">Ajukan Isi Dana di halaman Aset untuk mengisi saldo Anda.</p>
              </li>
              <li className="px-3 py-2.5">
                <p className="font-medium">Tips keamanan</p>
                <p className="mt-0.5 text-muted-foreground">Jangan bagikan kata sandi kepada siapa pun.</p>
              </li>
            </ul>
          </PopoverContent>
        </Popover>

        <button
          aria-label="Bahasa — pilih bahasa tampilan"
          className="shrink-0 text-foreground/70 transition hover:text-foreground"
          onClick={() => setLangOpen(true)}
        >
          <Globe className="h-5 w-5" />
        </button>
      </header>

      {/* ===== Banner ===== */}
      <section className="mt-3">
        <BannerCarousel onExplore={() => onGoMarket()} />
      </section>

      {/* ===== Announcement (dari admin) ===== */}
      {notices.length > 0 && (
        <section className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50/70 px-2 py-2 ring-1 ring-blue-100">
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />
          <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
            <p
              key={notices[noticeIdx % notices.length].id + noticeIdx}
              className="hx-ticker-item absolute inset-0 flex items-center truncate text-xs font-semibold text-blue-700"
            >
              {notices[noticeIdx % notices.length].content}
            </p>
          </div>
        </section>
      )}

      {/* ===== Notice ticker ===== */}
      <section className="mt-3 flex items-center justify-between rounded-lg bg-white px-2 py-2 ring-1 ring-border/60">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-base" aria-hidden>
            🎁
          </span>
          <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
            {current && (
              <button
                key={current.id + tickerIdx}
                onClick={() => onGoTrade(current.id)}
                className={cn(
                  "hx-ticker-item absolute inset-0 flex items-center truncate text-xs font-semibold",
                  current.up ? "text-emerald-600" : "text-red-500"
                )}
              >
                {current.text}
              </button>
            )}
            {movers.length === 0 && (
              <span className="absolute inset-0 flex items-center text-xs text-muted-foreground">Memuat pasar…</span>
            )}
          </div>
        </div>
        <button
          aria-label="Lihat daftar pasar"
          onClick={() => onGoMarket()}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </section>

      {/* ===== Quick actions ===== */}
      <section className="mt-3 rounded-xl bg-white p-4 ring-1 ring-border/60">
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              className="group flex flex-col items-center gap-1.5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-primary transition-all group-hover:bg-blue-100 group-active:scale-90">
                {a.icon}
              </span>
              <span className="text-center text-[11px] leading-tight font-medium text-foreground/80">
                {a.label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        </div>
      </section>

      {/* ===== Hot coins ===== */}
      <section className="mt-3 mb-2 rounded-xl bg-white ring-1 ring-border/60">
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr] gap-2 border-b border-border/60 px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
          <span>Pasangan</span>
          <span className="text-right">Harga Terakhir</span>
          <span className="text-right">24J %</span>
        </div>
        {loading && hotCoins.length === 0 ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-14 animate-pulse rounded bg-muted" />
                <div className="h-6 w-14 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {hotCoins.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onGoTrade(c.id)}
                  className="grid w-full grid-cols-[1.4fr_1fr_0.9fr] items-center gap-2 px-4 py-2.5 text-left transition hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CoinLogo src={c.image} symbol={c.symbol} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.symbol}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        Vol {fmtUsd(c.volume, { forceDecimals: 0 })}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums">{fmtUsd(c.price)}</span>
                  <span className="flex justify-end">
                    <ChangeBadge value={c.change24h} size="sm" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="p-2.5">
          <button
            onClick={() => onGoMarket()}
            className="w-full rounded-lg bg-muted/60 py-2 text-xs font-semibold text-primary transition hover:bg-muted"
          >
            Lihat semua pasar →
          </button>
        </div>
      </section>

      <LanguageDialog open={langOpen} onOpenChange={setLangOpen} />
    </div>
  );
}
