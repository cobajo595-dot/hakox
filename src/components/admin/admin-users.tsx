"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Search, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/components/admin/admin-api";
import type { AdminUserDetail, AdminUserRow } from "@/lib/types";
import { fmtDateTime, fmtQty, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

export function AdminUsers({ onAuthError }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adjustUser, setAdjustUser] = useState<AdminUserRow | null>(null);

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await apiJson<{ users: AdminUserRow[] }>(
          `/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`
        );
        setUsers(data.users);
      } catch (err) {
        const e = err as { status?: number; message: string };
        if (e.status === 401) {
          onAuthError();
          return;
        }
        toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [onAuthError, toast]
  );

  useEffect(() => {
    load("");
     
  }, []);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await apiJson<AdminUserDetail>(`/api/admin/users/${id}`);
      setDetail(d);
    } catch (err) {
      const e = err as { status?: number; message: string };
      if (e.status === 401) onAuthError();
      else toast({ title: "Gagal memuat detail", description: e.message, variant: "destructive" });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAdjusted = (id: string, newCash: number) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, cashUsd: newCash } : u)));
    if (detail?.id === id) setDetail({ ...detail, cashUsd: newCash });
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Manajemen Pengguna</h2>
          <p className="text-xs text-muted-foreground">
            {users.length} pengguna terdaftar
          </p>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-xl pl-9"
            placeholder="Cari nama atau email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-10 rounded-xl px-4" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
        </Button>
      </form>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="max-h-[62vh] overflow-auto hx-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead className="text-right">Saldo Tunai</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Nilai Koin</TableHead>
                <TableHead className="hidden text-center md:table-cell">Posisi</TableHead>
                <TableHead className="hidden text-center md:table-cell">Trade</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Terdaftar</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 && (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    Tidak ada pengguna ditemukan.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{u.name || "—"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">{fmtUsd(u.cashUsd)}</TableCell>
                  <TableCell className="hidden text-right text-xs sm:table-cell">{fmtUsd(u.holdingsUsd)}</TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {u.openPositions > 0 ? (
                      <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">{u.openPositions}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-center text-xs md:table-cell">{u.tradeCount}</TableCell>
                  <TableCell className="hidden text-right text-[11px] text-muted-foreground lg:table-cell">
                    {fmtDateTime(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[11px]" onClick={() => openDetail(u.id)}>
                        Detail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 rounded-lg px-2 text-[11px] text-blue-600 hover:bg-blue-50"
                        onClick={() => setAdjustUser(u)}
                      >
                        <Plus className="h-3 w-3" /> Saldo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto hx-scroll rounded-2xl sm:max-w-2xl">
          {detailLoading || !detail ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <UserRound className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{detail.name || detail.email}</span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground">
                      {detail.email} · terdaftar {fmtDateTime(detail.createdAt)}
                    </span>
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Saldo tunai: <span className="font-bold text-foreground">{fmtUsd(detail.cashUsd)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* holdings */}
                <section>
                  <h4 className="mb-2 text-xs font-bold">Kepemilikan Koin</h4>
                  {detail.holdings.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-muted-foreground">
                      Belum memiliki koin.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.holdings.map((h) => (
                        <div key={h.coinId} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold">{h.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {fmtQty(h.amount)} @ {fmtUsd(h.price)}
                            </p>
                          </div>
                          <p className="text-xs font-bold">{fmtUsd(h.valueUsd)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* open positions */}
                <section>
                  <h4 className="mb-2 text-xs font-bold">Posisi Terbuka</h4>
                  {detail.openPositions.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-muted-foreground">
                      Tidak ada posisi terbuka.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.openPositions.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold">
                              <Badge
                                className={cn(
                                  "mr-1.5 px-1.5 py-0 text-[9px]",
                                  p.side === "LONG" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                                )}
                              >
                                {p.side} {p.leverage}x
                              </Badge>
                              {p.symbol}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Margin {fmtUsd(p.marginUsd)} · entri {fmtUsd(p.entryPrice)}
                            </p>
                          </div>
                          <p className={cn("text-xs font-bold", p.pnlUsd >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {p.pnlUsd >= 0 ? "+" : ""}
                            {fmtUsd(p.pnlUsd)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* recent trades */}
                <section>
                  <h4 className="mb-2 text-xs font-bold">Trade Terakhir</h4>
                  {detail.trades.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-muted-foreground">
                      Belum ada trade.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto hx-scroll pr-1">
                      {detail.trades.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold">
                              <span className={cn("mr-1.5", t.side === "BUY" ? "text-emerald-600" : "text-red-500")}>
                                {t.side === "BUY" ? "Beli" : "Jual"}
                              </span>
                              {t.symbol}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {fmtQty(t.quantity)} @ {fmtUsd(t.price)} · {fmtDateTime(t.createdAt)}
                            </p>
                          </div>
                          <p className="text-xs font-bold">{fmtUsd(t.totalUsd)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* transactions */}
                <section>
                  <h4 className="mb-2 text-xs font-bold">Riwayat Transaksi</h4>
                  {detail.transactions.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-muted-foreground">
                      Belum ada transaksi.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto hx-scroll pr-1">
                      {detail.transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{t.note ?? t.type}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtDateTime(t.createdAt)}</p>
                          </div>
                          <p className={cn("text-xs font-bold", t.amountUsd >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {t.amountUsd >= 0 ? "+" : ""}
                            {fmtUsd(t.amountUsd)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* adjust balance dialog */}
      {adjustUser && (
        <AdjustBalanceDialog
          user={adjustUser}
          onClose={() => setAdjustUser(null)}
          onAuthError={onAuthError}
          onDone={(newCash) => handleAdjusted(adjustUser.id, newCash)}
        />
      )}
    </div>
  );
}

/* ============ Adjust balance dialog ============ */

function AdjustBalanceDialog({
  user,
  onClose,
  onAuthError,
  onDone,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onAuthError: () => void;
  onDone: (newCash: number) => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed !== 0;

  const submit = async () => {
    if (!valid) {
      toast({ title: "Jumlah tidak valid", description: "Masukkan angka selain nol.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = await apiJson<{ cashUsd: number }>(`/api/admin/users/${user.id}/balance`, {
        method: "POST",
        body: JSON.stringify({ amount: parsed, note: note.trim() || undefined }),
      });
      toast({
        title: "Saldo diperbarui",
        description: `${user.email}: saldo baru ${fmtUsd(data.cashUsd)}.`,
      });
      onDone(data.cashUsd);
      onClose();
    } catch (err) {
      const e = err as { status?: number; message: string };
      if (e.status === 401) onAuthError();
      else toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const quicks = [100, 1000, 10000];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Sesuaikan Saldo</DialogTitle>
          <DialogDescription className="text-xs">
            {user.name || user.email} · saldo saat ini{" "}
            <span className="font-bold text-foreground">{fmtUsd(user.cashUsd)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-amount">Jumlah (USD)</Label>
            <Input
              id="adjust-amount"
              className="h-11 rounded-xl"
              type="number"
              step="any"
              placeholder="contoh: 500 atau -200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quicks.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-[11px]"
                  onClick={() => setAmount(String((Number(amount) || 0) + q))}
                >
                  +{fmtUsd(q)}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-2 text-[11px] text-red-600"
                onClick={() => setAmount(String((Number(amount) || 0) - 100))}
              >
                -{fmtUsd(100)}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-note">Catatan (opsional)</Label>
            <Input
              id="adjust-note"
              className="h-10 rounded-xl"
              placeholder="alasan penyesuaian…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
            />
          </div>

          <Button className="h-11 w-full rounded-xl font-semibold" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Penyesuaian"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
