import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getMarket } from "@/lib/market-data";
import type { AdminUserRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: { select: { trades: true } },
        holdings: { select: { coinId: true, amount: true } },
        positions: { where: { status: "OPEN" }, select: { id: true } },
      },
    });

    const { coins } = await getMarket();
    const priceMap = new Map(coins.map((c) => [c.id, c.price]));

    const rows: AdminUserRow[] = users.map((u) => {
      let holdingsUsd = 0;
      for (const h of u.holdings) {
        const p = priceMap.get(h.coinId);
        if (p) holdingsUsd += h.amount * p;
      }
      return {
        id: u.id,
        email: u.email,
        name: u.name ?? "",
        cashUsd: u.cashUsd,
        holdingsUsd,
        openPositions: u.positions.length,
        tradeCount: u._count.trades,
        createdAt: u.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("admin users error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
