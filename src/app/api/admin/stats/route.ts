import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getMarket } from "@/lib/market-data";
import type { AdminStats, AdminTxRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      newUsers7d,
      tradeAgg,
      openPosAgg,
      depositAgg,
      withdrawAgg,
      pendingWalletAgg,
      cashAgg,
      recentTrades,
      txRows,
      holdingsRows,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: weekAgo } } }),
      db.trade.aggregate({ _count: { _all: true }, _sum: { totalUsd: true } }),
      db.position.aggregate({
        where: { status: "OPEN" },
        _count: { _all: true },
        _sum: { marginUsd: true },
      }),
      // Hanya setoran/penarikan yang sudah disetujui (atau legacy COMPLETED) yang dihitung
      db.transaction.aggregate({
        where: { type: "DEPOSIT", status: { in: ["APPROVED", "COMPLETED"] } },
        _sum: { amountUsd: true },
      }),
      db.transaction.aggregate({
        where: { type: "WITHDRAW", status: { in: ["APPROVED", "COMPLETED"] } },
        _sum: { amountUsd: true },
      }),
      db.transaction.count({ where: { type: { in: ["DEPOSIT", "WITHDRAW"] }, status: "PENDING" } }),
      db.user.aggregate({ _sum: { cashUsd: true } }),
      db.trade.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true, totalUsd: true, symbol: true },
      }),
      db.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.holding.findMany({ select: { coinId: true, amount: true } }),
    ]);

    // Nilai koin yang dipegang pengguna (harga pasar terkini)
    const { coins } = await getMarket();
    const priceMap = new Map(coins.map((c) => [c.id, c.price]));
    let holdingsUsd = 0;
    for (const h of holdingsRows) {
      const p = priceMap.get(h.coinId);
      if (p) holdingsUsd += h.amount * p;
    }

    // Volume & jumlah trade per hari (7 hari terakhir)
    const dayMap = new Map<string, { volume: number; count: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      dayMap.set(key, { volume: 0, count: 0 });
    }
    const coinAgg = new Map<string, { volume: number; count: number }>();
    for (const t of recentTrades) {
      const key = t.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const entry = dayMap.get(key);
      if (entry) {
        entry.volume += t.totalUsd;
        entry.count += 1;
      }
      const coin = coinAgg.get(t.symbol) ?? { volume: 0, count: 0 };
      coin.volume += t.totalUsd;
      coin.count += 1;
      coinAgg.set(t.symbol, coin);
    }

    const recentTx: AdminTxRow[] = txRows.map((t) => ({
      id: t.id,
      type: (t.type as AdminTxRow["type"]) ?? "ADMIN_ADJUST",
      amountUsd: t.amountUsd,
      note: t.note,
      status: t.status as AdminTxRow["status"],
      createdAt: t.createdAt.toISOString(),
      userName: t.user.name ?? t.user.email,
      userEmail: t.user.email,
    }));

    const stats: AdminStats = {
      userCount,
      newUsers7d,
      tradeCount: tradeAgg._count._all,
      tradeVolumeUsd: tradeAgg._sum.totalUsd ?? 0,
      openPositions: openPosAgg._count._all,
      openMarginUsd: openPosAgg._sum.marginUsd ?? 0,
      depositUsd: depositAgg._sum.amountUsd ?? 0,
      withdrawUsd: withdrawAgg._sum.amountUsd ?? 0,
      pendingWalletCount: pendingWalletAgg,
      platformCashUsd: cashAgg._sum.cashUsd ?? 0,
      platformEquityUsd: (cashAgg._sum.cashUsd ?? 0) + holdingsUsd,
      tradesPerDay: Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v })),
      topCoins: Array.from(coinAgg.entries())
        .map(([symbol, v]) => ({ symbol, ...v }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
      recentTx,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("admin stats error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
