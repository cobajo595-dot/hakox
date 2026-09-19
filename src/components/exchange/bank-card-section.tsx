"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ID_BANKS, ID_EWALLETS, isEwallet } from "@/lib/banks";
import type { BankCardView } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CARDS = 5;

interface BankCardSectionProps {
  userId: string;
  defaultName: string;
}

/** Kelompok "Kartu Bank" di halaman Aset: daftar rekening bank / e-wallet milik pengguna. */
export function BankCardSection({ userId, defaultName }: BankCardSectionProps) {
  const { toast } = useToast();
  const [cards, setCards] = useState<BankCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bank-cards?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { cards?: BankCardView[] };
      setCards(data.cards ?? []);
    } catch {
      // senyap — daftar tetap kosong, coba lagi saat berikutnya
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const atLimit = cards.length >= MAX_CARDS;

  return (
    <section className="mt-4" aria-label="Kartu bank">
      {/* header */}
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold">Kartu Bank</h2>
          {cards.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {cards.length}/{MAX_CARDS}
            </span>
          )}
        </div>
        {!atLimit && cards.length > 0 && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/5 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        )}
      </div>

      {/* daftar kartu */}
      {loading ? (
        <div className="h-[120px] animate-pulse rounded-2xl bg-muted/60" />
      ) : cards.length === 0 ? (
        <button
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-white/60 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.99]"
          aria-label="Tambah kartu bank"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </span>
          <span className="text-xs font-bold">Tambah Kartu Bank</span>
          <span className="max-w-[260px] text-[10px] leading-relaxed text-muted-foreground">
            Hubungkan rekening bank atau e-wallet Indonesia untuk tarik dana.
          </span>
        </button>
      ) : (
        <ul className="space-y-2.5">
          {cards.map((c) => (
            <li key={c.id}>
              <BankCardItem
                card={c}
                userId={userId}
                onDeleted={(id) => setCards((prev) => prev.filter((x) => x.id !== id))}
              />
            </li>
          ))}
          {!atLimit && (
            <li>
              <button
                onClick={() => setAddOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-white/60 py-3 text-xs font-bold text-muted-foreground transition hover:border-primary/40 hover:text-primary active:scale-[0.99]"
                aria-label="Tambah kartu bank lagi"
              >
                <Plus className="h-4 w-4" /> Tambah Kartu
              </button>
            </li>
          )}
          {atLimit && (
            <li className="text-center text-[10px] text-muted-foreground">
              Maksimal {MAX_CARDS} kartu bank per akun.
            </li>
          )}
        </ul>
      )}

      {/* dialog tambah kartu */}
      <AddCardDialog
        userId={userId}
        defaultName={defaultName}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(card) => {
          setCards((prev) => [card, ...prev]);
          toast({
            title: "Kartu bank ditambahkan ✅",
            description: `${card.bankName} • ${card.accountNumber} tersimpan di akun Anda.`,
          });
        }}
      />
    </section>
  );
}

/* ================= KARTU (visual) ================= */

function initialsOf(name: string): string {
  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function groupAccountNumber(n: string): string {
  return n.replace(/(.{4})/g, "$1 ").trim();
}

function BankCardItem({
  card,
  userId,
  onDeleted,
}: {
  card: BankCardView;
  userId: string;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wallet = isEwallet(card.bankName);

  const handleDelete = async () => {
    setConfirmOpen(false);
    try {
      const res = await fetch(
        `/api/bank-cards?id=${encodeURIComponent(card.id)}&userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("gagal");
      onDeleted(card.id);
      toast({ title: "Kartu dihapus", description: `${card.bankName} • ${card.accountNumber}` });
    } catch {
      toast({ title: "Gagal menghapus", description: "Coba lagi sebentar.", variant: "destructive" });
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 text-white shadow-md",
        wallet
          ? "bg-gradient-to-br from-emerald-700 via-emerald-900 to-slate-900"
          : "bg-gradient-to-br from-slate-700 via-slate-900 to-slate-800"
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-white/5 blur-xl" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[10px] font-black tracking-tight">
            {initialsOf(card.bankName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{card.bankName}</p>
            <p className="text-[10px] text-white/60">
              {wallet ? "E-Wallet" : "Bank Indonesia"} · Kartu Utama
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label={`Hapus kartu ${card.bankName}`}
          className="shrink-0 rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="relative mt-3.5 font-mono text-[15px] font-semibold tracking-[0.14em] tabular-nums">
        {groupAccountNumber(card.accountNumber)}
      </p>

      <div className="relative mt-3.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wider text-white/50">Nama Pemilik Rekening</p>
          <p className="truncate text-xs font-bold uppercase">{card.holderName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] uppercase tracking-wider text-white/50">No. Telepon</p>
          <p className="text-xs font-semibold tabular-nums">{card.phone}</p>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus kartu bank?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {card.bankName} • {card.accountNumber} atas nama {card.holderName} akan dihapus dari
              akun Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================= DIALOG TAMBAH ================= */

function AddCardDialog({
  userId,
  defaultName,
  open,
  onOpenChange,
  onAdded,
}: {
  userId: string;
  defaultName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: (card: BankCardView) => void;
}) {
  const { toast } = useToast();
  const [holderName, setHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill nama pemilik dari akun setiap kali dialog dibuka.
  useEffect(() => {
    if (open) {
      setHolderName((v) => v || defaultName);
    }
  }, [open, defaultName]);

  const wallet = bankName ? isEwallet(bankName) : false;

  const reset = () => {
    setBankName("");
    setAccountNumber("");
    setPhone("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = holderName.trim();
    const acc = accountNumber.replace(/[\s-]/g, "");
    const tel = phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");

    if (!name || name.length < 2) {
      toast({ title: "Nama pemilik wajib", description: "Isi nama pemilik rekening.", variant: "destructive" });
      return;
    }
    if (!bankName) {
      toast({ title: "Bank belum dipilih", description: "Pilih nama bank atau e-wallet.", variant: "destructive" });
      return;
    }
    if (!/^\d{6,20}$/.test(acc)) {
      toast({
        title: "Nomor rekening tidak valid",
        description: "Harus 6-20 angka tanpa huruf.",
        variant: "destructive",
      });
      return;
    }
    if (!/^0\d{8,14}$|^62\d{8,13}$|^8\d{8,13}$/.test(tel)) {
      toast({
        title: "Nomor telepon tidak valid",
        description: "Gunakan format Indonesia, contoh: 081234567890.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, holderName: name, bankName, accountNumber: acc, phone: tel }),
      });
      const data = (await res.json()) as { card?: BankCardView; error?: string };
      if (!res.ok || !data.card) {
        toast({ title: "Gagal menambahkan", description: data.error ?? "Coba lagi sebentar.", variant: "destructive" });
        return;
      }
      onAdded(data.card);
      reset();
      onOpenChange(false);
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="data-[state=open]:slide-in-from-bottom-8 bottom-0 top-auto left-1/2 max-w-full -translate-x-1/2 translate-y-0 rounded-b-none rounded-t-[28px] border-0 p-0 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:max-w-md"
      >
        <DialogTitle className="sr-only">Tambah Kartu Bank</DialogTitle>
        <DialogDescription className="sr-only">
          Isi data rekening bank atau e-wallet untuk ditambahkan ke akun Anda.
        </DialogDescription>

        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted" />
        <form onSubmit={submit} className="space-y-3.5 px-5 pt-3">
          <div className="text-center">
            <p className="text-sm font-bold">Tambah Kartu Bank</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Rekening & e-wallet Indonesia — terhubung ke admin untuk verifikasi tarik dana.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-holder" className="text-xs font-semibold">
              Nama Pemilik Rekening
            </Label>
            <Input
              id="bc-holder"
              className="h-11 rounded-xl"
              placeholder="Sesuai buku rekening"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              maxLength={40}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-bank" className="text-xs font-semibold">
              Nama Bank / E-Wallet
            </Label>
            <Select value={bankName} onValueChange={setBankName} required>
              <SelectTrigger id="bc-bank" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="Pilih bank atau e-wallet" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Bank Indonesia
                  </SelectLabel>
                  {ID_BANKS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    E-Wallet
                  </SelectLabel>
                  {ID_EWALLETS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-account" className="text-xs font-semibold">
              Nomor Rekening
            </Label>
            <Input
              id="bc-account"
              className="h-11 rounded-xl tabular-nums"
              inputMode="numeric"
              placeholder={wallet ? "Nomor HP e-wallet (contoh: 081234567890)" : "Contoh: 1234567890"}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
              maxLength={24}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-phone" className="text-xs font-semibold">
              Nomor Telepon
            </Label>
            <Input
              id="bc-phone"
              className="h-11 rounded-xl tabular-nums"
              inputMode="tel"
              placeholder="081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+()-]/g, ""))}
              maxLength={18}
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl font-semibold"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-xl font-semibold" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Kartu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
