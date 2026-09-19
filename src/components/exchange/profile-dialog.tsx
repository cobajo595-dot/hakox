"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  FileImage,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { KycIdType, KycStatus, KycStatusResponse, KycView, SessionUser } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  onStatusChange?: (status: KycStatus | null) => void;
}

type FormState = {
  fullName: string;
  idType: KycIdType;
  idNumber: string;
  dateOfBirth: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  idType: "KTP",
  idNumber: "",
  dateOfBirth: "",
  address: "",
};

/** Downscale gambar di sisi klien → data URL JPEG agar ringan disimpan. */
async function fileToDataUrl(file: File, maxDim = 1100, quality = 0.82): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas ctx kosong");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // fallback: baca apa adanya (harusnya sudah diperkecil browser modern)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Gagal membaca berkas."));
      reader.readAsDataURL(file);
    });
  }
}

/** Sembunyikan sebagian nomor ID demi keamanan. */
function maskId(no: string): string {
  if (no.length <= 6) return no;
  return `${no.slice(0, 4)}${"•".repeat(Math.min(10, no.length - 6))}${no.slice(-2)}`;
}

export function ProfileDialog({ open, onOpenChange, user, onStatusChange }: ProfileDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [kyc, setKyc] = useState<KycView | null>(null);
  const [mode, setMode] = useState<"view" | "form">("view");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const loadKyc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kyc?userId=${user.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as KycStatusResponse;
        setKyc(data.kyc);
        onStatusChange?.(data.kyc?.status ?? null);
      }
    } catch {
      /* abaikan — kartu status tetap tampil */
    } finally {
      setLoading(false);
    }
  }, [user.id, onStatusChange]);

  useEffect(() => {
    if (open) {
      setMode("view");
      loadKyc();
    }
  }, [open, loadKyc]);

  const openForm = () => {
    // prefill untuk pengajuan ulang
    if (kyc) {
      setForm({
        fullName: kyc.fullName,
        idType: kyc.idType,
        idNumber: kyc.idNumber,
        dateOfBirth: kyc.dateOfBirth,
        address: kyc.address,
      });
    } else {
      setForm({ ...EMPTY_FORM, fullName: user.name || "" });
    }
    setFrontImage(null);
    setSelfieImage(null);
    setMode("form");
  };

  const pickImage = async (file: File | undefined, target: "front" | "selfie") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Berkas tidak didukung", description: "Pilih berkas gambar (JPG/PNG).", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Ukuran terlalu besar", description: "Foto maksimal 8 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      if (target === "front") setFrontImage(dataUrl);
      else setSelfieImage(dataUrl);
    } catch {
      toast({ title: "Gagal memproses foto", description: "Coba foto lain.", variant: "destructive" });
    }
  };

  const validate = (): string | null => {
    if (form.fullName.trim().length < 3) return "Nama lengkap minimal 3 karakter.";
    if (form.idType === "KTP" && !/^\d{16}$/.test(form.idNumber.trim()))
      return "Nomor KTP (NIK) harus tepat 16 digit angka.";
    if (form.idType === "PASPOR" && !/^[A-Za-z0-9]{6,12}$/.test(form.idNumber.trim()))
      return "Nomor paspor harus 6-12 huruf/angka.";
    if (!form.dateOfBirth) return "Tanggal lahir wajib diisi.";
    const dob = new Date(`${form.dateOfBirth}T00:00:00`);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 17) return "Anda harus berusia minimal 17 tahun.";
    if (form.address.trim().length < 10) return "Alamat domisili minimal 10 karakter.";
    if (!frontImage) return "Unggah foto dokumen identitas.";
    if (!selfieImage) return "Unggah foto selfie dengan dokumen.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Lengkapi data", description: err, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          fullName: form.fullName.trim(),
          idType: form.idType,
          idNumber: form.idNumber.trim(),
          dateOfBirth: form.dateOfBirth,
          address: form.address.trim(),
          frontImage,
          selfieImage,
        }),
      });
      const data = (await res.json()) as KycStatusResponse & { error?: string };
      if (!res.ok) {
        toast({ title: "Gagal mengirim", description: data.error ?? "Coba lagi sebentar.", variant: "destructive" });
        return;
      }
      setKyc(data.kyc);
      onStatusChange?.(data.kyc?.status ?? null);
      setMode("view");
      toast({
        title: "Pengajuan KYC terkirim ✅",
        description: "Verifikasi biasanya diproses maksimal 1×24 jam.",
      });
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Coba lagi sebentar.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = user.name || user.email.split("@")[0];
  const dobMax = new Date(Date.now() - 17 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hx-scroll max-h-[92vh] max-w-md overflow-y-auto rounded-2xl p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b px-5 pb-3 pt-4">
          <DialogTitle className="text-sm font-bold">Profil &amp; Verifikasi KYC</DialogTitle>
          <DialogDescription className="sr-only">Kelola profil dan verifikasi identitas akun Anda.</DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 pt-4">
          {/* ===== Kartu profil ===== */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 p-4 text-white shadow-lg shadow-blue-600/25">
            <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-blue-400/30 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold backdrop-blur">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-sm font-bold">
                  {displayName}
                  {kyc?.status === "APPROVED" && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Terverifikasi" />}
                </p>
                <p className="truncate text-xs text-blue-100">{user.email}</p>
                <p className="mt-0.5 text-[10px] text-blue-200/80">UID: {user.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </section>

          {/* ===== Status KYC ===== */}
          <h3 className="mt-5 flex items-center gap-1.5 text-xs font-bold">
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Verifikasi Identitas (KYC)
          </h3>

          {loading ? (
            <div className="mt-3 space-y-2 rounded-2xl bg-white p-4 ring-1 ring-border/60">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : mode === "form" ? (
            /* ================= FORM ================= */
            <form onSubmit={submit} className="mt-3 space-y-3.5 rounded-2xl bg-white p-4 ring-1 ring-border/60">
              <div className="space-y-1.5">
                <Label htmlFor="kyc-name" className="text-xs">Nama lengkap (sesuai dokumen)</Label>
                <Input
                  id="kyc-name"
                  className="h-10 rounded-xl"
                  placeholder="Contoh: Budi Santoso"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  maxLength={80}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Jenis dokumen</Label>
                  <Select
                    value={form.idType}
                    onValueChange={(v) => setForm((f) => ({ ...f, idType: v as KycIdType, idNumber: "" }))}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KTP">KTP</SelectItem>
                      <SelectItem value="PASPOR">Paspor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kyc-idno" className="text-xs">
                    {form.idType === "KTP" ? "Nomor NIK (16 digit)" : "Nomor paspor"}
                  </Label>
                  <Input
                    id="kyc-idno"
                    className="h-10 rounded-xl"
                    inputMode={form.idType === "KTP" ? "numeric" : "text"}
                    placeholder={form.idType === "KTP" ? "3204xxxxxxxxxxxx" : "X1234567"}
                    value={form.idNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        idNumber: form.idType === "KTP" ? e.target.value.replace(/\D/g, "").slice(0, 16) : e.target.value.toUpperCase().slice(0, 12),
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kyc-dob" className="text-xs">Tanggal lahir</Label>
                <Input
                  id="kyc-dob"
                  type="date"
                  className="h-10 rounded-xl"
                  max={dobMax}
                  min="1900-01-01"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kyc-addr" className="text-xs">Alamat domisili (KTP)</Label>
                <Textarea
                  id="kyc-addr"
                  className="min-h-16 rounded-xl text-xs"
                  placeholder="Jl. Merdeka No. 10, Bandung, Jawa Barat…"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  maxLength={200}
                  required
                />
                <p className="text-[10px] text-muted-foreground">{form.address.trim().length}/200 karakter</p>
              </div>

              {/* Upload foto */}
              <div className="grid grid-cols-2 gap-3">
                <UploadTile
                  label="Foto dokumen"
                  hint="KTP/paspor jelas"
                  image={frontImage}
                  inputRef={frontRef}
                  onPick={(f) => pickImage(f, "front")}
                />
                <UploadTile
                  label="Foto selfie"
                  hint="Selfie pegang dokumen"
                  image={selfieImage}
                  inputRef={selfieRef}
                  onPick={(f) => pickImage(f, "selfie")}
                />
              </div>

              <p className="flex items-start gap-1.5 rounded-lg bg-blue-50/70 p-2.5 text-[10px] leading-relaxed text-blue-700">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
                Data Anda tersimpan aman dan hanya digunakan untuk verifikasi identitas sesuai ketentuan.
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 rounded-xl text-xs font-semibold"
                  onClick={() => setMode("view")}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" className="h-10 flex-[2] rounded-xl text-xs font-bold" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim untuk Verifikasi"}
                </Button>
              </div>
            </form>
          ) : (
            /* ================= KARTU STATUS ================= */
            <div className="mt-3">
              {kyc === null && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-border/60">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                      <ShieldAlert className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold">Belum Terverifikasi</p>
                      <p className="text-[10px] text-muted-foreground">Status: Belum verifikasi</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                    Verifikasi identitas (KYC) diperlukan untuk keamanan akun dan akses fitur tarik dana.
                  </p>
                  <Button className="mt-3 h-10 w-full rounded-xl text-xs font-bold" onClick={openForm}>
                    Verifikasi Sekarang
                  </Button>
                </div>
              )}

              {kyc?.status === "PENDING" && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-border/60">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                      <Clock className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold">Menunggu Tinjauan</p>
                      <p className="text-[10px] text-muted-foreground">
                        Diajukan {fmtDateTime(kyc.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                    Tim kami sedang memeriksa dokumen Anda. Proses biasanya selesai dalam 1×24 jam.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-muted/50 p-3 text-[11px]">
                    <Detail label="Nama" value={kyc.fullName} />
                    <Detail label="Dokumen" value={kyc.idType === "KTP" ? "KTP" : "Paspor"} />
                    <Detail label="No. ID" value={maskId(kyc.idNumber)} />
                    <Detail label="Tgl. lahir" value={kyc.dateOfBirth} />
                  </div>
                </div>
              )}

              {kyc?.status === "APPROVED" && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200/70">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <BadgeCheck className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-emerald-700">Terverifikasi ✓</p>
                      <p className="text-[10px] text-muted-foreground">
                        Disetujui {kyc.reviewedAt ? fmtDateTime(kyc.reviewedAt) : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-emerald-50/60 p-3 text-[11px]">
                    <Detail label="Nama" value={kyc.fullName} />
                    <Detail label="Dokumen" value={kyc.idType === "KTP" ? "KTP" : "Paspor"} />
                    <Detail label="No. ID" value={maskId(kyc.idNumber)} />
                    <Detail label="Tgl. lahir" value={kyc.dateOfBirth} />
                  </div>
                  <p className="mt-2.5 flex items-center gap-1 text-[10px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Identitas Anda telah diverifikasi. Seluruh fitur akun terbuka.
                  </p>
                </div>
              )}

              {kyc?.status === "REJECTED" && (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-red-200/70">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500">
                      <XCircle className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-red-600">Verifikasi Ditolak</p>
                      <p className="text-[10px] text-muted-foreground">
                        Ditinjau {kyc.reviewedAt ? fmtDateTime(kyc.reviewedAt) : ""}
                      </p>
                    </div>
                  </div>
                  {kyc.reviewNote && (
                    <p className="mt-2.5 rounded-lg bg-red-50 p-2.5 text-[11px] leading-relaxed text-red-600">
                      <span className="font-semibold">Alasan:</span> {kyc.reviewNote}
                    </p>
                  )}
                  <Button className="mt-3 h-10 w-full gap-1.5 rounded-xl text-xs font-bold" onClick={openForm}>
                    <RefreshCw className="h-3.5 w-3.5" /> Ajukan Ulang
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Tile unggah foto dengan pratinjau. */
function UploadTile({
  label,
  hint,
  image,
  inputRef,
  onPick,
}: {
  label: string;
  hint: string;
  image: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | undefined) => void;
}) {
  const id = `kyc-${label.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`Unggah ${label}`}
        className={cn(
          "mt-1.5 flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 transition hover:border-blue-400 hover:bg-blue-50/50",
          image && "border-solid border-transparent p-0"
        )}
      >
        {image ? (
          <img src={image} alt={`Pratinjau ${label}`} className="h-full w-full object-cover" />
        ) : (
          <>
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">
              {hint}
              <br />
              Ketuk untuk unggah
            </span>
          </>
        )}
      </button>
      {image && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
          <FileImage className="h-3 w-3" /> Foto siap dikirim
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}
