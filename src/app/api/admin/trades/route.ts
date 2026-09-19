import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminTradeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 200);
  const side = req.nextUrl.searchParams.get("side");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const rows = await db.trade.findMany({
      where: {
        side: side === "BUY" || side === "SELL" ? side : undefined,
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
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    });

    const trades: AdminTradeRow[] = rows.map((t) => ({
      id: t.id,
      coinId: t.coinId,
      symbol: t.symbol,
      side: t.side === "SELL" ? "SELL" : "BUY",
      quantity: t.quantity,
      price: t.price,
      totalUsd: t.totalUsd,
      createdAt: t.createdAt.toISOString(),
      userName: t.user.name ?? t.user.email,
      userEmail: t.user.email,
    }));

    return NextResponse.json({ trades });
  } catch (err) {
    console.error("admin trades error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
