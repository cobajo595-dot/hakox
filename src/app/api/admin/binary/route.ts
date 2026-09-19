import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getMarket, getUsdIdrRate } from "@/lib/market-data";
import { mapOrder, settleBinaryOrder, settleDueBinaryOrders } from "@/lib/binary";
import type { AdminBinaryRow, AdminBinaryResponse, BinaryControlMode } from "@/lib/types";

export const dynamic = "force-dynamic";

function toAdminRow(o: {
  id: string;
  coinId: string;
  symbol: string;
  direction: string;
  amountUsd: number;
  profitPct: number;
  entryPrice: number;
  resultPrice: number | null;
  expiryMin: number;
  status: string;
  payoutUsd: number | null;
  forceResult: string | null;
  createdAt: Date;
  expiresAt: Date;
  settledAt: Date | null;
  user: { name: string | null; email: string; cashUsd: number };
}): AdminBinaryRow {
  return {
    ...mapOrder(o),
    userName: o.user.name ?? "",
    userEmail: o.user.email,
    userCashUsd: o.user.cashUsd,
  };
}

/** GET /api/admin/binary — kontrol arah, pesanan aktif, riwayat & statistik opsi. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    // settle dulu yang kedaluwarsa agar status segar
    await settleDueBinaryOrders();

    const [controlRows, pendingRows, recentRows] = await Promise.all([
      db.tradeControl.findMany(),
      db.binaryOrder.findMany({
        where: { status: "PENDING" },
        orderBy: { expiresAt: "asc" },
        take: 100,
        include: { user: { select: { name: true, email: true, cashUsd: true } } },
      }),
      db.binaryOrder.findMany({
        where: { status: { not: "PENDING" } },
        orderBy: [{ settledAt: "desc" }, { createdAt: "desc" }],
        take: 25,
        include: { user: { select: { name: true, email: true, cashUsd: true } } },
      }),
    ]);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [won24, lost24] = await Promise.all([
      db.binaryOrder.aggregate({
        where: { status: "WON", settledAt: { gte: dayAgo } },
        _count: { _all: true },
        _sum: { amountUsd: true, payoutUsd: true },
      }),
      db.binaryOrder.aggregate({
        where: { status: "LOST", settledAt: { gte: dayAgo } },
        _count: { _all: true },
        _sum: { amountUsd: true },
      }),
    ]);

    const pendingStakeUsd = pendingRows.reduce((s, o) => s + o.amountUsd, 0);
    const platformPnl24h =
      (lost24._sum.amountUsd ?? 0) - (won24._sum.payoutUsd ?? 0);

    const { coins } = await getMarket();
    const coinList = coins.slice(0, 12).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      price: c.price,
    }));

    const payload: AdminBinaryResponse = {
      controls: Object.fromEntries(controlRows.map((r) => [r.symbol, r.mode as BinaryControlMode])),
      pending: pendingRows.map(toAdminRow),
      recent: recentRows.map(toAdminRow),
      stats: {
        pendingCount: pendingRows.length,
        pendingStakeUsd,
        wonCount24h: won24._count._all,
        lostCount24h: lost24._count._all,
        platformPnl24h,
      },
      coins: coinList,
      usdIdrRate: await getUsdIdrRate(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("admin binary list error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

/** POST /api/admin/binary — atur mode arah harga / paksa hasil order. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      symbol?: string;
      mode?: string;
      orderId?: string;
      outcome?: string;
    };

    if (body.action === "setMode") {
      const symbol = body.symbol?.trim().toUpperCase() ?? "";
      const mode = body.mode?.trim().toUpperCase() ?? "";
      if (!symbol) {
        return NextResponse.json({ error: "Simbol wajib." }, { status: 400 });
      }
      if (!["AUTO", "UP", "DOWN"].includes(mode)) {
        return NextResponse.json({ error: "Mode tidak valid." }, { status: 400 });
      }
      await db.tradeControl.upsert({
        where: { symbol },
        update: { mode },
        create: { symbol, mode },
      });
      return NextResponse.json({ ok: true, symbol, mode });
    }

    if (body.action === "forceSettle") {
      const outcome = body.outcome?.trim().toUpperCase() ?? "";
      if (!["WIN", "LOSE", "AUTO"].includes(outcome)) {
        return NextResponse.json({ error: "Outcome tidak valid." }, { status: 400 });
      }
      const order = await db.binaryOrder.findUnique({
        where: { id: body.orderId ?? "" },
      });
      if (!order) {
        return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
      }
      if (order.status !== "PENDING") {
        return NextResponse.json({ error: "Order sudah disettle." }, { status: 400 });
      }
      const settled = await settleBinaryOrder(order, outcome as "WIN" | "LOSE" | "AUTO");
      if (!settled) {
        return NextResponse.json({ error: "Order sudah disettle." }, { status: 400 });
      }
      const fresh = await db.binaryOrder.findUnique({
        where: { id: order.id },
        include: { user: { select: { name: true, email: true, cashUsd: true } } },
      });
      return NextResponse.json({ order: fresh ? toAdminRow(fresh) : settled });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (err) {
    console.error("admin binary action error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
