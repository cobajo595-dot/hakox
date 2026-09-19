"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/components/admin/admin-api";
import type { AdminSecurityResponse, AdminSecurityRow } from "@/lib/types";
import { fmtDateTime, fmtUsd } from "@/lib/format";

interface Props {
  onAuthError: () => void;
}

/** Tab admin: sandi login & sandi penarikan seluruh akun terdaftar. */
export function AdminSecurity({ onAuthError }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminSecurityRow[]>([]);
  const [counts, setCounts] = useState<{ total: number; withWithdrawal: number }>({
    total: 0,
    withWithdrawal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (q: string, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiJson<AdminSecurityResponse>(
          `/api/admin/security?q=${encodeURIComponent(q)}`
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
          <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" /> Keamanan Akun
          </h2>
          <p className="text-xs text-muted-foreground">
            {counts.total} akun · {counts.withWithdrawal} akun punya sandi penarikan · sandi login
            &amp; sandi penarikan terlihat di sini
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={search} className="relative">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / email…"
              aria-label="Cari akun"
              className="h-9 w-56 rounded-full pl-8 text-xs sm:w-64"
            />
          </form>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
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
          <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            {query.trim()
              ? `Tidak ada akun yang cocok dengan "${query}".`
              : "Belum ada akun terdaftar."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((u) => (
            <li
              key={u.id}
              className="rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm"
            >
              {/* mobile layout */}
              <div className="md:hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{u.name || "—"}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {u.email} · {fmtUsd(u.cashUsd)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    Daftar {fmtDateTime(u.createdAt)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-xl bg-muted/60 px-3 py-2">
                  <CredentialRow label="Sandi Login" row={u} kind="login" />
                  <CredentialRow label="Sandi Penarikan" row={u} kind="withdrawal" />
                </div>
              </div>

              {/* desktop layout */}
              <div className="hidden items-center gap-4 md:flex">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserRound className="h-4.5 w-4.5" />
                </span>
                <div className="w-52 min-w-0">
                  <p className="truncate text-xs font-bold">{u.name || "—"}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                </div>
                <div className="w-56 shrink-0">
                  <CredentialRow label="Sandi Login" row={u} kind="login" />
                </div>
                <div className="w-56 shrink-0">
                  <CredentialRow label="Sandi Penarikan" row={u} kind="withdrawal" />
                </div>
                <div className="w-28 shrink-0">
                  <p className="text-[10px] text-muted-foreground">Saldo</p>
                  <p className="text-xs font-bold tabular-nums">{fmtUsd(u.cashUsd)}</p>
                </div>
                <div className="w-40 shrink-0">
                  <p className="text-[10px] text-muted-foreground">Terdaftar</p>
                  <p className="text-[11px] font-semibold">{fmtDateTime(u.createdAt)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================= Baris kredensal (lihat / salin) ================= */

function CredentialRow({
  label,
  row,
  kind,
}: {
  label: string;
  row: AdminSecurityRow;
  kind: "login" | "withdrawal";
}) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);

  const isLogin = kind === "login";
  const recorded = isLogin ? row.loginRecorded : row.hasWithdrawalPassword;
  const value = isLogin ? row.loginPassword : row.withdrawalPassword;
  const updatedAt = isLogin ? row.passwordUpdatedAt : row.withdrawalUpdatedAt;

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Disalin", description: `${label}: ${value}` });
    } catch {
      toast({ title: "Gagal menyalin", description: "Browser menolak akses clipboard.", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
          {recorded && updatedAt ? ` · ${fmtDateTime(updatedAt)}` : ""}
        </p>
        {recorded && value ? (
          <p
            className={cnPassword(revealed)}
            aria-label={revealed ? `${label} akun ini` : `${label} tersembunyi`}
          >
            {revealed ? value : "•".repeat(Math.min(12, Math.max(6, value.length)))}
          </p>
        ) : (
          <Badge className="bg-amber-50 text-[9px] text-amber-600 hover:bg-amber-50">
            {isLogin ? "Tidak tercatat" : "Belum diatur"}
          </Badge>
        )}
      </div>
      {recorded && value && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Sembunyikan ${label.toLowerCase()}` : `Lihat ${label.toLowerCase()}`}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label={`Salin ${label.toLowerCase()}`}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function cnPassword(revealed: boolean): string {
  return [
    "truncate font-mono text-xs font-bold tracking-wide tabular-nums",
    revealed ? "text-foreground" : "text-muted-foreground",
  ].join(" ");
}
