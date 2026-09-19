"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Clock,
  FileImage,
  IdCard,
  Inbox,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
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
import type { AdminKycDetail, AdminKycRow, KycStatus } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

type StatusFilter = "ALL" | KycStatus;

const STATUS_BADGE: Record<KycStatus, { label: string; className: string; icon: React.ReactNode }> = {
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
};

export function AdminKyc({ onAuthError }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminKycRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  // dialog tinjau
  const [detail, setDetail] = useState<AdminKycDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        rows: AdminKycRow[];
        counts: { total: number; pending: number; approved: number; rejected: number };
      }>("/api/admin/kyc");
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

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setNote("");
    try {
      const d = await apiJson<AdminKycDetail>(`/api/admin/kyc/${id}`);
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
      const data = await apiJson<{ kyc: AdminKycRow }>(`/api/admin/kyc/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: note.trim() }),
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === detail.id
            ? { ...r, status: data.kyc.status, reviewNote: data.kyc.reviewNote, reviewedAt: data.kyc.reviewedAt }
            : r
        )
      );
      setCounts((c) => ({
        ...c,
        pending: c.pending - (detail.status === "PENDING" ? 1 : 0),
        approved: c.approved + (action === "APPROVE" ? 1 : 0),
        rejected: c.rejected + (action === "REJECT" ? 1 : 0),
      }));
      setDetail((d) => (d ? { ...d, status: data.kyc.status, reviewNote: data.kyc.reviewNote, reviewedAt: data.kyc.reviewedAt } : d));
      toast({
        title: action === "APPROVE" ? "KYC disetujui ✅" : "KYC ditolak",
        description:
          action === "APPROVE"
            ? `${detail.fullName} kini terverifikasi di aplikasi.`
            : `${detail.fullName} dapat mengajukan ulang setelah diperbaiki.`,
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
    return (
      r.userEmail.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      r.idNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* header + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Verifikasi KYC</h2>
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
              placeholder="Cari nama / email / No. ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari pengajuan KYC"
            />
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status KYC">
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
              ? "Belum ada pengajuan KYC dari pengguna."
              : "Tidak ada pengajuan yang cocok dengan filter/pencarian."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[180px]">Pengguna</TableHead>
                <TableHead className="min-w-[150px]">Nama (Dokumen)</TableHead>
                <TableHead className="min-w-[140px]">No. ID</TableHead>
                <TableHead className="min-w-[120px]">Diajukan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const badge = STATUS_BADGE[r.status];
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
                      <p className="truncate text-xs font-medium">{r.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{r.idType}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.idNumber}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {fmtDateTime(r.submittedAt)}
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
                        className="h-8 rounded-lg px-3 text-xs font-semibold"
                        onClick={() => openDetail(r.id)}
                      >
                        Tinjau
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
        <DialogContent className="hx-scroll max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl p-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-5 pb-3 pt-4">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-blue-600" /> Tinjau Pengajuan KYC
            </DialogTitle>
            <DialogDescription className="sr-only">Detail dokumen verifikasi identitas pengguna.</DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : (
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

              {/* data identitas */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-white p-3 ring-1 ring-border/60 text-[11px]">
                <Field label="Nama lengkap" value={detail.fullName} />
                <Field label="Jenis dokumen" value={detail.idType} />
                <Field label="Nomor ID" value={detail.idNumber} mono />
                <Field label="Tanggal lahir" value={detail.dateOfBirth} />
                <div className="col-span-2">
                  <Field label="Alamat domisili" value={detail.address} />
                </div>
                <Field label="Diajukan" value={fmtDateTime(detail.submittedAt)} />
                <Field
                  label="Ditinjau"
                  value={detail.reviewedAt ? fmtDateTime(detail.reviewedAt) : "—"}
                />
              </div>

              {/* foto dokumen */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
                  <FileImage className="h-3.5 w-3.5 text-blue-600" /> Dokumen
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ImageView src={detail.frontImage} alt="Foto dokumen identitas" />
                  <ImageView src={detail.selfieImage} alt="Foto selfie dengan dokumen" />
                </div>
              </div>

              {/* keputusan */}
              {detail.status === "PENDING" ? (
                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="kyc-note" className="text-xs">
                      Catatan peninjauan {detail.status === "PENDING" && <span className="text-muted-foreground">(wajib jika menolak)</span>}
                    </Label>
                    <Textarea
                      id="kyc-note"
                      className="min-h-16 rounded-xl text-xs"
                      placeholder="Contoh: Foto KTP tidak jelas, silakan unggah ulang dengan pencahayaan lebih baik."
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
                    detail.status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  <p className="font-semibold">
                    {detail.status === "APPROVED" ? "✓ Pengajuan ini telah disetujui." : "✕ Pengajuan ini telah ditolak."}
                  </p>
                  {detail.reviewNote && <p className="mt-1">Catatan: {detail.reviewNote}</p>}
                  {detail.reviewedAt && <p className="mt-1 text-[10px] opacity-75">{fmtDateTime(detail.reviewedAt)}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("truncate font-semibold", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function ImageView({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl ring-1 ring-border/60"
        aria-label={`Perbesar ${alt}`}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover transition group-hover:scale-105" />
        <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
          <IdCard className="h-3 w-3" /> Lihat
        </span>
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-2xl rounded-2xl p-2" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{alt}</DialogTitle>
            <DialogDescription>{alt}</DialogDescription>
          </DialogHeader>
          <img src={src} alt={alt} className="max-h-[80vh] w-full rounded-xl object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
