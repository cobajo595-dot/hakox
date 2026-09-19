import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getMarket } from "@/lib/market-data";
import type { AdminPositionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const rows = await db.position.findMany({
      where: {
        status:
          status === "OPEN" || status === "CLOSED"
            ? status
            : undefined,
        ...(q
          ? {
              OR: [
                { symbol: { contains: q } },
                { user: { email: { contains: q } } },
                { user: { name: { contains: q } } },
              ],
            }
          : {}),
      },
      orderBy: { openedAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    });

    const { coins } = await getMarket();
    const priceMap = new Map(coins.map((c) => [c.id, c.price]));

    const positions: AdminPositionRow[] = rows.map((p) => {
      const priceNow = priceMap.get(p.coinId) ?? null;
      const isOpen = p.status === "OPEN";
      const dir = p.side === "LONG" ? 1 : -1;
      const effPrice = isOpen ? (priceNow ?? p.entryPrice) : (p.closePrice ?? p.entryPrice);
      return {
        id: p.id,
        symbol: p.symbol,
        side: p.side === "SHORT" ? "SHORT" : "LONG",
        leverage: p.leverage,
        marginUsd: p.marginUsd,
        entryPrice: p.entryPrice,
        priceNow: priceNow,
        pnlUsd: isOpen
          ? p.quantity * (effPrice - p.entryPrice) * dir
          : (p.pnlUsd ?? 0),
        status: isOpen ? "OPEN" : "CLOSED",
        openedAt: p.openedAt.toISOString(),
        closedAt: p.closedAt?.toISOString() ?? null,
        userName: p.user.name ?? p.user.email,
        userEmail: p.user.email,
      };
    });

    return NextResponse.json({ positions });
  } catch (err) {
    console.error("admin positions error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
