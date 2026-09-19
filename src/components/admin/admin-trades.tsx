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
import type { AdminTradeRow } from "@/lib/types";
import { fmtDateTime, fmtQty, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  onAuthError: () => void;
}

export function AdminTrades({ onAuthError }: Props) {
  const { toast } = useToast();
  const [trades, setTrades] = useState<AdminTradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (s: string, q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (s !== "ALL") params.set("side", s);
        if (q) params.set("q", q);
        const data = await apiJson<{ trades: AdminTradeRow[] }>(
          `/api/admin/trades?${params.toString()}`
        );
        setTrades(data.trades);
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
    load("ALL", "");
     
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Riwayat Trade</h2>
          <p className="text-xs text-muted-foreground">{trades.length} order terakhir</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => load(side, query.trim())}
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
          load(side, query.trim());
        }}
      >
        <Select value={side} onValueChange={(v) => { setSide(v); load(v, query.trim()); }}>
          <SelectTrigger className="h-10 w-[130px] rounded-xl" aria-label="Filter arah trade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua arah</SelectItem>
            <SelectItem value="BUY">Beli</SelectItem>
            <SelectItem value="SELL">Jual</SelectItem>
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
                <TableHead>Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Koin</TableHead>
                <TableHead className="text-center">Arah</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Kuantitas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Harga</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && trades.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              )}
              {!loading && trades.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    Belum ada trade yang cocok.
                  </TableCell>
                </TableRow>
              )}
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-[11px] whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(t.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="truncate text-xs font-semibold">{t.userName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{t.userEmail}</p>
                  </TableCell>
                  <TableCell className="text-xs font-bold">{t.symbol}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold",
                        t.side === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      )}
                    >
                      {t.side === "BUY" ? "BELI" : "JUAL"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-xs sm:table-cell">{fmtQty(t.quantity)}</TableCell>
                  <TableCell className="hidden text-right text-xs sm:table-cell">{fmtUsd(t.price)}</TableCell>
                  <TableCell className="text-right text-xs font-bold">{fmtUsd(t.totalUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
