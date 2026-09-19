"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/exchange/bottom-nav";
import { LoginView } from "@/components/exchange/login-view";
import { HomeView } from "@/components/exchange/home-view";
import { MarketView } from "@/components/exchange/market-view";
import { TradeView } from "@/components/exchange/trade-view";
import { ContractView } from "@/components/exchange/contract-view";
import { AssetsView } from "@/components/exchange/assets-view";
import { ProfileDialog } from "@/components/exchange/profile-dialog";
import { SecurityDialog } from "@/components/exchange/security-dialog";
import { WalletDialog } from "@/components/exchange/wallet-dialog";
import { LiveChatDialog } from "@/components/exchange/live-chat-dialog";
import { useMarket } from "@/hooks/use-market";
import { useLiveChat } from "@/hooks/use-live-chat";
import { useToast } from "@/hooks/use-toast";
import type {
  AssetsResponse,
  KycStatus,
  PositionView,
  SessionUser,
  TabKey,
  TradeView,
} from "@/lib/types";

const STORAGE_KEY = "hakox_session_user";
const GUEST_KEY = "hakox_guest_chat";

interface GuestIdentity {
  id: string;
  name: string;
}

/** Identitas tamu untuk live chat sebelum login (persisten per perangkat). */
function loadOrCreateGuest(): GuestIdentity {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestIdentity;
      if (parsed?.id?.startsWith("guest-")) return parsed;
    }
  } catch {
    /* ignore */
  }
  const id = `guest-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const num = Math.floor(1000 + Math.random() * 9000);
  const guest = { id, name: `Tamu ${num}` };
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {
    /* ignore */
  }
  return guest;
}

export default function Page() {
  const { toast } = useToast();
  const market = useMarket(15000);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<TabKey>("home");
  const [selectedCoinId, setSelectedCoinId] = useState("bitcoin");
  const [marketQuery, setMarketQuery] = useState("");
  const [assets, setAssets] = useState<AssetsResponse | null>(null);
  const [trades, setTrades] = useState<TradeView[]>([]);
  const [positions, setPositions] = useState<PositionView[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw" | null>(null);
  const userRef = useRef<SessionUser | null>(null);

  // live chat pengguna ↔ admin (socket.io via chat-service).
  // Tamu (belum login) punya identitas sendiri sehingga headset tetap terhubung ke admin.
  const chat = useLiveChat(
    user
      ? { id: user.id, name: user.name ?? "", email: user.email }
      : guest
        ? { id: guest.id, name: guest.name, email: "", isGuest: true }
        : null
  );

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // restore session + identitas tamu
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionUser;
        if (parsed?.id && parsed?.email) setUser(parsed);
      }
    } catch {
      /* ignore */
    }
    setGuest(loadOrCreateGuest());
    setBooted(true);
  }, []);

  const refreshUserData = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    try {
      const [assetsRes, tradesRes, posRes, favRes, kycRes] = await Promise.all([
        fetch(`/api/assets?userId=${u.id}`, { cache: "no-store" }),
        fetch(`/api/trade?userId=${u.id}&limit=10`, { cache: "no-store" }),
        fetch(`/api/positions?userId=${u.id}`, { cache: "no-store" }),
        fetch(`/api/favorites?userId=${u.id}`, { cache: "no-store" }),
        fetch(`/api/kyc?userId=${u.id}`, { cache: "no-store" }),
      ]);
      if (assetsRes.status === 404) {
        // Akun tidak ditemukan lagi (mis. dihapus admin) — bersihkan sesi basi.
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setAssets(null);
        setTrades([]);
        setPositions([]);
        setFavorites([]);
        toast({ title: "Sesi berakhir", description: "Akun tidak ditemukan. Silakan masuk kembali." });
        return;
      }
      if (assetsRes.ok) {
        const data = (await assetsRes.json()) as AssetsResponse;
        setAssets(data);
        setUser((prev) => (prev ? { ...prev, cashUsd: data.cashUsd } : prev));
      }
      if (tradesRes.ok) setTrades(((await tradesRes.json()).trades ?? []) as TradeView[]);
      if (posRes.ok) {
        const data = await posRes.json();
        setPositions((data.open ?? []) as PositionView[]);
      }
      if (favRes.ok) {
        const data = await favRes.json();
        setFavorites((data.coinIds ?? []) as string[]);
      }
      if (kycRes.ok) {
        const data = await kycRes.json();
        setKycStatus((data.kyc?.status ?? null) as KycStatus | null);
      }
    } catch {
      /* network hiccup; keep old data */
    }
  }, []);

  useEffect(() => {
    if (user) refreshUserData();
  }, [user?.id, refreshUserData]);

  // keep assets fresh when prices move
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") refreshUserData();
    }, 30000);
    return () => clearInterval(t);
  }, [user?.id, refreshUserData]);

  const handleLogin = (u: SessionUser) => {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setAssets(null);
    setTrades([]);
    setPositions([]);
    setFavorites([]);
    setTab("home");
    toast({ title: "Sampai jumpa 👋", description: "Anda telah keluar dari akun." });
  };

  const persistUser = (u: SessionUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const goTrade = (coinId: string) => {
    setSelectedCoinId(coinId);
    setTab("trade");
  };

  const goMarket = (query?: string) => {
    setMarketQuery(query ?? "");
    setTab("market");
  };

  const openWallet = (action: "deposit" | "withdraw") => {
    setWalletAction(action);
    setWalletOpen(true);
  };

  const toggleFavorite = async (coinId: string) => {
    const u = userRef.current;
    if (!u) return;
    // optimistic
    const had = favorites.includes(coinId);
    setFavorites((prev) => (had ? prev.filter((id) => id !== coinId) : [...prev, coinId]));
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, coinId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFavorites((prev) => (had ? [...prev, coinId] : prev.filter((id) => id !== coinId)));
      toast({ title: "Gagal", description: "Tidak bisa mengubah favorit.", variant: "destructive" });
    }
  };

  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-200/60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-xs text-muted-foreground">Memuat HakoX…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen justify-center bg-slate-200/60">
        <div className="w-full max-w-md bg-white shadow-xl">
          <LoginView onLogin={handleLogin} onOpenChat={() => chat.setOpen(true)} />
        </div>
        {guest && <LiveChatDialog chat={chat} userName={guest.name} />}
      </div>
    );
  }

  const cashUsd = assets?.cashUsd ?? user.cashUsd;

  return (
    <div className="flex min-h-screen justify-center bg-slate-200/60">
      <div className="relative flex min-h-screen w-full max-w-md flex-col bg-slate-50 shadow-xl">
        <main className="flex flex-1 flex-col pb-[68px]">
          {tab === "home" && (
            <HomeView
              user={user}
              coins={market.coins}
              loading={market.loading}
              kycStatus={kycStatus}
              chatUnread={chat.unread}
              onGoTrade={goTrade}
              onGoMarket={goMarket}
              onGoAssets={() => setTab("assets")}
              onOpenProfile={() => setProfileOpen(true)}
              onOpenSecurity={() => setSecurityOpen(true)}
              onOpenChat={() => chat.setOpen(true)}
              onDeposit={() => openWallet("deposit")}
              onWithdraw={() => openWallet("withdraw")}
              onLogout={handleLogout}
            />
          )}

          {tab === "market" && (
            <MarketView
              coins={market.coins}
              loading={market.loading}
              updatedAt={market.updatedAt}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onSelectCoin={goTrade}
              onRefresh={market.refresh}
              initialQuery={marketQuery}
            />
          )}

          {tab === "trade" && (
            <TradeView
              coins={market.coins}
              user={user}
              selectedCoinId={selectedCoinId}
              onSelectCoin={setSelectedCoinId}
              cashUsd={cashUsd}
              onTraded={refreshUserData}
            />
          )}

          {tab === "contract" && (
            <ContractView
              coins={market.coins}
              user={user}
              cashUsd={cashUsd}
              onPositionsChanged={refreshUserData}
              onGoTrade={goTrade}
            />
          )}

          {tab === "assets" && (
            <AssetsView
              user={user}
              assets={assets}
              trades={trades}
              transactions={assets?.transactions ?? []}
              openPositions={positions}
              onDeposit={() => openWallet("deposit")}
              onWithdraw={() => openWallet("withdraw")}
              onGoTrade={goTrade}
              onGoContract={() => setTab("contract")}
              onLogout={handleLogout}
            />
          )}
        </main>

        <BottomNav active={tab} onChange={setTab} />

        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          user={user}
          onStatusChange={setKycStatus}
        />

        <SecurityDialog open={securityOpen} onOpenChange={setSecurityOpen} user={user} />

        <LiveChatDialog chat={chat} userName={user.name ?? ""} />

        <WalletDialog
          open={walletOpen}
          action={walletAction}
          user={user}
          onOpenChange={(o) => {
            setWalletOpen(o);
            if (!o) persistUser(user);
          }}
          onDone={refreshUserData}
        />
      </div>
    </div>
  );
}
