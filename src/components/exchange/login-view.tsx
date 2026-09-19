"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Globe, Headphones, Hexagon, Loader2, Lock, Mail, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageDialog } from "@/components/exchange/language-dialog";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LoginViewProps {
  onLogin: (user: SessionUser) => void;
  onOpenChat: () => void;
}

type Mode = "login" | "register";

export function LoginView({ onLogin, onOpenChat }: LoginViewProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const validate = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Masukkan alamat email yang valid.";
    if (password.length < 6) return "Kata sandi minimal 6 karakter.";
    if (mode === "register" && name.trim().length > 0 && name.trim().length < 2)
      return "Nama terlalu pendek.";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Periksa kembali", description: err, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal masuk", description: data.error ?? "Terjadi kesalahan.", variant: "destructive" });
        return;
      }
      toast({
        title: mode === "register" ? "Akun dibuat 🎉" : "Berhasil masuk",
        description:
          mode === "register"
            ? `Selamat datang, ${data.user.name || data.user.email}! Ajukan Isi Dana di halaman Aset untuk mengisi saldo Anda.`
            : `Selamat datang kembali, ${data.user.name || data.user.email}!`,
      });
      onLogin(data.user as SessionUser);
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50/80 via-white to-white">
      {/* top bar */}
      <header className="flex items-center justify-between px-5 pt-5">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition hover:text-foreground"
          onClick={() => setLangOpen(true)}
          aria-label="Pilih bahasa"
        >
          <Globe className="h-4.5 w-4.5" /> Bahasa
        </button>
        <button
          className="text-foreground/70 transition hover:text-foreground"
          aria-label="Layanan pelanggan — buka live chat"
          onClick={onOpenChat}
        >
          <Headphones className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col px-8 pb-10">
        {/* logo */}
        <div className="mt-10 flex flex-col items-center">
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30">
            <Hexagon className="h-10 w-10" strokeWidth={1.8} />
            <span className="absolute text-lg font-black tracking-tight">HX</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-blue-600">HakoX</h1>
          <p className="mt-1 text-xs text-muted-foreground">Exchange kripto sederhana &amp; aman</p>
        </div>

        {/* card */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl shadow-blue-900/5 ring-1 ring-blue-100/60">
          {/* tabs */}
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold transition-all",
                  mode === m ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {mode === "register" && (
              <div className="relative">
                <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-xl border-border/70 pl-9"
                  placeholder="Nama (opsional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-xl border-border/70 pl-9"
                placeholder="Email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-xl border-border/70 pr-10 pl-9"
                placeholder="Kata sandi (min. 6 karakter)"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
              <button
                type="button"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} className="h-3.5 w-3.5" />
                Ingat saya
              </label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  toast({
                    title: "Lupa kata sandi",
                    description: "Silakan daftar akun baru atau hubungi layanan pelanggan.",
                  })
                }
              >
                Lupa kata sandi?
              </button>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Masuk" : "Daftar Sekarang"}
            </Button>
          </form>
        </div>

        <p className="mt-auto pt-8 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} HakoX
        </p>
      </main>

      <LanguageDialog open={langOpen} onOpenChange={setLangOpen} />
    </div>
  );
}
