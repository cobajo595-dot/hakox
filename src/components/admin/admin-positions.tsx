"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { AdminPositionRow } from "@/lib/types";
import { fmtDateTime, fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

export function AdminPositions({ onAuthError }: Props) {
  const { toast } = useToast();
  const [positions, setPositions] = useState<AdminPositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("OPEN");
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (s: string, q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (s !== "ALL") params.set("status", s);
        if (q) params.set("q", q);
        const data = await apiJson<{ positions: AdminPositionRow[] }>(
          `/api/admin/positions?${params.toString()}`
        );
        setPositions(data.positions);
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
    load(status, "");
     
  }, []);

  // Auto-refresh PnL live tiap 15 detik untuk posisi terbuka
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") load(status, query.trim());
    }, 15000);
    return () => clearInterval(t);
     
  }, [status]);

  const roe = (p: AdminPositionRow): number => {
    if (!p.marginUsd || p.pnlUsd === null) return 0;
    return (p.pnlUsd / p.marginUsd) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Monitor Posisi Kontrak</h2>
          <p className="text-xs text-muted-foreground">
            {positions.length} posisi · PnL diperbarui otomatis tiap 15 detik
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => load(status, query.trim())}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </Button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(status, query.trim());
        }}
      >
        <Select value={status} onValueChange={(v) => { setStatus(v); load(v, query.trim()); }}>
          <SelectTrigger className="h-10 w-[140px] rounded-xl" aria-label="Filter status posisi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Terbuka</SelectItem>
            <SelectItem value="CLOSED">Ditutup</SelectItem>
            <SelectItem value="ALL">Semua</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-xl pl-9"
            placeholder="Koin / email pengguna…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-10 rounded-xl px-4">Terapkan</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="max-h-[62vh] overflow-auto hx-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Dibuka</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Arah</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Margin</TableHead>
                <TableHead className="hidden text-right md:table-cell">Entri</TableHead>
                <TableHead className="text-right">Harga Kini</TableHead>
                <TableHead className="text-right">PnL (ROE)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && positions.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              )}
              {!loading && positions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    Tidak ada posisi yang cocok.
                  </TableCell>
                </TableRow>
              )}
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-[11px] whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(p.openedAt)}
                  </TableCell>
                  <TableCell>
                    <p className="truncate text-xs font-semibold">{p.userName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{p.userEmail}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold">{p.symbol}</p>
                    <Badge
                      className={cn(
                        "mt-0.5 px-1.5 py-0 text-[9px] font-bold",
                        p.side === "LONG" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      )}
                    >
                      {p.side} {p.leverage}x
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-xs sm:table-cell">{fmtUsd(p.marginUsd)}</TableCell>
                  <TableCell className="hidden text-right text-xs md:table-cell">{fmtUsd(p.entryPrice)}</TableCell>
                  <TableCell className="text-right text-xs">
                    {p.priceNow !== null ? fmtUsd(p.priceNow) : p.status === "CLOSED" ? "—" : "…"}
                    {p.status === "CLOSED" && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(ditutup)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.pnlUsd !== null && (
                      <>
                        <p className={cn("text-xs font-bold", p.pnlUsd >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {p.pnlUsd >= 0 ? "+" : ""}
                          {fmtUsd(p.pnlUsd)}
                        </p>
                        <p className={cn("text-[10px]", p.pnlUsd >= 0 ? "text-emerald-600/80" : "text-red-500/80")}>
                          {fmtPct(roe(p))}
                        </p>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
