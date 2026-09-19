"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiJson } from "@/components/admin/admin-api";
import type { NoticeRow } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

interface Props {
  onAuthError: () => void;
}

export function AdminNotices({ onAuthError }: Props) {
  const { toast } = useToast();
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoticeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ notices: NoticeRow[] }>("/api/admin/notices");
      setNotices(data.notices);
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
     
  }, [onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (text.length < 3 || text.length > 160) {
      toast({
        title: "Panjang tidak sesuai",
        description: "Pengumuman harus 3-160 karakter.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const data = await apiJson<{ notice: NoticeRow }>("/api/admin/notices", {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      setNotices((prev) => [data.notice, ...prev]);
      setContent("");
      toast({ title: "Pengumuman dipublikasikan 📢", description: "Tampil di ticker beranda aplikasi." });
    } catch (err) {
      const e2 = err as { status?: number; message: string };
      if (e2.status === 401) onAuthError();
      else toast({ title: "Gagal", description: e2.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleActive = async (n: NoticeRow, active: boolean) => {
    // optimistic
    setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, active } : x)));
    try {
      await apiJson("/api/admin/notices", {
        method: "PATCH",
        body: JSON.stringify({ id: n.id, active }),
      });
    } catch (err) {
      setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, active: !active } : x)));
      const e = err as { status?: number; message: string };
      if (e.status === 401) onAuthError();
      else toast({ title: "Gagal mengubah status", description: e.message, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setNotices((prev) => prev.filter((x) => x.id !== target.id));
    try {
      await apiJson(`/api/admin/notices?id=${target.id}`, { method: "DELETE" });
      toast({ title: "Pengumuman dihapus" });
    } catch (err) {
      setNotices((prev) => [target, ...prev]);
      const e = err as { status?: number; message: string };
      if (e.status === 401) onAuthError();
      else toast({ title: "Gagal menghapus", description: e.message, variant: "destructive" });
    }
  };

  const activeCount = notices.filter((n) => n.active).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Pengumuman</h2>
        <p className="text-xs text-muted-foreground">
          {activeCount} aktif dari {notices.length} pengumuman · tampil di ticker beranda
        </p>
      </div>

      {/* form */}
      <form onSubmit={submit} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
        <label htmlFor="notice-content" className="mb-2 flex items-center gap-1.5 text-xs font-bold">
          <Megaphone className="h-3.5 w-3.5 text-blue-600" /> Buat pengumuman baru
        </label>
        <Textarea
          id="notice-content"
          className="min-h-20 rounded-xl"
          placeholder="Contoh: Selamat datang di HakoX! Ajukan Isi Dana di halaman Aset untuk mulai bertransaksi."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={160}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{content.trim().length}/160 karakter</p>
          <Button type="submit" size="sm" className="h-9 gap-1.5 rounded-xl px-4 font-semibold" disabled={sending}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Publikasikan
          </Button>
        </div>
      </form>

      {/* list */}
      <div className="space-y-2">
        {loading && (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        )}
        {!loading && notices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-white/60 py-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">
              Belum ada pengumuman. Buat satu untuk tampil di aplikasi.
            </p>
          </div>
        )}
        {notices.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-relaxed">{n.content}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
            </div>
            <Badge
              className={
                n.active
                  ? "shrink-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  : "shrink-0 bg-slate-100 text-slate-500 hover:bg-slate-100"
              }
            >
              {n.active ? "Aktif" : "Nonaktif"}
            </Badge>
            <Switch
              checked={n.active}
              onCheckedChange={(v) => toggleActive(n, v)}
              aria-label={`Aktifkan pengumuman: ${n.content}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleteTarget(n)}
              aria-label={`Hapus pengumuman: ${n.content}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus pengumuman?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              &ldquo;{deleteTarget?.content}&rdquo; akan dihapus permanen dari daftar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
