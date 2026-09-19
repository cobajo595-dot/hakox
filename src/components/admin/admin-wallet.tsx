"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  Clock,
  Inbox,
  Loader2,
  Search,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { AdminWalletTxRow, TxStatus } from "@/lib/types";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import { fmtIdr, fmtUsdt } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

/** Teks jumlah utama: Rupiah (pengajuan baru) atau USD (baris lama sebelum konversi Rp). */
function amountMain(amountUsd: number, amountIdr: number | null): string {
  if (amountIdr == null) return fmtUsd(amountUsd);
  return `${amountUsd >= 0 ? "+" : "-"}${fmtIdr(Math.abs(amountIdr))}`;
}

/** Sub-teks setara USDT di bawah jumlah Rupiah. */
function amountSub(amountUsd: number, amountIdr: number | null): string | null {
  return amountIdr != null ? `≈ ${fmtUsdt(Math.abs(amountUsd))}` : null;
}

const STATUS_BADGE: Record<TxStatus, { label: string; className: string; icon: React.ReactNode }> = {
  PENDING: {
    label: "Menunggu",
    className: "bg-amber-50 text-amber-600 hover:bg-amber-50",
    icon: <Clock className="h-3 w-3" />,
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    icon: <BadgeCheck className="h-3 w-3" />,
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-50 text-red-600 hover:bg-red-50",
    icon: <XCircle className="h-3 w-3" />,
  },
  COMPLETED: {
    label: "Selesai",
    className: "bg-slate-100 text-slate-600 hover:bg-slate-100",
    icon: <BadgeCheck className="h-3 w-3" />,
  },
};

export function AdminWallet({ onAuthError }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminWalletTxRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  // dialog tinjau
  const [detail, setDetail] = useState<AdminWalletTxRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        rows: AdminWalletTxRow[];
        counts: { total: number; pending: number; approved: number; rejected: number };
      }>("/api/admin/transactions");
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
    }
  }, [onAuthError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (r: AdminWalletTxRow) => {
    setDetail(r);
    setNote("");
    setDetailOpen(true);
  };

  const review = async (action: "APPROVE" | "REJECT") => {
    if (!detail) return;
    if (action === "REJECT" && note.trim().length < 3) {
      toast({
        title: "Alasan wajib",
        description: "Tuliskan alasan penolakan (min. 3 karakter).",
        variant: "destructive",
      });
      return;
    }
    setActing(action);
    try {
      const data = await apiJson<{ transaction: AdminWalletTxRow; autoRejected?: boolean }>(
        `/api/admin/transactions/${detail.id}`,
        { method: "PATCH", body: JSON.stringify({ action, note: note.trim() }) }
      );
      const updated = data.transaction;
      setRows((prev) =>
        prev.map((r) =>
          r.id === detail.id
            ? {
                ...r,
                status: updated.status,
                reviewNote: updated.reviewNote,
                reviewedAt: updated.reviewedAt,
                userCashUsd: updated.userCashUsd,
                note: updated.note,
              }
            : r
        )
      );
      setCounts((c) => ({
        ...c,
        pending: c.pending - (detail.status === "PENDING" ? 1 : 0),
        approved: c.approved + (updated.status === "APPROVED" ? 1 : 0),
        rejected: c.rejected + (updated.status === "REJECTED" ? 1 : 0),
      }));
      setDetail((d) =>
        d
          ? {
              ...d,
              status: updated.status,
              reviewNote: updated.reviewNote,
              reviewedAt: updated.reviewedAt,
              userCashUsd: updated.userCashUsd,
              note: updated.note,
            }
          : d
      );
      toast({
        title:
          updated.status === "APPROVED"
            ? detail.type === "DEPOSIT"
              ? "Isi dana disetujui ✅"
              : "Tarik dana disetujui ✅"
            : "Pengajuan ditolak",
        description:
          updated.status === "APPROVED"
            ? detail.type === "DEPOSIT"
              ? `${amountMain(detail.amountUsd, detail.amountIdr)} telah masuk ke saldo ${(detail.userName || detail.userEmail).trim()}.`
              : `${amountMain(detail.amountUsd, detail.amountIdr)} telah dikeluarkan dari saldo pengguna.`
            : data.autoRejected
              ? "Saldo pengguna tidak mencukupi saat persetujuan."
              : "Pengguna dapat melihat alasan di riwayat transaksinya.",
      });
    } catch (err) {
      const e = err as { status?: number; message: string };
      if (e.status === 401) onAuthError();
      else toast({ title: "Gagal memproses", description: e.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (q === "") return true;
    return r.userEmail.toLowerCase().includes(q) || r.userName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* header + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Setoran &amp; Tarik Dana</h2>
          <p className="text-xs text-muted-foreground">
            {counts.pending} menunggu · {counts.approved} disetujui · {counts.rejected} ditolak
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            /* pencarian bersifat client-side */
          }}
        >
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-44 rounded-xl pl-9 sm:w-56"
              placeholder="Cari nama / email pengguna…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari pengajuan dana"
            />
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status pengajuan dana">
        {(
          [
            ["ALL", `Semua (${counts.total})`],
            ["PENDING", `Menunggu (${counts.pending})`],
            ["APPROVED", `Disetujui (${counts.approved})`],
            ["REJECTED", `Ditolak (${counts.rejected})`],
          ] as [StatusFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 py-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            {rows.length === 0
              ? "Belum ada pengajuan isi/tarik dana dari pengguna."
              : "Tidak ada pengajuan yang cocok dengan filter/pencarian."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[180px]">Pengguna</TableHead>
                <TableHead className="min-w-[110px]">Jenis</TableHead>
                <TableHead className="min-w-[110px]">Jumlah</TableHead>
                <TableHead className="min-w-[120px]">Diajukan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const badge = STATUS_BADGE[r.status];
                const isDeposit = r.type === "DEPOSIT";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">
                          {(r.userName || r.userEmail).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{r.userName || "—"}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{r.userEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold",
                          isDeposit ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                        )}
                      >
                        {isDeposit ? (
                          <ArrowDownToLine className="h-3 w-3" />
                        ) : (
                          <ArrowUpFromLine className="h-3 w-3" />
                        )}
                        {isDeposit ? "Isi Dana" : "Tarik Dana"}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        isDeposit ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      <div className="flex flex-col leading-tight">
                        <span>{amountMain(r.amountUsd, r.amountIdr)}</span>
                        {amountSub(r.amountUsd, r.amountIdr) && (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {amountSub(r.amountUsd, r.amountIdr)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {fmtDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("gap-1 border-transparent", badge.className)}>
                        {badge.icon}
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 rounded-lg px-3 text-xs font-semibold",
                          r.status === "PENDING" && "border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        )}
                        onClick={() => openDetail(r)}
                      >
                        {r.status === "PENDING" ? "Tinjau" : "Detail"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ===== Dialog tinjau ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-5 pb-3 pt-4">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Wallet className="h-4 w-4 text-blue-600" /> Tinjau Pengajuan Dana
            </DialogTitle>
            <DialogDescription className="sr-only">
              Setujui atau tolak pengajuan isi/tarik dana pengguna.
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4 p-5">
              {/* pengguna */}
              <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{detail.userName || detail.userEmail}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{detail.userEmail}</p>
                </div>
                <Badge className={cn("ml-auto shrink-0 gap-1 border-transparent", STATUS_BADGE[detail.status].className)}>
                  {STATUS_BADGE[detail.status].icon}
                  {STATUS_BADGE[detail.status].label}
                </Badge>
              </div>

              {/* ringkasan pengajuan */}
              <div className="rounded-xl bg-white p-3 ring-1 ring-border/60 text-[11px]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      detail.type === "DEPOSIT"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-orange-50 text-orange-600"
                    )}
                  >
                    {detail.type === "DEPOSIT" ? (
                      <ArrowDownToLine className="h-5 w-5" />
                    ) : (
                      <ArrowUpFromLine className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{detail.type === "DEPOSIT" ? "Isi Dana" : "Tarik Dana"}</p>
                    <p
                      className={cn(
                        "text-base font-bold tabular-nums",
                        detail.type === "DEPOSIT" ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {amountMain(detail.amountUsd, detail.amountIdr)}
                    </p>
                    {amountSub(detail.amountUsd, detail.amountIdr) && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {amountSub(detail.amountUsd, detail.amountIdr)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field label="Diajukan" value={fmtDateTime(detail.createdAt)} />
                  <Field label="Saldo pengguna saat ini" value={fmtUsdt(detail.userCashUsd)} />
                  <div className="col-span-2">
                    <Field
                      label="Ditinjau"
                      value={detail.reviewedAt ? fmtDateTime(detail.reviewedAt) : "—"}
                    />
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-700">
                  {detail.type === "DEPOSIT"
                    ? "Menyetujui akan menambahkan dana ke saldo tunai pengguna."
                    : "Menyetujui akan mengurangi saldo tunai pengguna sebesar jumlah di atas."}
                </p>
              </div>

              {/* keputusan */}
              {detail.status === "PENDING" ? (
                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="wallet-note" className="text-xs">
                      Catatan <span className="text-muted-foreground">(wajib jika menolak)</span>
                    </Label>
                    <Textarea
                      id="wallet-note"
                      className="min-h-16 rounded-xl text-xs"
                      placeholder="Contoh: Bukti pembayaran tidak ditemukan."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                    />
                    <p className="text-[10px] text-muted-foreground">{note.trim().length}/300 karakter</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                      onClick={() => review("APPROVE")}
                      disabled={acting !== null}
                    >
                      {acting === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                      Setujui
                    </Button>
                    <Button
                      className="h-10 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700"
                      onClick={() => review("REJECT")}
                      disabled={acting !== null}
                    >
                      {acting === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Tolak
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-xl p-3 text-[11px] leading-relaxed",
                    detail.status === "APPROVED" || detail.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  <p className="font-semibold">
                    {detail.status === "APPROVED" || detail.status === "COMPLETED"
                      ? "✓ Pengajuan ini telah disetujui."
                      : "✕ Pengajuan ini telah ditolak."}
                  </p>
                  {detail.reviewNote && <p className="mt-1">Catatan: {detail.reviewNote}</p>}
                  {detail.reviewedAt && <p className="mt-1 text-[10px] opacity-75">{fmtDateTime(detail.reviewedAt)}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}
