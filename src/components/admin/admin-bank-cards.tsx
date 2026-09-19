"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Phone, RefreshCw, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/components/admin/admin-api";
import type { AdminBankCardsResponse, AdminBankCardRow } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { isEwallet } from "@/lib/banks";

interface Props {
  onAuthError: () => void;
}

/** Tab admin: daftar kartu bank / e-wallet yang ditambahkan pengguna di aplikasi. */
export function AdminBankCards({ onAuthError }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminBankCardRow[]>([]);
  const [counts, setCounts] = useState<{ total: number; users: number }>({ total: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (q: string, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiJson<AdminBankCardsResponse>(
          `/api/admin/bank-cards?q=${encodeURIComponent(q)}`
        );
        setRows(data.rows);
        setCounts(data.counts);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 401) {
          onAuthError();
          return;
        }
        toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onAuthError, toast]
  );

  useEffect(() => {
    load("");
  }, [load]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    load(query.trim());
  };

  const refresh = () => {
    setRefreshing(true);
    load(query.trim(), true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Kartu Bank Pengguna</h2>
          <p className="text-xs text-muted-foreground">
            {counts.total} kartu dari {counts.users} pengguna · nama pemilik rekening &amp; nomor
            rekening terlihat di sini
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={search} className="relative">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / bank / no. rekening…"
              aria-label="Cari kartu bank"
              className="h-9 w-56 rounded-full pl-8 text-xs sm:w-64"
            />
          </form>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Segarkan</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 py-12 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            {query.trim()
              ? `Tidak ada kartu yang cocok dengan "${query}".`
              : "Belum ada pengguna yang menambahkan kartu bank."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm"
            >
              {/* mobile layout */}
              <div className="md:hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">
                      {initials(c.bankName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">
                        {c.bankName}
                        <span className="ml-1.5 font-mono font-semibold">{c.accountNumber}</span>
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {c.holderName} · {fmtDateTime(c.createdAt)}
                      </p>
                    </div>
                  </div>
                  <KindBadge wallet={isEwallet(c.bankName)} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate font-semibold text-foreground">
                      {c.userName || "—"}
                    </span>
                    <span className="truncate">({c.userEmail})</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold tabular-nums">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {c.phone}
                  </span>
                </div>
              </div>

              {/* desktop layout */}
              <div className="hidden items-center gap-4 md:flex">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                  {initials(c.bankName)}
                </span>
                <div className="w-44 min-w-0">
                  <p className="truncate text-xs font-bold">{c.bankName}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDateTime(c.createdAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground">Pemilik Rekening</p>
                  <p className="truncate text-xs font-bold">{c.holderName}</p>
                </div>
                <div className="w-40 shrink-0">
                  <p className="text-[10px] text-muted-foreground">Nomor Rekening</p>
                  <p className="font-mono text-xs font-bold tracking-wide tabular-nums">
                    {c.accountNumber}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <p className="text-[10px] text-muted-foreground">Telepon</p>
                  <p className="text-xs font-semibold tabular-nums">{c.phone}</p>
                </div>
                <div className="w-52 shrink-0">
                  <p className="text-[10px] text-muted-foreground">Pengguna</p>
                  <p className="truncate text-xs font-semibold">
                    {c.userName || "—"}{" "}
                    <span className="font-normal text-muted-foreground">({c.userEmail})</span>
                  </p>
                </div>
                <KindBadge wallet={isEwallet(c.bankName)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initials(name: string): string {
  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function KindBadge({ wallet }: { wallet: boolean }) {
  return (
    <Badge
      className={
        wallet
          ? "shrink-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
          : "shrink-0 bg-slate-100 text-slate-600 hover:bg-slate-100"
      }
    >
      {wallet ? "E-Wallet" : "Bank"}
    </Badge>
  );
}
