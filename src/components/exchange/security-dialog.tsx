"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SecurityStatusResponse, SessionUser } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

interface SecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
}

/** Sheet "Pengaturan Keamanan": ubah kata sandi login & kata sandi penarikan. */
export function SecurityDialog({ open, onOpenChange, user }: SecurityDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SecurityStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/security?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setStatus((await res.json()) as SecurityStatusResponse);
      }
    } catch {
      /* biarkan status terakhir */
    } finally {
      setStatusLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="data-[state=open]:slide-in-from-bottom-8 bottom-0 top-auto left-1/2 max-h-[90vh] max-w-full -translate-x-1/2 translate-y-0 overflow-y-auto rounded-b-none rounded-t-[28px] border-0 p-0 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] hx-scroll sm:max-w-md"
      >
        <DialogTitle className="sr-only">Pengaturan Keamanan</DialogTitle>
        <DialogDescription className="sr-only">
          Ubah kata sandi login dan kata sandi penarikan akun Anda.
        </DialogDescription>

        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted" />

        <div className="px-5 pt-3">
          <div className="text-center">
            <p className="text-sm font-bold">Pengaturan Keamanan</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Kelola kata sandi login &amp; kata sandi penarikan akun Anda.
            </p>
          </div>

          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-blue-50/70 p-2.5 text-[10px] leading-relaxed text-blue-700">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Kata sandi tersimpan aman &amp; terhubung ke admin — jika Anda lupa, tim HakoX via live
            chat dapat memverifikasi kredensal akun Anda.
          </p>

          {/* ===== Ubah kata sandi login ===== */}
          <LoginPasswordForm
            userId={user.id}
            passwordUpdatedAt={status?.passwordUpdatedAt ?? null}
            onSaved={() => {
              loadStatus();
              toast({
                title: "Kata sandi login diperbarui ✅",
                description: "Gunakan kata sandi baru pada login berikutnya.",
              });
            }}
          />

          {/* ===== Ubah kata sandi penarikan ===== */}
          <WithdrawalPasswordForm
            userId={user.id}
            hasWithdrawalPassword={status?.hasWithdrawalPassword ?? false}
            withdrawalUpdatedAt={status?.withdrawalUpdatedAt ?? null}
            loading={statusLoading}
            onSaved={() => {
              loadStatus();
              toast({
                title: "Kata sandi penarikan tersimpan ✅",
                description: "Kata sandi ini akan dipakai untuk konfirmasi tarik dana.",
              });
            }}
          />

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-4 w-full rounded-xl bg-muted/70 py-2.5 text-xs font-bold text-muted-foreground transition hover:bg-muted"
          >
            Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= FORM KATA SANDI LOGIN ================= */

function LoginPasswordForm({
  userId,
  passwordUpdatedAt,
  onSaved,
}: {
  userId: string;
  passwordUpdatedAt: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      toast({
        title: "Kata sandi baru terlalu pendek",
        description: "Minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }
    if (next !== confirm) {
      toast({
        title: "Konfirmasi tidak sama",
        description: "Ketik ulang kata sandi baru dengan sama.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "login",
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast({
          title: "Gagal mengubah",
          description: data.error ?? "Coba lagi sebentar.",
          variant: "destructive",
        });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      onSaved();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
            <KeyRound className="h-3.5 w-3.5 text-blue-600" />
          </span>
          Ubah Kata Sandi Login
        </h3>
        {passwordUpdatedAt && (
          <span className="shrink-0 text-[9px] text-muted-foreground">
            Diubah {fmtDateTime(passwordUpdatedAt)}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2.5">
        <PasswordInput
          id="sec-login-current"
          label="Kata sandi saat ini"
          placeholder="Kata sandi login lama"
          value={current}
          onChange={setCurrent}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="current-password"
        />
        <PasswordInput
          id="sec-login-new"
          label="Kata sandi baru"
          placeholder="Minimal 6 karakter"
          value={next}
          onChange={setNext}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="new-password"
        />
        <PasswordInput
          id="sec-login-confirm"
          label="Konfirmasi kata sandi baru"
          placeholder="Ulangi kata sandi baru"
          value={confirm}
          onChange={setConfirm}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="mt-3.5 h-10 w-full rounded-xl text-xs font-bold" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kata Sandi Login"}
      </Button>
    </form>
  );
}

/* ================= FORM KATA SANDI PENARIKAN ================= */

function WithdrawalPasswordForm({
  userId,
  hasWithdrawalPassword,
  withdrawalUpdatedAt,
  loading,
  onSaved,
}: {
  userId: string;
  hasWithdrawalPassword: boolean;
  withdrawalUpdatedAt: string | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      toast({
        title: "Kata sandi penarikan terlalu pendek",
        description: "Minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }
    if (next !== confirm) {
      toast({
        title: "Konfirmasi tidak sama",
        description: "Ketik ulang kata sandi penarikan dengan sama.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "withdrawal",
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast({
          title: "Gagal menyimpan",
          description: data.error ?? "Coba lagi sebentar.",
          variant: "destructive",
        });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      onSaved();
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
          </span>
          Ubah Kata Sandi Penarikan
        </h3>
        {loading ? (
          <span className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
        ) : hasWithdrawalPassword ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
            Aktif{withdrawalUpdatedAt ? ` · ${fmtDateTime(withdrawalUpdatedAt)}` : ""}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
            Belum diatur
          </span>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Dipakai untuk konfirmasi penarikan dana. Untuk mengubah, verifikasi memakai kata sandi
        login Anda.
      </p>

      <div className="mt-3 space-y-2.5">
        <PasswordInput
          id="sec-wd-current"
          label="Kata sandi login (verifikasi)"
          placeholder="Kata sandi login Anda"
          value={current}
          onChange={setCurrent}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="current-password"
        />
        <PasswordInput
          id="sec-wd-new"
          label="Kata sandi penarikan baru"
          placeholder="Minimal 6 karakter"
          value={next}
          onChange={setNext}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="new-password"
        />
        <PasswordInput
          id="sec-wd-confirm"
          label="Konfirmasi kata sandi penarikan"
          placeholder="Ulangi kata sandi penarikan"
          value={confirm}
          onChange={setConfirm}
          show={show}
          onToggleShow={() => setShow((v) => !v)}
          autoComplete="new-password"
        />
      </div>

      <Button
        type="submit"
        className="mt-3.5 h-10 w-full rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kata Sandi Penarikan"}
      </Button>
    </form>
  );
}

/* ================= Input kata sandi + toggle lihat ================= */

function PasswordInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          className="h-10 rounded-xl pr-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={40}
          required
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
