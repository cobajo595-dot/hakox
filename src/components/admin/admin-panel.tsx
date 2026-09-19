"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeftRight,
  CreditCard,
  ExternalLink,
  Hexagon,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  clearAdminSession,
  getAdminToken,
  storeAdminSession,
} from "@/components/admin/admin-api";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminTrades } from "@/components/admin/admin-trades";
import { AdminPositions } from "@/components/admin/admin-positions";
import { AdminNotices } from "@/components/admin/admin-notices";
import { AdminKyc } from "@/components/admin/admin-kyc";
import { AdminWallet } from "@/components/admin/admin-wallet";
import { AdminLiveChat } from "@/components/admin/admin-live-chat";
import { AdminBinary } from "@/components/admin/admin-binary";
import { AdminBankCards } from "@/components/admin/admin-bank-cards";
import { AdminSecurity } from "@/components/admin/admin-security";
import { cn } from "@/lib/utils";

type AdminTab = "dashboard" | "users" | "security" | "kyc" | "wallet" | "bankcards" | "chat" | "binary" | "trades" | "positions" | "notices";

const TABS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Ringkasan", icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: "users", label: "Pengguna", icon: <Users className="h-4 w-4" /> },
  { key: "security", label: "Keamanan Akun", icon: <KeyRound className="h-4 w-4" /> },
  { key: "kyc", label: "Verifikasi KYC", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "wallet", label: "Setoran & Tarik Dana", icon: <Wallet className="h-4 w-4" /> },
  { key: "bankcards", label: "Kartu Bank", icon: <CreditCard className="h-4 w-4" /> },
  { key: "chat", label: "Live Chat", icon: <MessageCircle className="h-4 w-4" /> },
  { key: "binary", label: "Kontrol Trading", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "trades", label: "Riwayat Trade", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { key: "positions", label: "Posisi", icon: <Target className="h-4 w-4" /> },
  { key: "notices", label: "Pengumuman", icon: <Megaphone className="h-4 w-4" /> },
];

interface AdminPanelProps {
  onExit: () => void;
}

export function AdminPanel({ onExit }: AdminPanelProps) {
  const { toast } = useToast();
  // Halaman /admin juga dirender di server: token hanya dibaca setelah mount
  // (via setTimeout) agar tidak terjadi hydration mismatch.
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setToken(getAdminToken());
      setBooted(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // indikator pesan live chat yang belum dibaca (socket ringan, terpisah dari tab)
  useEffect(() => {
    if (!token) return;
    const s = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 8000,
      forceNew: true,
    });
    s.on("connect", () => s.emit("chat:admin-join", { token }));
    s.on("chat:unread-total", (d: { total?: number }) => setChatUnread(d?.total ?? 0));
    return () => {
      s.disconnect();
    };
  }, [token]);

  const handleAuthError = useCallback(() => {
    clearAdminSession();
    setToken(null);
  }, []);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const handleLogout = () => {
    clearAdminSession();
    setToken(null);
    toast({ title: "Keluar admin", description: "Sesi admin telah diakhiri." });
  };

  if (!booted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return <AdminLogin onLogin={(t) => setToken(t)} onExit={onExit} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow">
              <Hexagon className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold tracking-tight text-blue-600">
                HakoX <span className="text-foreground">Admin</span>
              </p>
              <p className="hidden text-[10px] text-muted-foreground sm:block">
                Panel manajemen exchange
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Segarkan</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onExit}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Buka Aplikasi</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>

        {/* tab bar mobile */}
        <nav
          aria-label="Navigasi admin"
          className="flex gap-1 overflow-x-auto border-t border-border/50 px-3 py-2 md:hidden hx-scroll"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === t.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
              {t.key === "chat" && chatUnread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ===== Body ===== */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        {/* sidebar desktop */}
        <aside className="hidden w-56 shrink-0 md:block">
          <nav aria-label="Navigasi admin" className="sticky top-20 space-y-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                  tab === t.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                )}
              >
                {t.icon}
                {t.label}
                {t.key === "chat" && chatUnread > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {chatUnread > 9 ? "9+" : chatUnread}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* content */}
        <main className="min-w-0 flex-1">
          {tab === "dashboard" && (
            <AdminDashboard key={`d-${refreshKey}`} onAuthError={handleAuthError} onOpenWallet={() => setTab("wallet")} />
          )}
          {tab === "users" && <AdminUsers key={`u-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "security" && <AdminSecurity key={`sec-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "kyc" && <AdminKyc key={`k-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "wallet" && <AdminWallet key={`w-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "bankcards" && <AdminBankCards key={`bc-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "chat" && <AdminLiveChat key={`c-${refreshKey}`} onUnreadChange={setChatUnread} />}
          {tab === "binary" && <AdminBinary key={`b-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "trades" && <AdminTrades key={`t-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "positions" && <AdminPositions key={`p-${refreshKey}`} onAuthError={handleAuthError} />}
          {tab === "notices" && <AdminNotices key={`n-${refreshKey}`} onAuthError={handleAuthError} />}
        </main>
      </div>

      <footer className="mt-auto border-t border-border/60 bg-white py-3">
        <p className="text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} HakoX Admin
        </p>
      </footer>
    </div>
  );
}

/* ================= LOGIN ================= */

function AdminLogin({
  onLogin,
  onExit,
}: {
  onLogin: (token: string) => void;
  onExit: () => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      toast({ title: "Lengkapi form", description: "Username & kata sandi wajib diisi.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal masuk", description: data.error ?? "Terjadi kesalahan.", variant: "destructive" });
        return;
      }
      storeAdminSession(data.token, data.username);
      toast({ title: "Selamat datang, admin 👋", description: `Masuk sebagai ${data.username}.` });
      onLogin(data.token as string);
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/80 via-slate-100 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30">
            <Hexagon className="h-8 w-8" strokeWidth={1.8} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-blue-600">HakoX Admin</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Masuk untuk mengelola exchange
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/5 ring-1 ring-blue-100/60"
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              className="h-11 rounded-xl"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Kata sandi</Label>
            <Input
              id="admin-password"
              className="h-11 rounded-xl"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk ke Panel Admin"}
          </Button>
        </form>

        <button
          onClick={onExit}
          className="mx-auto mt-5 block text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          ← Kembali ke aplikasi
        </button>
      </div>
    </div>
  );
}
